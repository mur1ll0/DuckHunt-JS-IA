import {Assets, autoDetectRenderer} from 'pixi.js';
import {remove as _remove} from 'lodash/array';
import levels from '../data/levels.json';
import Stage from './Stage';
import sound from './Sound';
import levelCreator from '../libs/levelCreator.js';
import utils from '../libs/utils';
import MainMenu from './MainMenu';
import AIMiraController from './AIMiraController';
import AIDuckController from './AIDuckController';
import {MOVEMENT_MODE} from './Duck';

const BLUE_SKY_COLOR = 0x64b0ff;
const PINK_SKY_COLOR = 0xfbb4d4;
const SUCCESS_RATIO = 0.6;
const BOTTOM_LINK_STYLE = {
  fontFamily: 'Arial',
  fontSize: '15px',
  align: 'left',
  fill: 'white'
};

class Game {
  /**
   * Game Constructor
   * @param opts
   * @param {String} opts.spritesheet Path to the spritesheet file that PIXI's loader should load
   * @returns {Game}
   */
  constructor(opts) {
    this.spritesheet = opts.spritesheet;
    this.levelIndex = 0;
    this.maxScore = 0;
    this.timePaused = 0;
    this.muted = false;
    this.paused = false;
    this.activeSounds = [];

    this.waveEnding = false;
    this.quackingSoundId = null;
    this.levels = levels.normal;
    this.activeModes = {
      autoAim: false,
      duckAI: false
    };
    this.menuActive = true;
    this.mainMenu = null;

    // AI Aim Controller for IA_GUIDED and AUTO_AIM modes
    this.aiController = new AIMiraController({
      autoInit: false,
      onAimAction: this.handleAIAiming.bind(this),
      onFireIntent: this.handleAIFire.bind(this)
    });

    this.duckAIController = new AIDuckController({
      debugEnabled: this.readDuckAIDebugFlag(),
      onDuckActions: this.handleDuckAIActions.bind(this),
      onDebugUpdate: this.handleDuckAIDebug.bind(this)
    });
    this.duckAIActions = [];
    this.duckAIDebug = null;
    this.duckAIDebugEnabled = this.readDuckAIDebugFlag();
    this.lastAnimationTimestamp = Date.now();
    this.lastCrosshairState = {
      x: 0,
      y: 0,
      timestamp: Date.now()
    };
    this.lastShotHits = 0;
    this.lastShotWasPerfectDouble = false;

    return this;
  }

  get ducksMissed() {
    return this.ducksMissedVal ? this.ducksMissedVal : 0;
  }

  set ducksMissed(val) {
    this.ducksMissedVal = val;

    if (this.stage && this.stage.hud) {

      if (!Object.prototype.hasOwnProperty.call(this.stage.hud,'ducksMissed')) {
        this.stage.hud.createTextureBasedCounter('ducksMissed', {
          texture: 'hud/score-live/0.png',
          spritesheet: this.spritesheet,
          location: Stage.missedDuckStatusBoxLocation(),
          rowMax: 20,
          max: 20
        });
      }

      this.stage.hud.ducksMissed = val;
    }
  }

  get ducksShot() {
    return this.ducksShotVal ? this.ducksShotVal : 0;
  }

  set ducksShot(val) {
    this.ducksShotVal = val;

    if (this.stage && this.stage.hud) {

      if (!Object.prototype.hasOwnProperty.call(this.stage.hud,'ducksShot')) {
        this.stage.hud.createTextureBasedCounter('ducksShot', {
          texture: 'hud/score-dead/0.png',
          spritesheet: this.spritesheet,
          location: Stage.deadDuckStatusBoxLocation(),
          rowMax:20,
          max: 20
        });
      }

      this.stage.hud.ducksShot = val;
    }
  }
  /**
   * bullets - getter
   * @returns {Number}
   */
  get bullets() {
    return this.bulletVal ? this.bulletVal : 0;
  }

