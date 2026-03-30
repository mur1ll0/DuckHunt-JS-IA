const STORAGE_KEY = 'duckhunt.duck_ai.ga_state.v1';

class AIDuckController {
  constructor(opts = {}) {
    this.enabled = false;
    this.worker = null;
    this.workerReady = false;
    this.messageQueue = [];
    this.workerPath = opts.workerPath || 'workers/AIDuckWorker.js';

    this.onDuckActions = opts.onDuckActions || (() => {});
    this.onDebugUpdate = opts.onDebugUpdate || (() => {});

    this.debugEnabled = !!opts.debugEnabled;
    this.lastSentTs = 0;
    this.sendIntervalMs = opts.sendIntervalMs || 65;
  }

  initWorker() {
    if (this.worker) {
      return;
    }

    this.worker = new Worker(this.workerPath);
    this.worker.onmessage = (event) => this.handleWorkerMessage(event.data);
    this.worker.onerror = (error) => {
      console.error('[AIDuckController] Worker error:', error);
    };

    this.send({
      type: 'INIT',
      payload: this.loadState(),
      debug: this.debugEnabled
    });
  }

  enable() {
    if (!this.worker) {
      this.initWorker();
    }

    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.workerReady = false;
    this.enabled = false;
    this.messageQueue = [];
  }

  setDebug(enabled) {
    this.debugEnabled = !!enabled;
    this.send({
      type: 'SET_DEBUG',
      enabled: this.debugEnabled
    });
  }

  forceEvolve() {
    this.send({
      type: 'FORCE_EVOLVE'
    });
  }

  sendDuckState(frameState) {
    if (!this.enabled) {
      return;
    }

    const now = frameState.timestamp || Date.now();
    if (now - this.lastSentTs < this.sendIntervalMs) {
      return;
    }

    this.lastSentTs = now;

    this.send({
      type: 'DUCK_STATE',
      timestamp: now,
      deltaMs: frameState.deltaMs || this.sendIntervalMs,
      crosshair: frameState.crosshair,
      ducks: frameState.ducks,
      bounds: frameState.bounds
    });
  }

  sendDuckReward(rewardState) {
    if (!this.enabled) {
      return;
    }

    this.send({
      type: 'DUCK_REWARD',
      duckId: rewardState.duckId,
      survivedMs: rewardState.survivedMs,
      shot: !!rewardState.shot,
      reward: rewardState.reward
    });
  }

  send(message) {
    if (!this.worker) {
      return;
    }

    if (this.workerReady || message.type === 'INIT') {
      this.worker.postMessage(message);
      return;
    }

    this.messageQueue.push(message);
  }

  handleWorkerMessage(message) {
    if (!message || !message.type) {
      return;
    }

    if (message.type === 'WORKER_READY') {
      this.workerReady = true;
      while (this.messageQueue.length > 0) {
        this.worker.postMessage(this.messageQueue.shift());
      }
      return;
    }

    if (message.type === 'DUCK_ACTION') {
      this.onDuckActions({
        actions: message.actions || [],
        timestamp: message.timestamp || Date.now()
      });
      return;
    }

    if (message.type === 'DUCK_PERSIST') {
      this.saveState(message.payload);
      return;
    }

    if (message.type === 'DUCK_DEBUG') {
      this.onDebugUpdate(message);
    }
  }

  loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {
          generation: 0,
          champion: null,
          population: []
        };
      }

      const parsed = JSON.parse(raw);
      return {
        generation: Number.isFinite(parsed.generation) ? parsed.generation : 0,
        champion: parsed.champion || null,
        population: Array.isArray(parsed.population) ? parsed.population : []
      };
    } catch (error) {
      console.warn('[AIDuckController] Failed to load saved GA state:', error);
      return {
        generation: 0,
        champion: null,
        population: []
      };
    }
  }

  saveState(payload) {
    if (!payload) {
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('[AIDuckController] Failed to persist GA state:', error);
    }
  }
}

export default AIDuckController;
