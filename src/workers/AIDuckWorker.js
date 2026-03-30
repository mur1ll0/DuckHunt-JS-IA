const TICK_HZ = 15;
const PERSIST_EVERY_MS = 8000;
const POPULATION_SIZE = 24;
const ELITE_COUNT = 4;
const MUTATION_RATE = 0.2;
const MUTATION_STRENGTH = 0.18;
const DEFAULT_STATE = {
  generation: 0,
  champion: null,
  population: []
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min, max) {
  return min + (Math.random() * (max - min));
}

function createGenome() {
  return {
    repulsionWeight: randomRange(0.6, 2.2),
    inertiaWeight: randomRange(0.2, 1.1),
    edgeWeight: randomRange(0.2, 1.6),
    zigzagWeight: randomRange(0.0, 0.8),
    turnClamp: randomRange(0.12, 0.5),
    predictionHorizon: randomRange(0.2, 0.9),
    speedBias: randomRange(0.85, 1.2)
  };
}

function cloneGenome(genome) {
  return {
    repulsionWeight: genome.repulsionWeight,
    inertiaWeight: genome.inertiaWeight,
    edgeWeight: genome.edgeWeight,
    zigzagWeight: genome.zigzagWeight,
    turnClamp: genome.turnClamp,
    predictionHorizon: genome.predictionHorizon,
    speedBias: genome.speedBias
  };
}

function mutateGenome(genome) {
  const next = cloneGenome(genome);
  const keys = Object.keys(next);
  for (let i = 0; i < keys.length; i++) {
    if (Math.random() < MUTATION_RATE) {
      const key = keys[i];
      next[key] += randomRange(-MUTATION_STRENGTH, MUTATION_STRENGTH);
    }
  }

  next.repulsionWeight = clamp(next.repulsionWeight, 0.4, 3.0);
  next.inertiaWeight = clamp(next.inertiaWeight, 0.1, 1.6);
  next.edgeWeight = clamp(next.edgeWeight, 0.1, 2.2);
  next.zigzagWeight = clamp(next.zigzagWeight, 0.0, 1.4);
  next.turnClamp = clamp(next.turnClamp, 0.05, 0.8);
  next.predictionHorizon = clamp(next.predictionHorizon, 0.1, 1.4);
  next.speedBias = clamp(next.speedBias, 0.7, 1.35);

  return next;
}

function crossoverGenome(a, b) {
  const child = {};
  const keys = Object.keys(a);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    child[key] = Math.random() < 0.5 ? a[key] : b[key];
  }
  return mutateGenome(child);
}

function createPopulation() {
  const population = [];
  for (let i = 0; i < POPULATION_SIZE; i++) {
    population.push({
      genome: createGenome(),
      fitness: 0,
      samples: 0
    });
  }
  return population;
}

function sanitizePopulation(population) {
  if (!Array.isArray(population) || population.length === 0) {
    return createPopulation();
  }

  const sanitized = [];
  for (let i = 0; i < population.length; i++) {
    const row = population[i] || {};
    const genome = row.genome ? mutateGenome(row.genome) : createGenome();
    sanitized.push({
      genome,
      fitness: Number.isFinite(row.fitness) ? row.fitness : 0,
      samples: Number.isFinite(row.samples) ? row.samples : 0
    });
  }

  while (sanitized.length < POPULATION_SIZE) {
    sanitized.push({ genome: createGenome(), fitness: 0, samples: 0 });
  }

  return sanitized.slice(0, POPULATION_SIZE);
}

const state = {
  workerReady: false,
  generation: 0,
  population: createPopulation(),
  champion: null,
  duckGenomeIndex: new Map(),
  duckEpisode: new Map(),
  lastCrosshair: { x: 400, y: 300, timestamp: 0 },
  frameCounter: 0,
  lastDecisionTs: 0,
  debugEnabled: false,
  lastPersistTs: 0,
  tickIntervalMs: 1000 / TICK_HZ
};

function genomeForDuck(duckId) {
  if (!state.duckGenomeIndex.has(duckId)) {
    const index = Math.floor(Math.random() * state.population.length);
    state.duckGenomeIndex.set(duckId, index);
  }

  const genomeIndex = state.duckGenomeIndex.get(duckId);
  return state.population[genomeIndex].genome;
}

function episodeForDuck(duckId) {
  if (!state.duckEpisode.has(duckId)) {
    state.duckEpisode.set(duckId, {
      jitterPenalty: 0,
      stagnantPenalty: 0,
      lastAction: { x: 0, y: -1 },
      lifeTicks: 0
    });
  }
  return state.duckEpisode.get(duckId);
}

function normalize(vx, vy) {
  const length = Math.hypot(vx, vy) || 1;
  return { x: vx / length, y: vy / length };
}