  /**
   * bullets - setter
   * Setter for the bullets property of the game. Also in charge of updating the HUD. In the event
   * the HUD doesn't know about displaying bullets, the property and a corresponding texture container
   * will be created in HUD.
   * @param {Number} val Number of bullets
   */
  set bullets(val) {
    this.bulletVal = val;

    if (this.stage && this.stage.hud) {

      if (!Object.prototype.hasOwnProperty.call(this.stage.hud,'bullets')) {
        this.stage.hud.createTextureBasedCounter('bullets', {
          texture: 'hud/bullet/0.png',
          spritesheet: this.spritesheet,
          location: Stage.bulletStatusBoxLocation(),
          max: 80,
          rowMax: 20
        });
      }

      this.stage.hud.bullets = val;
    }

  }

  /**
   * score - getter
   * @returns {Number}
   */
  get score() {
    return this.scoreVal ? this.scoreVal : 0;
  }

  /**
   * score - setter
   * Setter for the score property of the game. Also in charge of updating the HUD. In the event
   * the HUD doesn't know about displaying the score, the property and a corresponding text box
   * will be created in HUD.
   * @param {Number} val Score value to set
   */
  set score(val) {
    this.scoreVal = val;

    if (this.stage && this.stage.hud) {

      if (!Object.prototype.hasOwnProperty.call(this.stage.hud,'score')) {
        this.stage.hud.createTextBox('score', {
          style: {
            fontFamily: 'Arial',
            fontSize: '18px',
            align: 'left',
            fill: 'white'
          },
          location: Stage.scoreBoxLocation(),
          anchor: {
            x: 1,
            y: 0
          }
        });
      }

      this.stage.hud.score = val;
    }

  }

  /**
   * wave - get
   * @returns {Number}
   */
  get wave() {
    return this.waveVal ? this.waveVal : 0;
  }

  /**
   * wave - set
   * Setter for the wave property of the game. Also in charge of updating the HUD. In the event
   * the HUD doesn't know about displaying the wave, the property and a corresponding text box
   * will be created in the HUD.
   * @param {Number} val
   */
  set wave(val) {
    this.waveVal = val;

    if (this.stage && this.stage.hud) {

      if (!Object.prototype.hasOwnProperty.call(this.stage.hud,'waveStatus')) {
        this.stage.hud.createTextBox('waveStatus', {
          style: {
            fontFamily: 'Arial',
            fontSize: '14px',
            align: 'center',
            fill: 'white'
          },
          location: Stage.waveStatusBoxLocation(),
          anchor: {
            x: 1,
            y: 1
          }
        });
      }

      if (!isNaN(val) && val > 0) {
        this.stage.hud.waveStatus = 'wave ' + val + ' of ' + this.level.waves;
      } else {
        this.stage.hud.waveStatus = '';
      }
    }
  }

  /**
   * gameStatus - get
   * @returns {String}
   */
  get gameStatus() {
    return this.gameStatusVal ? this.gameStatusVal : '';
  }

  /**
   * gameStatus - set
   * @param {String} val
   */
  set gameStatus(val) {
    this.gameStatusVal = val;

    if (this.stage && this.stage.hud) {

      if (!Object.prototype.hasOwnProperty.call(this.stage.hud,'gameStatus')) {
        this.stage.hud.createTextBox('gameStatus', {
          style: {
            fontFamily: 'Arial',
            fontSize: '40px',
            align: 'left',
            fill: 'white'
          },
          location: Stage.gameStatusBoxLocation()
        });
      }

      this.stage.hud.gameStatus = val;
    }
  }

  async load() {
    this.renderer = await autoDetectRenderer({
      width: window.innerWidth,
      height: window.innerHeight,
      background: BLUE_SKY_COLOR
    });
    await Assets.load(this.spritesheet);
    this.onLoad();
  }

  onLoad() {
    document.body.appendChild(this.renderer.canvas);

    this.stage = new Stage({
      spritesheet: this.spritesheet
    });

    this.scaleToWindow();
    this.addMenuLink();
    this.addLinkToLevelCreator();
    this.addPauseLink();
    this.addMuteLink();
    this.addFullscreenLink();
    this.addModeStatus();
    this.addDuckAIDebugPanel();
    this.bindEvents();
    this.openMainMenu();
    this.animate();

  }

