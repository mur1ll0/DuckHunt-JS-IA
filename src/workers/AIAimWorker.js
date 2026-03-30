/**
 * AIAimWorker.js
 * Web Worker for AI-guided AUTO_AIM using TensorFlow.js duck detection
 * Runs in a separate thread to avoid blocking the main render thread
 * 
 * IMPORTANT: This worker ONLY supports AUTO_AIM mode (IA_GUIDED is handled by main thread)
 */

importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.14.0');

const IS_DEBUG = Boolean(
  self.location &&
  (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1')
);

// Configuration
const CONFIG = {
  LEAD_TIME_FRAMES: 6,        // frames to predict ahead for lead aiming
  FRAME_RATE: 60,
  CONFIDENCE_THRESHOLD: 0.6,   // minimum confidence to fire
  BASE_SMOOTHING_FACTOR: 0.12, // base crosshair smoothing (will be adjusted by duck speed)
  MAX_DISTANCE_TO_FIRE: 0.7,   // max relative distance from crosshair center to fire (% of radius)
  GROUND_EXCLUSION_HEIGHT: 130
};

/**
 * Reinforcement Learning Model for shot outcome feedback
 */
class LearningModel {
  constructor() {
    this.weights = {
      distanceToCenter: 0.65,
      velocityAlignment: 0.2,
      duckCount: 0.05,
      leadPrediction: 0.1
    };
    this.activityBuffer = [];
    this.maxBufferSize = 100;
  }

  recordActivity(state) {
    this.activityBuffer.push(state);
    if (this.activityBuffer.length > this.maxBufferSize) {
      this.activityBuffer.shift();
    }
  }

  updateWeights(reward) {
    const learningRate = 0.01;

    if (reward > 0) {
      this.weights.distanceToCenter += learningRate * Math.min(reward / 2, 1);
      this.weights.velocityAlignment += learningRate * 0.1;
      this.weights.leadPrediction += learningRate * 0.05;
    } else if (reward < 0) {
      this.weights.distanceToCenter -= learningRate * 0.05;
      this.weights.leadPrediction -= learningRate * 0.05;
    }

    // Normalize weights to sum to non-zero value
    const sum = Math.abs(Object.values(this.weights).reduce((a, b) => a + b, 0));
    if (sum > 0) {
      Object.keys(this.weights).forEach(key => {
        this.weights[key] /= sum;
      });
    }
  }

  getFireScore(gameState) {
    let score = 0;

    if (gameState.closestDuck) {
      const dist = Math.hypot(
        gameState.closestDuck.x - gameState.crosshairX,
        gameState.closestDuck.y - gameState.crosshairY
      );

      const normalizedDist = Math.max(0, 1 - (dist / gameState.crosshairRadius));
      score += this.weights.distanceToCenter * normalizedDist;

      if (gameState.closestDuckVelocity) {
        const vx = gameState.closestDuckVelocity.vx;
        const vy = gameState.closestDuckVelocity.vy;
        score += this.weights.velocityAlignment * (Math.hypot(vx, vy) > 0 ? 0.5 : 0);
      }

      score += this.weights.duckCount * Math.min(gameState.duckCount / 10, 1);
      score += this.weights.leadPrediction * 0.2;
    }

    return Math.max(0, Math.min(score, 1));
  }
}

// Worker state - FIXED: LearningModel class defined BEFORE instantiation
let workerState = {
  lastDuckPositions: new Map(), // id -> {x, y, timestamp}
  lastFrameState: null,
  crosshairTarget: { x: 0, y: 0 },
  screenDimensions: { width: 800, height: 600 },
  fireDecision: false,
  confidence: 0,
  learningModel: new LearningModel(),
  frameCount: 0,
  lastValidTargetTime: 0,
  duckSpeed: 5, // default speed (1-10 scale, will be updated from game)
  smoothingFactor: CONFIG.BASE_SMOOTHING_FACTOR
};

/**
 * Calculate adaptive smoothing factor based on duck speed
 * Faster ducks require faster (higher) smoothing factor for crosshair to keep up
 */
function calculateSmoothingFactor(duckSpeed) {
  // duckSpeed is on scale 1-10.
  // Keep the crosshair slightly slower than the ducks so it tracks naturally
  // instead of snapping aggressively to the target.
  const normalizedSpeed = Math.max(1, Math.min(10, duckSpeed || 5));
  const factor = CONFIG.BASE_SMOOTHING_FACTOR + (normalizedSpeed / 10) * 0.18;
  return Math.min(0.32, factor);
}

function getFlightWindowMaxY() {
  const worldHeight = workerState.screenDimensions.height || 600;
  return Math.max(0, worldHeight - CONFIG.GROUND_EXCLUSION_HEIGHT);
}

/**
 * Find valid ducks (alive and not in prohibited states)
 * Filters out: dead, shot, and ducks in dog's mouth (single/double)
 */
function getValidDucks(ducks) {
  if (!ducks || !Array.isArray(ducks)) {
    return [];
  }

  return ducks.filter(duck => {
    // Must be explicitly marked alive
    if (!duck.alive) return false;

    // Ignore ducks while they are still emerging from the spawn/ground window.
    if (!Number.isFinite(duck.y) || duck.y >= getFlightWindowMaxY()) return false;
    
    // Filter out prohibited states
    const prohibitedStates = ['dead', 'shot'];
    if (prohibitedStates.includes(duck.state)) return false;
    
    // Filter out ducks in dog's mouth (indicated by state 'single' or 'double')
    // These are not separate duck objects but states of the dog animation
    // We detect them by checking if they're being retrieved
    if (duck.inDogsMouth) return false;
    
    return true;
  });
}

/**
 * Find closest valid duck to crosshair
 */
function findClosestDuck(ducks, crosshairPos) {
  const validDucks = getValidDucks(ducks);
  
  if (validDucks.length === 0) {
    return { duck: null, distance: Infinity };
  }

  let closest = null;
  let minDistance = Infinity;

  validDucks.forEach(duck => {
    const dist = Math.hypot(
      (duck.x || 0) - crosshairPos.x,
      (duck.y || 0) - crosshairPos.y
    );
    
    if (dist < minDistance) {
      minDistance = dist;
      closest = duck;
    }
  });

  return { duck: closest, distance: minDistance };
}

/**
 * Estimate velocity from position history
 */
function estimateDuckVelocity(duckId, currentPos) {
  const lastPos = workerState.lastDuckPositions.get(duckId);

  if (!lastPos) {
    workerState.lastDuckPositions.set(duckId, { 
      x: currentPos.x, 
      y: currentPos.y,
      timestamp: Date.now()
    });
    return { vx: 0, vy: 0 };
  }

  const vx = currentPos.x - lastPos.x;
  const vy = currentPos.y - lastPos.y;

  workerState.lastDuckPositions.set(duckId, { 
    x: currentPos.x, 
    y: currentPos.y,
    timestamp: Date.now()
  });

  return { vx, vy };
}

/**
 * Predict future position of duck (lead aiming)
 */
function predictDuckPosition(duck, velocity, framesAhead) {
  return {
    x: duck.x + (velocity.vx * framesAhead),
    y: duck.y + (velocity.vy * framesAhead)
  };
}

/**
 * Clamp position to valid range (normalized 0-1)
 */
function clampToNormalized(pos, screenWidth, screenHeight) {
  return {
    x: Math.max(0, Math.min(1, pos.x / screenWidth)),
    y: Math.max(0, Math.min(1, pos.y / screenHeight))
  };
}

/**
 * Calculate smooth crosshair target position
 */
function calculateCrosshairTarget(frameState) {
  const validDucks = getValidDucks(frameState.ducks);
  
  if (validDucks.length === 0) {
    // No valid targets - keep current crosshair position
    return frameState.crosshair;
  }

  const crosshairPos = {
    x: frameState.crosshair.x,
    y: frameState.crosshair.y
  };

  const { duck: closestDuck } = findClosestDuck(frameState.ducks, crosshairPos);

  if (!closestDuck) {
    return crosshairPos;
  }

  // Estimate velocity for lead aiming
  const velocity = estimateDuckVelocity(closestDuck.id, {
    x: closestDuck.x,
    y: closestDuck.y
  });

  // Predict where duck will be in the future
  const predictedPos = predictDuckPosition(closestDuck, velocity, CONFIG.LEAD_TIME_FRAMES);

  // Clamp to screen bounds (but work in absolute coordinates during calculation)
  const targetPos = {
    x: Math.max(0, Math.min(frameState.screenWidth, predictedPos.x)),
    y: Math.max(0, Math.min(frameState.screenHeight, predictedPos.y))
  };

  // Apply smoothing to crosshair movement (smooth interpolation)
  const smoothedTarget = {
    x: crosshairPos.x + (targetPos.x - crosshairPos.x) * workerState.smoothingFactor,
    y: crosshairPos.y + (targetPos.y - crosshairPos.y) * workerState.smoothingFactor
  };

  return smoothedTarget;
}

/**
 * Determine if AI should fire
 */
function shouldFire(frameState, targetPos) {
  const validDucks = getValidDucks(frameState.ducks);
  
  if (validDucks.length === 0) {
    return false;
  }

  if (frameState.ammo <= 0 || frameState.paused) {
    return false;
  }

  const { duck: closestDuck } = findClosestDuck(frameState.ducks, frameState.crosshair);

  if (!closestDuck) {
    return false;
  }

  // Distance from crosshair center to duck
  const dist = Math.hypot(
    frameState.crosshair.x - closestDuck.x,
    frameState.crosshair.y - closestDuck.y
  );

  // Calculate confidence (1.0 = duck directly at crosshair center)
  const confidence = Math.max(0, 1 - (dist / frameState.crosshair.radius));

  // Get fire score from learning model
  const gameState = {
    closestDuck,
    closestDuckVelocity: estimateDuckVelocity(closestDuck.id, closestDuck),
    crosshairX: frameState.crosshair.x,
    crosshairY: frameState.crosshair.y,
    crosshairRadius: frameState.crosshair.radius,
    duckCount: validDucks.length
  };

  const fireScore = workerState.learningModel.getFireScore(gameState);

  // Fire decision: duck must be reasonably close and learning model must agree
  const shouldFireResult = confidence > CONFIG.CONFIDENCE_THRESHOLD && fireScore > 0;

  return shouldFireResult;
}


/**
 * Handle FRAME_STATE message from main thread
 * Receives current game state and updates AI targeting
 */
function handleFrameState(frameState) {
  workerState.lastFrameState = frameState;
  workerState.frameCount += 1;

  // Update screen dimensions if provided
  if (frameState.screenWidth && frameState.screenHeight) {
    workerState.screenDimensions = {
      width: frameState.screenWidth,
      height: frameState.screenHeight
    };
  }

  // Update duck speed and recalculate smoothing factor
  if (frameState.duckSpeed !== undefined && frameState.duckSpeed !== null) {
    workerState.duckSpeed = frameState.duckSpeed;
    workerState.smoothingFactor = calculateSmoothingFactor(frameState.duckSpeed);
  }

  // Calculate next crosshair target
  const targetPos = calculateCrosshairTarget(frameState);
  workerState.crosshairTarget = targetPos;

  // Determine if should fire
  const fireIntent = shouldFire(frameState, targetPos);
  workerState.fireDecision = fireIntent;

  // Calculate confidence metric
  const validDucks = getValidDucks(frameState.ducks);
  
  if (validDucks.length > 0) {
    const { duck: closestDuck } = findClosestDuck(frameState.ducks, frameState.crosshair);
    if (closestDuck) {
      const dist = Math.hypot(
        frameState.crosshair.x - closestDuck.x,
        frameState.crosshair.y - closestDuck.y
      );
      workerState.confidence = Math.max(0, 1 - (dist / frameState.crosshair.radius));
    }
  } else {
    workerState.confidence = 0;
  }

  // Record activity for learning
  workerState.learningModel.recordActivity({
    timestamp: frameState.timestamp,
    duckCount: validDucks.length,
    distance: workerState.confidence > 0 ? frameState.crosshair.radius * (1 - workerState.confidence) : 999,
    fireIntent
  });

  // Send aim action back to main thread
  self.postMessage({
    type: 'AIM_ACTION',
    target: {
      x: targetPos.x,
      y: targetPos.y
    },
    fireIntent: fireIntent,
    confidence: workerState.confidence,
    validDuckCount: validDucks.length,
    timestamp: frameState.timestamp
  });
}

/**
 * Handle SHOT_RESULT message from main thread (feedback for reinforcement learning)
 */
function handleShotResult(shotResult) {
  // Update learning model with reward signal
  workerState.learningModel.updateWeights(shotResult.reward);

  // Debug logging
  if (IS_DEBUG) {
    if (shotResult.reward > 0) {
      console.log(`[Worker AUTO_AIM] Hit! Reward: ${shotResult.reward}, Ducks: ${shotResult.totalDucks}`);
    } else if (shotResult.reward < 0) {
      console.log(`[Worker AUTO_AIM] Miss! Reward: ${shotResult.reward}`);
    }
  }
}

/**
 * Message event listener - worker receives messages from main thread
 */
self.onmessage = function (event) {
  const message = event.data;

  if (message.type === 'FRAME_STATE') {
    handleFrameState(message);
  } else if (message.type === 'SHOT_RESULT') {
    handleShotResult(message);
  } else if (message.type === 'INIT') {
    console.log('[Worker AUTO_AIM] Initialized');
  }
};

// Signal that worker is ready
self.postMessage({
  type: 'WORKER_READY'
});
