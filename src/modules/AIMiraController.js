/**
 * AIMiraController.js
 * Orchestrates communication between main thread and AI Aim Worker
 * Manages crosshair positioning and automatic firing decisions
 */

class AIMiraController {
  constructor(opts = {}) {
    this.enabled = false;
    this.mode = null;
    this.worker = null;
    this.workerReady = false;

    this.currentTarget = { x: 400, y: 300 };
    this.fireIntent = false;
    this.confidence = 0;
    this.lastTimestamp = 0;

    this.onAimAction = opts.onAimAction || (() => {});
    this.onFireIntent = opts.onFireIntent || (() => {});

    // Message queue for when worker isn't ready
    this.messageQueue = [];

    // Worker path - will be copied to dist/workers by webpack
    this.workerPath = opts.workerPath || 'workers/AIAimWorker.js';

    // Initialize worker if requested
    if (opts.autoInit) {
      this.initWorker();
    }
  }

  /**
   * Initialize the Web Worker
   */
  initWorker() {
    if (this.worker) {
      return; // Already initialized
    }

    try {
      this.worker = new Worker(this.workerPath);

      // Set up message handler
      this.worker.onmessage = (event) => {
        this.handleWorkerMessage(event.data);
      };

      // Error handler
      this.worker.onerror = (error) => {
        console.error('[AIMiraController] Worker error:', error);
      };

    } catch (error) {
      console.error('[AIMiraController] Failed to create worker:', error);
    }
  }

  /**
   * Handle messages from the worker
   */
  handleWorkerMessage(message) {
    if (message.type === 'WORKER_READY') {
      this.workerReady = true;
      console.log('[AIMiraController] Worker ready');

      // Send any queued messages
      while (this.messageQueue.length > 0) {
        const queuedMsg = this.messageQueue.shift();
        this.worker.postMessage(queuedMsg);
      }
    } else if (message.type === 'AIM_ACTION') {
      this.handleAimAction(message);
    }
  }

  /**
   * Handle aim action from worker
   */
  handleAimAction(action) {
    this.currentTarget = { x: action.target.x, y: action.target.y };
    this.fireIntent = action.fireIntent;
    this.confidence = action.confidence;
    this.lastTimestamp = action.timestamp;

    // Invoke callback for main game to apply the aim
    if (this.onAimAction) {
      this.onAimAction({
        target: this.currentTarget,
        fireIntent: this.fireIntent,
        confidence: this.confidence
      });
    }

    // Invoke fire callback if intent is true
    if (this.fireIntent && this.onFireIntent) {
      this.onFireIntent();
    }
  }

  /**
   * Enable the AI controller
   */
  enable(mode) {
    if (!this.worker) {
      this.initWorker();
    }

    this.enabled = true;
    this.mode = mode;
  }

  /**
   * Disable the AI controller
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Send frame state to worker
   */
  sendFrameState(frameState) {
    if (!this.enabled || !this.worker) {
      return;
    }

    const message = {
      type: 'FRAME_STATE',
      timestamp: frameState.timestamp || Date.now(),
      ducks: frameState.ducks || [],
      crosshair: frameState.crosshair || { x: 400, y: 300, radius: 60 },
      screenWidth: frameState.screenWidth || 800,
      screenHeight: frameState.screenHeight || 600,
      duckSpeed: frameState.duckSpeed || 5,
      ammo: frameState.ammo || 0,
      paused: frameState.paused || false
    };

    if (this.workerReady) {
      this.worker.postMessage(message);
    } else {
      this.messageQueue.push(message);
    }
  }

  /**
   * Send shot result feedback to worker for learning
   */
  sendShotResult(hits, totalDucks, wave, isDoubleHit = false) {
    if (!this.enabled || !this.worker) {
      return;
    }

    // Calculate reward
    let reward = 0;
    if (hits > 0) {
      reward = hits; // +1 for each hit
      if (isDoubleHit && hits === 2) {
        reward = 2; // Double hit bonus
      }
    } else {
      reward = -1; // Penalty for miss
    }

    const message = {
      type: 'SHOT_RESULT',
      hits: hits,
      totalDucks: totalDucks,
      reward: reward,
      wave: wave,
      timestamp: Date.now()
    };

    if (this.workerReady) {
      this.worker.postMessage(message);
    }
  }

  /**
   * Get current target position
   */
  getTarget() {
    return { ...this.currentTarget };
  }

  /**
   * Get current fire intent
   */
  getFireIntent() {
    return this.fireIntent;
  }

  /**
   * Get current confidence level
   */
  getConfidence() {
    return this.confidence;
  }

  /**
   * Terminate the worker
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.workerReady = false;
    }
    this.enabled = false;
  }
}

export default AIMiraController;