  addModeStatus() {
    this.stage.hud.createTextBox('modeStatus', {
      style: BOTTOM_LINK_STYLE,
      location: Stage.modeStatusBoxLocation(),
      anchor: {
        x: 0,
        y: 1
      }
    });
    this.stage.hud.modeStatus = 'mode: not selected';
  }

  addDuckAIDebugPanel() {
    this.stage.hud.createTextBox('duckAIDebugPanel', {
      style: {
        fontFamily: 'Arial',
        fontSize: '14px',
        align: 'right',
        fill: '#e7f6ff'
      },
      location: {
        x: 790,
        y: 44
      },
      anchor: {
        x: 1,
        y: 0
      }
    });
    this.stage.hud.duckAIDebugPanel = '';
  }

  addMenuLink() {
    this.stage.hud.createTextBox('menuLink', {
      style: BOTTOM_LINK_STYLE,
      location: Stage.menuLinkBoxLocation(),
      anchor: {
        x: 1,
        y: 1
      }
    });
    this.stage.hud.menuLink = 'menu (esc)';
  }

  addFullscreenLink() {
    this.stage.hud.createTextBox('fullscreenLink', {
      style: BOTTOM_LINK_STYLE,
      location: Stage.fullscreenLinkBoxLocation(),
      anchor: {
        x: 1,
        y: 1
      }
    });
    this.stage.hud.fullscreenLink = 'fullscreen (f)';
  }
  addMuteLink() {
    this.stage.hud.createTextBox('muteLink', {
      style: BOTTOM_LINK_STYLE,
      location: Stage.muteLinkBoxLocation(),
      anchor: {
        x: 1,
        y: 1
      }
    });
    this.stage.hud.muteLink = 'mute (m)';
  }

  addPauseLink() {
    this.stage.hud.createTextBox('pauseLink', {
      style: BOTTOM_LINK_STYLE,
      location: Stage.pauseLinkBoxLocation(),
      anchor: {
        x: 1,
        y: 1
      }
    });
    this.stage.hud.pauseLink = 'pause (p)';
  }

  addLinkToLevelCreator() {
    this.stage.hud.createTextBox('levelCreatorLink', {
      style: BOTTOM_LINK_STYLE,
      location: Stage.levelCreatorLinkBoxLocation(),
      anchor: {
        x: 1,
        y: 1
      }
    });
    this.stage.hud.levelCreatorLink = 'level creator (c)';
  }