function accumulateFitness(duckId, deltaFitness) {
  const genomeIndex = state.duckGenomeIndex.get(duckId);
  if (!Number.isFinite(genomeIndex)) {
    return;
  }

  const individual = state.population[genomeIndex];
  individual.fitness += deltaFitness;
  individual.samples += 1;
}

function evolvePopulation() {
  const ranked = state.population.slice().sort((a, b) => {
    const scoreA = a.samples > 0 ? a.fitness / a.samples : -9999;
    const scoreB = b.samples > 0 ? b.fitness / b.samples : -9999;
    return scoreB - scoreA;
  });

  const champion = ranked[0];
  if (champion) {
    state.champion = {
      genome: cloneGenome(champion.genome),
      score: champion.samples > 0 ? champion.fitness / champion.samples : 0
    };
  }

  const nextPopulation = [];

  for (let i = 0; i < ELITE_COUNT; i++) {
    nextPopulation.push({
      genome: cloneGenome(ranked[i].genome),
      fitness: 0,
      samples: 0
    });
  }

  while (nextPopulation.length < POPULATION_SIZE) {
    const parentA = ranked[Math.floor(Math.random() * Math.min(8, ranked.length))].genome;
    const parentB = ranked[Math.floor(Math.random() * Math.min(8, ranked.length))].genome;
    nextPopulation.push({
      genome: crossoverGenome(parentA, parentB),
      fitness: 0,
      samples: 0
    });
  }

  state.population = nextPopulation;
  state.generation += 1;
  state.duckGenomeIndex.clear();
  state.duckEpisode.clear();
}

function shouldEvolve() {
  let totalSamples = 0;
  for (let i = 0; i < state.population.length; i++) {
    totalSamples += state.population[i].samples;
  }
  return totalSamples >= POPULATION_SIZE * 3;
}

function maybePersist(now) {
  if (now - state.lastPersistTs < PERSIST_EVERY_MS) {
    return;
  }

  state.lastPersistTs = now;
  self.postMessage({
    type: 'DUCK_PERSIST',
    payload: {
      generation: state.generation,
      champion: state.champion,
      population: state.population
    }
  });
}

function emitDebug(now) {
  if (!state.debugEnabled) {
    return;
  }

  const scores = state.population
    .map((p) => (p.samples > 0 ? p.fitness / p.samples : 0))
    .sort((a, b) => b - a);

  let totalSamples = 0;
  for (let i = 0; i < state.population.length; i++) {
    totalSamples += state.population[i].samples;
  }

  self.postMessage({
    type: 'DUCK_DEBUG',
    timestamp: now,
    generation: state.generation,
    bestFitness: scores.length > 0 ? scores[0] : 0,
    medianFitness: scores.length > 0 ? scores[Math.floor(scores.length / 2)] : 0,
    totalSamples,
    aliveDucks: state.duckGenomeIndex.size,
    champion: state.champion
  });
}

function getCrosshairVelocity(crosshair, timestamp) {
  const previous = state.lastCrosshair;
  const dtMs = Math.max(1, timestamp - (previous.timestamp || timestamp));

  const velocity = {
    vx: (crosshair.x - previous.x) / dtMs,
    vy: (crosshair.y - previous.y) / dtMs
  };

  state.lastCrosshair = {
    x: crosshair.x,
    y: crosshair.y,
    timestamp
  };

  return velocity;
}

function edgeForce(duck, bounds) {
  const margin = 90;
  let fx = 0;
  let fy = 0;

  if (duck.x < bounds.minX + margin) {
    fx += (bounds.minX + margin - duck.x) / margin;
  }
  if (duck.x > bounds.maxX - margin) {
    fx -= (duck.x - (bounds.maxX - margin)) / margin;
  }
  if (duck.y < bounds.minY + margin) {
    fy += (bounds.minY + margin - duck.y) / margin;
  }
  if (duck.y > bounds.maxY - margin) {
    fy -= (duck.y - (bounds.maxY - margin)) / margin;
  }

  return { fx, fy };
}