  bindEvents() {
    window.addEventListener('resize', this.scaleToWindow.bind(this));

    this.renderer.canvas.addEventListener('pointermove', this.handlePointerMove.bind(this));
    this.renderer.canvas.addEventListener('pointerdown', this.handleClick.bind(this));

    document.addEventListener('keypress', (event) => {
      event.stopImmediatePropagation();

      if (event.key === 'p') {
        this.pause();
      }

      if (event.key === 'm') {
        this.mute();
      }

      if (event.key === 'c') {
        this.openLevelCreator();
      }

      if (event.key === 'f') {
        this.fullscreen();
      }

      if (event.key === 'g') {
        this.toggleDuckAIDebug();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.menuActive) {
        this.openMainMenu();
      }
    });

    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) {
        this.stage.hud.fullscreenLink = 'unfullscreen (f)';
      } else {
        this.stage.hud.fullscreenLink = 'fullscreen (f)';
      }
    });

    sound.on('play', (soundId) => {
      if (this.activeSounds.indexOf(soundId) === -1) {
        this.activeSounds.push(soundId);
      }
    });
    sound.on('stop', this.removeActiveSound.bind(this));
    sound.on('end', this.removeActiveSound.bind(this));
  }

  fullscreen() {
    this.isFullscreen = !this.isFullscreen;
    utils.toggleFullscreen();
  }

  pause() {
    this.stage.hud.pauseLink = this.paused ? 'pause (p)' : 'unpause (p)';
    // SetTimeout, woof. Thing is here we need to leave enough animation frames for the HUD status to be updated
    // before pausing all rendering, otherwise the text update we need above won't be shown to the user.
    setTimeout(() => {
      this.paused = !this.paused;
      if (this.paused) {
        this.pauseStartTime = Date.now();
        this.stage.pause();
        this.activeSounds.forEach((soundId) => {
          sound.pause(soundId);
        });
      } else {
        this.timePaused += (Date.now() - this.pauseStartTime) / 1000;
        this.stage.resume();
        this.activeSounds.forEach((soundId) => {
          sound.play(soundId);
        });
      }
    }, 40);
  }

  removeActiveSound(soundId) {
    _remove(this.activeSounds, function(item) {
      return item === soundId;
    });
  }

  mute() {
    this.stage.hud.muteLink = this.muted ? 'mute (m)' : 'unmute (m)';
    this.muted = !this.muted;
    sound.mute(this.muted);
  }

  scaleToWindow() {
    this.renderer.resize(window.innerWidth, window.innerHeight);
    this.stage.scaleToWindow();
  }

  openMainMenu() {
    this.stopAllAudio();
    this.cleanStageState();
    this.resetMatchStats();
    this.menuActive = true;
    this.gameStatus = '';
    this.clearEndOfGameActions();
    this.aiController.disable();
    this.duckAIController.disable();
    this.duckAIActions = [];
    this.duckAIDebug = null;
    this.activeModes = {
      autoAim: false,
      duckAI: false
    };
    this.stage.hud.modeStatus = 'mode: not selected';
    this.stage.hud.duckAIDebugPanel = '';

    if (!this.mainMenu) {
      this.mainMenu = new MainMenu();
    }

    if (!this.mainMenu.parent) {
      this.stage.addChild(this.mainMenu);
    }

    this.stage.hideCrosshair();
  }

  startGameInMode(modeSelection = {}) {
    this.activeModes = {
      autoAim: !!modeSelection.autoAim,
      duckAI: !!modeSelection.duckAI
    };
    this.menuActive = false;
    this.levelIndex = 0;
    this.maxScore = 0;
    this.score = 0;
    this.timePaused = 0;
    this.clearEndOfGameActions();

    if (this.mainMenu && this.mainMenu.parent) {
      this.stage.removeChild(this.mainMenu);
    }

    if (this.isAutoAimEnabled()) {
      this.aiController.enable('auto_aim_combo');
    } else {
      this.aiController.disable();
    }

    if (this.isDuckAIEnabled()) {
      this.duckAIController.enable();
      this.duckAIController.setDebug(this.duckAIDebugEnabled);
    } else {
      this.duckAIController.disable();
    }

    this.stage.showCrosshair();
    this.updateModeStatusText();
    this.startLevel();
  }

  restartCurrentMode() {
    const selectedMode = {
      ...this.activeModes
    };
    this.stopAllAudio();
    this.cleanStageState();
    this.resetMatchStats();
    this.menuActive = false;
    this.startGameInMode(selectedMode);
  }

  isAutoAimEnabled() {
    return !!(this.activeModes && this.activeModes.autoAim);
  }

  isDuckAIEnabled() {
    return !!(this.activeModes && this.activeModes.duckAI);
  }

  stopAllAudio() {
    if (this.quackingSoundId) {
      sound.stop(this.quackingSoundId);
      this.quackingSoundId = null;
    }

    const soundsToStop = this.activeSounds.slice(0);
    for (let i = 0; i < soundsToStop.length; i++) {
      sound.stop(soundsToStop[i]);
    }
  }

  cleanStageState() {
    this.renderer.background.color = BLUE_SKY_COLOR;
    this.stage.cleanUpDucks();
    this.stage.dog.stopAndClearTimeline();
    this.stage.dog.visible = false;
    this.stage.unlock();
  }

  resetMatchStats() {
    this.levelIndex = 0;
    this.maxScore = 0;
    this.score = 0;
    this.wave = 0;
    this.bullets = 0;
    this.ducksShot = 0;
    this.ducksMissed = 0;
    this.waveEnding = false;
    this.timePaused = 0;
  }

  clearEndOfGameActions() {
    if (Object.prototype.hasOwnProperty.call(this.stage.hud, 'replayButton')) {
      this.stage.hud.replayButton = '';
    }

    if (Object.prototype.hasOwnProperty.call(this.stage.hud, 'menuButton')) {
      this.stage.hud.menuButton = '';
    }
  }

  startLevel() {
    if (levelCreator.urlContainsLevelData()) {
      this.level = levelCreator.parseLevelQueryString();
      this.levelIndex = this.levels.length - 1;
    } else {
      this.level = this.levels[this.levelIndex];
    }

    this.maxScore += this.level.waves * this.level.ducks * this.level.pointsPerDuck;
    this.stage.setCrosshairRadius(this.level.radius);
    this.ducksShot = 0;
    this.ducksMissed = 0;
    this.wave = 0;

    this.gameStatus = this.level.title;
    this.stage.preLevelAnimation().then(() => {
      this.gameStatus = '';
      this.startWave();
    });
  }

  startWave() {
    this.quackingSoundId = sound.play('quacking');
    this.wave += 1;
    this.waveStartTime = Date.now();
    this.bullets = this.level.bullets;
    this.ducksShotThisWave = 0;
    this.waveEnding = false;

    const movementMode = this.isDuckAIEnabled() ? MOVEMENT_MODE.EVADE_AI : MOVEMENT_MODE.RANDOM;
    this.stage.addDucks(this.level.ducks, this.level.speed, {
      movementMode
    });
  }

  endWave() {
    this.waveEnding = true;
    this.bullets = 0;
    sound.stop(this.quackingSoundId);

    this.sendDuckAIWaveRewards();

    if (this.stage.ducksAlive()) {
      this.ducksMissed += this.level.ducks - this.ducksShotThisWave;
      this.renderer.background.color = PINK_SKY_COLOR;
      this.stage.flyAway().then(this.goToNextWave.bind(this));
    } else {
      this.stage.cleanUpDucks();
      this.goToNextWave();
    }
  }

  goToNextWave() {
    this.renderer.background.color = BLUE_SKY_COLOR;
    if (this.level.waves === this.wave) {
      this.endLevel();
    } else {
      this.startWave();
    }
  }

  shouldWaveEnd() {
    // evaluate pre-requisites for a wave to end
    if (this.wave === 0 || this.waveEnding || this.stage.dogActive()) {
      return false;
    }

    return this.isWaveTimeUp() || (this.outOfAmmo() && this.stage.ducksAlive()) || !this.stage.ducksActive();
  }

  isWaveTimeUp() {
    return this.level ? this.waveElapsedTime() >= this.level.time : false;
  }

  waveElapsedTime() {
    return ((Date.now() - this.waveStartTime) / 1000) - this.timePaused;
  }

  outOfAmmo() {
    return this.level && this.bullets === 0;
  }

  endLevel() {
    this.wave = 0;
    this.goToNextLevel();
  }

  goToNextLevel() {
    this.levelIndex++;
    if (!this.levelWon()) {
      this.loss();
    } else if (this.levelIndex < this.levels.length) {
      this.startLevel();
    } else {
      this.win();
    }
  }

  levelWon() {
    return this.ducksShot > SUCCESS_RATIO * this.level.ducks * this.level.waves;
  }

  win() {
    sound.play('champ');
    this.gameStatus = 'You Win!';
    if (this.isDuckAIEnabled()) {
      this.stage.hud.replayButton = '';
      this.stage.hud.menuButton = '';
      this.gameStatus = 'You Win! Reiniciando treino...';
      setTimeout(() => this.restartCurrentMode(), 1200);
      return;
    }
    this.showReplay(this.getScoreMessage());
  }

  loss() {
    sound.play('loserSound');
    this.gameStatus = 'You Lose!';
    if (this.isDuckAIEnabled()) {
      this.stage.hud.replayButton = '';
      this.stage.hud.menuButton = '';
      this.gameStatus = 'You Lose! Reiniciando treino...';
      setTimeout(() => this.restartCurrentMode(), 1200);
      return;
    }
    this.showReplay(this.getScoreMessage());
  }

  getScoreMessage() {
    let scoreMessage;

    const percentage = (this.score / this.maxScore) * 100;

    if (percentage === 100) {
      scoreMessage = 'Flawless victory.';
    }

    if (percentage < 100) {
      scoreMessage = 'Close to perfection.';
    }

    if (percentage <= 95) {
      scoreMessage = 'Truly impressive score.';
    }

    if (percentage <= 85) {
      scoreMessage = 'Solid score.';
    }

    if (percentage <= 75) {
      scoreMessage = 'Participation award.';
    }

    if (percentage <= 63) {
      scoreMessage = 'Yikes.';
    }

    return scoreMessage;
  }

  showReplay(replayText) {
    if (!Object.prototype.hasOwnProperty.call(this.stage.hud,'replayButton')) {
      this.stage.hud.createTextBox('replayButton', {
        location: Stage.replayButtonLocation()
      });
    }

    if (!Object.prototype.hasOwnProperty.call(this.stage.hud,'menuButton')) {
      this.stage.hud.createTextBox('menuButton', {
        location: Stage.menuButtonLocation()
      });
    }

    this.stage.hud.replayButton = replayText + ' Play Again?';
    this.stage.hud.menuButton = 'Back to menu';
  }

  openLevelCreator() {
    // If they didn't pause the game, pause it for them
    if (!this.paused) {
      this.pause();
    }
    window.open('/creator.html', '_blank');
  }

  handlePointerMove(event) {
    const pointerPoint = {
      x: event.clientX,
      y: event.clientY
    };

    if (this.menuActive) {
      if (this.mainMenu) {
        this.mainMenu.setHoverState(this.stage.getScaledClickLocation(pointerPoint));
      }
      return;
    }

    if (this.isAutoAimEnabled()) {
      return;
    }

    this.stage.setCrosshairTarget(pointerPoint);
  }

  handleClick(event) {
    const clickPoint = {
      x: event.clientX,
      y: event.clientY
    };

    if (this.menuActive) {
      const action = this.mainMenu.getAction(this.stage.getScaledClickLocation(clickPoint));
      if (action && action.type === 'start') {
        this.startGameInMode(action.selection);
      }
      return;
    }

    if (this.stage.clickedMenuLink(clickPoint)) {
      this.openMainMenu();
      return;
    }

    if (this.stage.clickedPauseLink(clickPoint)) {
      this.pause();
      return;
    }

    if (this.stage.clickedMuteLink(clickPoint)) {
      this.mute();
      return;
    }

    if (this.stage.clickedFullscreenLink(clickPoint)) {
      this.fullscreen();
      return;
    }

    if (this.stage.clickedLevelCreatorLink(clickPoint)) {
      this.openLevelCreator();
      return;
    }

    if (this.isAutoAimEnabled()) {
      if (this.stage.hud.replayButton && this.stage.clickedReplay(clickPoint)) {
        this.restartCurrentMode();
        return;
      }
      if (this.stage.hud.menuButton && this.stage.clickedMenu(clickPoint)) {
        this.openMainMenu();
        return;
      }
      return;
    }

    if (!this.stage.hud.replayButton && !this.outOfAmmo() && !this.shouldWaveEnd() && !this.paused) {
      sound.play('gunSound');
      this.bullets -= 1;
      const hits = this.stage.shotsFiredAtPoint(this.stage.getCrosshairPosition(), this.level.radius);
      this.updateScore(hits);
      this.notifyDuckAIShotRewards();
      return;
    }

    if (this.stage.hud.replayButton && this.stage.clickedReplay(clickPoint)) {
      this.restartCurrentMode();
      return;
    }

    if (this.stage.hud.menuButton && this.stage.clickedMenu(clickPoint)) {
      this.openMainMenu();
    }
  }

  updateScore(ducksShot) {
    this.ducksShot += ducksShot;
    this.ducksShotThisWave += ducksShot;
    this.score += ducksShot * this.level.pointsPerDuck;
  }

  readDuckAIDebugFlag() {
    const query = new URLSearchParams(window.location.search || '');
    if (query.get('duckAIDebug') === '1') {
      return true;
    }

    return localStorage.getItem('duckhunt.duck_ai.debug') === '1';
  }

  toggleDuckAIDebug() {
    this.duckAIDebugEnabled = !this.duckAIDebugEnabled;
    localStorage.setItem('duckhunt.duck_ai.debug', this.duckAIDebugEnabled ? '1' : '0');
    this.duckAIController.setDebug(this.duckAIDebugEnabled);
    this.updateModeStatusText();
    this.updateDuckAIDebugPanel();
  }

  updateModeStatusText() {
    if (!this.activeModes) {
      this.stage.hud.modeStatus = 'mode: not selected';
      return;
    }

    const modeTokens = [];
    if (this.isAutoAimEnabled()) {
      modeTokens.push('mira automatica');
    }
    if (this.isDuckAIEnabled()) {
      modeTokens.push('patos ia genetica');
    }

    this.stage.hud.modeStatus = 'mode: ' + (modeTokens.length ? modeTokens.join(' + ') : 'manual');
  }

  updateDuckAIDebugPanel() {
    if (!this.duckAIDebugEnabled || !this.isDuckAIEnabled()) {
      this.stage.hud.duckAIDebugPanel = '';
      return;
    }

    const debug = this.duckAIDebug || {};
    const generation = Number.isFinite(debug.generation) ? debug.generation : 0;
    const best = Number.isFinite(debug.bestFitness) ? debug.bestFitness.toFixed(3) : '0.000';
    const median = Number.isFinite(debug.medianFitness) ? debug.medianFitness.toFixed(3) : '0.000';
    const samples = Number.isFinite(debug.totalSamples) ? debug.totalSamples : 0;
    const alive = Number.isFinite(debug.aliveDucks) ? debug.aliveDucks : 0;

    this.stage.hud.duckAIDebugPanel = [
      'DEBUG IA GENETICA',
      'Geracao: ' + generation,
      'Best fitness: ' + best,
      'Median fitness: ' + median,
      'Samples: ' + samples,
      'Patos vivos: ' + alive
    ].join('\n');
  }

  handleDuckAIActions(payload) {
    this.duckAIActions = payload && Array.isArray(payload.actions) ? payload.actions : [];
  }

  handleDuckAIDebug(payload) {
    this.duckAIDebug = payload;
    this.updateModeStatusText();
    this.updateDuckAIDebugPanel();
  }

  getDuckById(duckId) {
    for (let i = 0; i < this.stage.ducks.length; i++) {
      if (this.stage.ducks[i].uuid === duckId) {
        return this.stage.ducks[i];
      }
    }

    return null;
  }

  notifyDuckAIShotRewards() {
    if (!this.duckAIController.enabled) {
      return;
    }

    const shotDuckIds = this.stage.consumeLastShotDuckIds();
    if (!shotDuckIds.length) {
      return;
    }

    const now = Date.now();
    for (let i = 0; i < shotDuckIds.length; i++) {
      const duckId = shotDuckIds[i];
      const duck = this.getDuckById(duckId);
      const survivedMs = duck ? Math.max(0, now - (duck.spawnTimestamp || now)) : 0;

      this.duckAIController.sendDuckReward({
        duckId,
        survivedMs,
        shot: true,
        reward: -1.6
      });
    }
  }

  sendDuckAIWaveRewards() {
    if (!this.duckAIController.enabled || !this.stage.ducks) {
      return;
    }

    const now = Date.now();
    for (let i = 0; i < this.stage.ducks.length; i++) {
      const duck = this.stage.ducks[i];
      if (!duck || !duck.alive) {
        continue;
      }

      const survivedMs = Math.max(0, now - (duck.spawnTimestamp || now));
      this.duckAIController.sendDuckReward({
        duckId: duck.uuid,
        survivedMs,
        shot: false,
        reward: 0.75
      });
    }
  }

  /**
   * Handle AI aiming action from worker
   * Applies worker's calculated crosshair position to screen
   */
  handleAIAiming(aimData) {
    if (!aimData || !aimData.target) {
      return;
    }

    const worldBounds = this.stage.getScaledClickLocation({
      x: this.renderer.canvas.width,
      y: this.renderer.canvas.height
    });
    const targetX = Number.isFinite(aimData.target.x)
      ? Math.max(0, Math.min(worldBounds.x, aimData.target.x))
      : this.stage.getCrosshairPosition().x;
    const targetY = Number.isFinite(aimData.target.y)
      ? Math.max(0, Math.min(worldBounds.y, aimData.target.y))
      : this.stage.getCrosshairPosition().y;

    // Worker operates in stage coordinates. Convert back to screen coordinates
    // because Stage.setCrosshairTarget expects screen-space input.
    this.stage.setCrosshairTarget({
      x: targetX * this.stage.scale.x,
      y: targetY * this.stage.scale.y
    });
  }

  /**
   * Handle AI fire intent from worker
   * Execute automatic firing if conditions are met
   */
  handleAIFire() {
    // Only fire if conditions are met
    if (!this.stage.hud.replayButton && !this.outOfAmmo() && !this.shouldWaveEnd() && !this.paused) {
      sound.play('gunSound');
      this.bullets -= 1;

      const crosshairPos = this.stage.getCrosshairPosition();
      const hits = this.stage.shotsFiredAtPoint(crosshairPos, this.level.radius);
      
      this.lastShotHits = hits;
      this.lastShotWasPerfectDouble = (hits === 2);
      
      this.updateScore(hits);
      this.notifyDuckAIShotRewards();

      // Send feedback to worker for learning
      const aliveCount = this.stage.ducks.filter(d => d.alive).length;
      this.aiController.sendShotResult(hits, aliveCount, this.wave, this.lastShotWasPerfectDouble);
    }
  }

  animate() {
    const now = Date.now();
    const deltaSeconds = Math.min(0.05, (now - this.lastAnimationTimestamp) / 1000);
    this.lastAnimationTimestamp = now;

    if (!this.paused) {
      this.stage.updateCrosshair();

      if (this.duckAIController && this.duckAIController.enabled && this.stage.ducks) {
        this.stage.applyDuckAIActions(this.duckAIActions, deltaSeconds, this.level ? this.level.speed : 5);

        const crosshairPos = this.stage.getCrosshairPosition();
        const prev = this.lastCrosshairState;
        const dtMs = Math.max(1, now - prev.timestamp);
        const crosshairVx = (crosshairPos.x - prev.x) / dtMs;
        const crosshairVy = (crosshairPos.y - prev.y) / dtMs;
        this.lastCrosshairState = {
          x: crosshairPos.x,
          y: crosshairPos.y,
          timestamp: now
        };

        const ducksState = this.stage.ducks.map((duck) => ({
          id: duck.uuid,
          x: duck.position.x,
          y: duck.position.y,
          vx: duck.aiVelocity ? duck.aiVelocity.x : 0,
          vy: duck.aiVelocity ? duck.aiVelocity.y : 0,
          alive: duck.alive
        }));

        this.duckAIController.sendDuckState({
          timestamp: now,
          deltaMs: dtMs,
          crosshair: {
            x: crosshairPos.x,
            y: crosshairPos.y,
            radius: this.stage.crosshair.radius,
            vx: crosshairVx,
            vy: crosshairVy
          },
          ducks: ducksState,
          bounds: this.stage.getDuckAIBounds()
        });
      }

      // Send frame state to AI worker for aiming (AUTO_AIM mode only)
      if (this.aiController && this.aiController.enabled && this.stage.ducks) {
        // Map duck state with full information for proper filtering
        const duckStates = this.stage.ducks.map(duck => ({
          id: duck.uuid || Math.random(),
          x: duck.position.x,
          y: duck.position.y,
          alive: duck.alive,
          state: duck.state || 'unknown',
          inDogsMouth: false  // Will be set during game logic when dog retrieves
        }));

        const crosshairPos = this.stage.getCrosshairPosition();
        const worldBounds = this.stage.getScaledClickLocation({
          x: this.renderer.canvas.width,
          y: this.renderer.canvas.height
        });

        this.aiController.sendFrameState({
          timestamp: Date.now(),
          ducks: duckStates,
          crosshair: {
            x: crosshairPos.x,
            y: crosshairPos.y,
            radius: this.stage.crosshair.radius
          },
          screenWidth: worldBounds.x,
          screenHeight: worldBounds.y,
          duckSpeed: this.level ? this.level.speed : 5, // Pass duck speed for adaptive smoothing
          ammo: this.bullets,
          paused: this.paused
        });
      }

      this.renderer.render(this.stage);

      if (this.shouldWaveEnd()) {
        this.endWave();
      }
    }

    requestAnimationFrame(this.animate.bind(this));
  }
}

export default Game;