function buildActionForDuck(duck, crosshair, bounds, crosshairVelocity, timestamp) {
  const genome = genomeForDuck(duck.id);
  const episode = episodeForDuck(duck.id);

  const predictedCrosshair = {
    x: crosshair.x + (crosshairVelocity.vx * 1000 * genome.predictionHorizon),
    y: crosshair.y + (crosshairVelocity.vy * 1000 * genome.predictionHorizon)
  };

  const away = normalize(duck.x - predictedCrosshair.x, duck.y - predictedCrosshair.y);
  const inertia = normalize(duck.vx || episode.lastAction.x, duck.vy || episode.lastAction.y);
  const edge = edgeForce(duck, bounds);
  const zigzagPhase = Math.sin((timestamp / 180) + (duck.id.length * 0.3));
  const zigzag = {
    x: -away.y * zigzagPhase,
    y: away.x * zigzagPhase
  };

  let dirX = 0;
  let dirY = 0;

  dirX += away.x * genome.repulsionWeight;
  dirY += away.y * genome.repulsionWeight;

  dirX += inertia.x * genome.inertiaWeight;
  dirY += inertia.y * genome.inertiaWeight;

  dirX += edge.fx * genome.edgeWeight;
  dirY += edge.fy * genome.edgeWeight;

  dirX += zigzag.x * genome.zigzagWeight;
  dirY += zigzag.y * genome.zigzagWeight;

  const normalized = normalize(dirX, dirY);
  const clampedDir = {
    x: clamp(normalized.x, episode.lastAction.x - genome.turnClamp, episode.lastAction.x + genome.turnClamp),
    y: clamp(normalized.y, episode.lastAction.y - genome.turnClamp, episode.lastAction.y + genome.turnClamp)
  };
  const finalDir = normalize(clampedDir.x, clampedDir.y);

  episode.lifeTicks += 1;
  episode.jitterPenalty += Math.abs(finalDir.x - episode.lastAction.x) + Math.abs(finalDir.y - episode.lastAction.y);

  if (Math.hypot(duck.vx || 0, duck.vy || 0) < 0.08) {
    episode.stagnantPenalty += 0.4;
  }

  episode.lastAction = finalDir;

  const targetX = clamp(duck.x + (finalDir.x * 140), bounds.minX, bounds.maxX);
  const targetY = clamp(duck.y + (finalDir.y * 120), bounds.minY, bounds.maxY);

  return {
    id: duck.id,
    targetX,
    targetY,
    speed: clamp(genome.speedBias, 0.75, 1.3)
  };
}

function handleDuckState(message) {
  const now = message.timestamp || Date.now();
  const crosshair = message.crosshair || { x: 400, y: 300 };
  const ducks = Array.isArray(message.ducks) ? message.ducks.filter((duck) => duck && duck.alive) : [];
  const bounds = message.bounds || {
    minX: 0,
    maxX: 800,
    minY: 0,
    maxY: 430
  };

  if (state.lastDecisionTs > 0 && (now - state.lastDecisionTs) < state.tickIntervalMs) {
    return;
  }

  state.lastDecisionTs = now;
  state.frameCounter += 1;
  const crosshairVelocity = getCrosshairVelocity(crosshair, now);

  const actions = [];
  for (let i = 0; i < ducks.length; i++) {
    actions.push(buildActionForDuck(ducks[i], crosshair, bounds, crosshairVelocity, now));
  }

  self.postMessage({
    type: 'DUCK_ACTION',
    actions,
    timestamp: now
  });

  if (shouldEvolve()) {
    evolvePopulation();
  }

  maybePersist(now);
  emitDebug(now);
}

function handleDuckReward(message) {
  const duckId = message.duckId;
  if (!duckId) {
    return;
  }

  const survivedMs = Number.isFinite(message.survivedMs) ? message.survivedMs : 0;
  const shot = !!message.shot;
  const shapedReward = Number.isFinite(message.reward) ? message.reward : 0;
  const episode = episodeForDuck(duckId);

  let fitness = 0;
  fitness += survivedMs / 6000;
  fitness += shot ? -4.5 : 0.9;
  fitness += shapedReward;
  fitness -= Math.min(2.4, episode.jitterPenalty * 0.05);
  fitness -= Math.min(2.0, episode.stagnantPenalty * 0.03);

  accumulateFitness(duckId, fitness);

  if (shot) {
    state.duckEpisode.delete(duckId);
    state.duckGenomeIndex.delete(duckId);
  }
}

function handleInit(message) {
  const payload = message.payload || DEFAULT_STATE;
  state.generation = Number.isFinite(payload.generation) ? payload.generation : 0;
  state.population = sanitizePopulation(payload.population);
  state.champion = payload.champion || null;
  state.debugEnabled = !!message.debug;

  self.postMessage({
    type: 'WORKER_READY',
    generation: state.generation,
    hasChampion: !!state.champion
  });
}

self.onmessage = function(event) {
  const message = event.data || {};

  if (message.type === 'INIT') {
    handleInit(message);
    return;
  }

  if (message.type === 'DUCK_STATE') {
    handleDuckState(message);
    return;
  }

  if (message.type === 'DUCK_REWARD') {
    handleDuckReward(message);
    return;
  }

  if (message.type === 'SET_DEBUG') {
    state.debugEnabled = !!message.enabled;
    return;
  }

  if (message.type === 'FORCE_EVOLVE') {
    evolvePopulation();
    emitDebug(Date.now());
  }
};
