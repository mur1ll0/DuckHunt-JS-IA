import {Point, Graphics, Container, Assets, AnimatedSprite} from 'pixi.js';
import BPromise from 'bluebird';
import {some as _some} from 'lodash/collection';
import {delay as _delay} from 'lodash/function';
import {inRange as _inRange} from 'lodash/number';
import Utils from '../libs/utils';
import Duck, {MOVEMENT_MODE} from './Duck';
import Dog from './Dog';
import Hud from './Hud';
import Crosshair from './Crosshair';

const MAX_X = 800;
const MAX_Y = 600;

const DUCK_POINTS = {
  ORIGIN: new Point(MAX_X / 2, MAX_Y)
};
const DUCK_AI_BOUNDS = {
  minX: 30,
  maxX: MAX_X - 30,
  minY: 35,
  maxY: Math.floor(MAX_Y * 0.72)
};
const DOG_POINTS = {
  DOWN: new Point(MAX_X / 2, MAX_Y),
  UP: new Point(MAX_X / 2, MAX_Y - 230),
  SNIFF_START: new Point(0, MAX_Y - 130),
  SNIFF_END: new Point(MAX_X / 2, MAX_Y - 130)
};
const HUD_LOCATIONS = {
  SCORE: new Point(MAX_X - 10, 10),
  WAVE_STATUS: new Point(MAX_X - 11, MAX_Y - 30),
  LEVEL_CREATOR_LINK: new Point(MAX_X - 11, MAX_Y - 10),
  MENU_LINK: new Point(MAX_X - 420, MAX_Y - 10),
  FULL_SCREEN_LINK: new Point(MAX_X - 130, MAX_Y - 10),
  PAUSE_LINK: new Point(MAX_X - 318, MAX_Y - 10),
  MUTE_LINK: new Point(MAX_X - 236, MAX_Y - 10),
  GAME_STATUS: new Point(MAX_X / 2, MAX_Y * 0.45),
  REPLAY_BUTTON: new Point(MAX_X / 2, MAX_Y * 0.56),
  MENU_BUTTON: new Point(MAX_X / 2, MAX_Y * 0.64),
  BULLET_STATUS: new Point(10, 10),
  DEAD_DUCK_STATUS: new Point(10, MAX_Y * 0.91),
  MISSED_DUCK_STATUS: new Point(10, MAX_Y * 0.95),
  MODE_STATUS: new Point(10, MAX_Y - 10)
};

const FLASH_MS = 60;
const FLASH_SCREEN = new Graphics();
FLASH_SCREEN.rect(0, 0, MAX_X, MAX_Y).fill(0xFFFFFF);
FLASH_SCREEN.position.x = 0;
FLASH_SCREEN.position.y = 0;

class Stage extends Container {

  /**
   * Stage Constructor
   * Container for the game
   * @param opts
   * @param opts.spritesheet - String representing the path to the spritesheet file
   */
  constructor(opts) {
    super();
    this.locked = false;
    this.spritesheet = opts.spritesheet;
    this.ducks = [];
    this.dog = new Dog({
      spritesheet: opts.spritesheet,
      downPoint: DOG_POINTS.DOWN,
      upPoint: DOG_POINTS.UP
    });
    this.dog.visible = false;
    this.flashScreen = FLASH_SCREEN;
    this.flashScreen.visible = false;
    this.hud = new Hud();
    this.crosshair = new Crosshair({
      startPoint: new Point(MAX_X / 2, MAX_Y / 2)
    });
    this.crosshair.visible = false;

    this._setStage();
    this.scaleToWindow();
  }

  static scoreBoxLocation() {
    return HUD_LOCATIONS.SCORE;
  }

  static waveStatusBoxLocation() {
    return HUD_LOCATIONS.WAVE_STATUS;
  }

  static gameStatusBoxLocation() {
    return HUD_LOCATIONS.GAME_STATUS;
  }

  static pauseLinkBoxLocation() {
    return HUD_LOCATIONS.PAUSE_LINK;
  }

  static muteLinkBoxLocation() {
    return HUD_LOCATIONS.MUTE_LINK;
  }

  static fullscreenLinkBoxLocation() {
    return HUD_LOCATIONS.FULL_SCREEN_LINK;
  }

  static levelCreatorLinkBoxLocation() {
    return HUD_LOCATIONS.LEVEL_CREATOR_LINK;
  }

  static menuLinkBoxLocation() {
    return HUD_LOCATIONS.MENU_LINK;
  }

  static replayButtonLocation() {
    return HUD_LOCATIONS.REPLAY_BUTTON;
  }

  static menuButtonLocation() {
    return HUD_LOCATIONS.MENU_BUTTON;
  }

  static modeStatusBoxLocation() {
    return HUD_LOCATIONS.MODE_STATUS;
  }

  static bulletStatusBoxLocation() {
    return HUD_LOCATIONS.BULLET_STATUS;
  }

  static deadDuckStatusBoxLocation() {
    return HUD_LOCATIONS.DEAD_DUCK_STATUS;
  }

  static missedDuckStatusBoxLocation() {
    return HUD_LOCATIONS.MISSED_DUCK_STATUS;
  }

  pause() {
    this.dog.timeline.pause();
    this.ducks.forEach((duck) => {
      duck.timeline.pause();
    });
  }

  resume() {
    this.dog.timeline.play();
    this.ducks.forEach((duck) => {
      duck.timeline.play();
    });
  }

  /**
   * scaleToWindow
   * Helper method that scales the stage container to the window size
   */
  scaleToWindow() {
    this.scale.set(window.innerWidth / MAX_X, window.innerHeight / MAX_Y);
  }

  /**
   * _setStage
   * Private method that adds all of the main pieces to the scene
   * @returns {Stage}
   * @private
   */
  _setStage() {
    const background = new AnimatedSprite([
      Assets.get(this.spritesheet).textures['scene/back/0.png']
    ]);
    background.position.set(0, 0);

    const tree = new AnimatedSprite([Assets.get(this.spritesheet).textures['scene/tree/0.png']]);
    tree.position.set(100, 237);

    this.addChild(tree);
    this.addChild(background);
    this.addChild(this.dog);
    this.addChild(this.flashScreen);
    this.addChild(this.crosshair);
    this.addChild(this.hud);

    return this;
  }

  /**
   * preLevelAnimation
   * Helper method that runs the level intro animation with the dog and returns a promise that resolves
   * when it's complete.
   * @returns {Promise}
   */
  preLevelAnimation() {
    return new BPromise((resolve) => {
      this.cleanUpDucks();

      const sniffOpts = {
        startPoint: DOG_POINTS.SNIFF_START,
        endPoint: DOG_POINTS.SNIFF_END
      };

      const findOpts = {
        onComplete: () => {
          this.setChildIndex(this.dog, 0);
          resolve();
        }
      };

      this.dog.sniff(sniffOpts).find(findOpts);
    });
  }

  /**
   * addDucks
   * Helper method that adds ducks to the container and causes them to fly around randomly.
   * @param {Number} numDucks - How many ducks to add to the stage
   * @param {Number} speed - Value from 0 (slow) to 10 (fast) that determines how fast the ducks will fly
   */
  addDucks(numDucks, speed, opts = {}) {
    const movementMode = opts.movementMode || MOVEMENT_MODE.RANDOM;

    for (let i = 0; i < numDucks; i++) {
      const duckColor = i % 2 === 0 ? 'red' : 'black';

      // Al was here.
      const newDuck = new Duck({
        spritesheet: this.spritesheet,
        colorProfile: duckColor,
        maxX: MAX_X,
        maxY: MAX_Y
      });
      newDuck.position.set(DUCK_POINTS.ORIGIN.x, DUCK_POINTS.ORIGIN.y);
      // Assign unique ID for AI tracking
      newDuck.uuid = this.ducks.length + '_' + Date.now() + '_' + Math.random();
      newDuck.spawnTimestamp = Date.now();
      this.addChildAt(newDuck, 0);

      if (movementMode === MOVEMENT_MODE.EVADE_AI) {
        newDuck.setMovementMode(MOVEMENT_MODE.EVADE_AI);
        newDuck.position.set(
          DUCK_AI_BOUNDS.minX + (Math.random() * (DUCK_AI_BOUNDS.maxX - DUCK_AI_BOUNDS.minX)),
          DUCK_AI_BOUNDS.maxY - (Math.random() * 20)
        );
        newDuck.setAIMovementTarget({
          targetX: DUCK_AI_BOUNDS.minX + (Math.random() * (DUCK_AI_BOUNDS.maxX - DUCK_AI_BOUNDS.minX)),
          targetY: DUCK_AI_BOUNDS.minY + (Math.random() * (DUCK_AI_BOUNDS.maxY - DUCK_AI_BOUNDS.minY)),
          speed: 1
        });
      } else {
        newDuck.setMovementMode(MOVEMENT_MODE.RANDOM);
        newDuck.randomFlight({
          speed
        });
      }

      this.ducks.push(newDuck);
    }
  }

  getDuckAIBounds() {
    return {
      minX: DUCK_AI_BOUNDS.minX,
      maxX: DUCK_AI_BOUNDS.maxX,
      minY: DUCK_AI_BOUNDS.minY,
      maxY: DUCK_AI_BOUNDS.maxY
    };
  }

  applyDuckAIActions(actions, deltaSeconds, speed) {
    const safeActions = Array.isArray(actions) ? actions : [];

    const actionByDuckId = new Map();
    for (let i = 0; i < safeActions.length; i++) {
      if (safeActions[i] && safeActions[i].id) {
        actionByDuckId.set(safeActions[i].id, safeActions[i]);
      }
    }

    const bounds = this.getDuckAIBounds();
    for (let i = 0; i < this.ducks.length; i++) {
      const duck = this.ducks[i];
      if (!duck || !duck.alive || duck.movementMode !== MOVEMENT_MODE.EVADE_AI) {
        continue;
      }

      const action = actionByDuckId.get(duck.uuid);
      if (action) {
        duck.setAIMovementTarget(action);
      }

      duck.updateAIMovement(deltaSeconds, bounds, speed);
    }
  }

  /**
   * shotsFired
   * Click handler for the stage, scale's the location of the click to ensure coordinate system
   * alignment and then calculates if any of the ducks were hit and should be shot.
   * @param {{x:Number, y:Number}} clickPoint - Point where the container was clicked in real coordinates
   * @param {Number} radius - The "blast radius" of the player's weapon
   * @returns {Number} - The number of ducks hit with the shot
   */
  shotsFired(clickPoint, radius) {
    return this.shotsFiredAtPoint(this.getScaledClickLocation(clickPoint), radius);
  }

  /**
   * shotsFiredAtPoint
   * Checks if ducks were hit using a point already converted to stage coordinates.
   * @param {{x:Number, y:Number}} worldPoint - Point in stage coordinate space
   * @param {Number} radius - The "blast radius" of the player's weapon
   * @returns {Number} - The number of ducks hit with the shot
   */
  shotsFiredAtPoint(worldPoint, radius) {
    // flash the screen
    this.flashScreen.visible = true;
    _delay(() => {
      this.flashScreen.visible = false;
    }, FLASH_MS);

    let ducksShot = 0;
    this.lastShotDuckIds = [];
    for (let i = 0; i < this.ducks.length; i++) {
      const duck = this.ducks[i];
      if (duck.alive && Utils.pointDistance(duck.position, worldPoint) < radius) {
        ducksShot++;
        this.lastShotDuckIds.push(duck.uuid);
        duck.shot();
        duck.timeline.call(() => {
          if (!this.isLocked()) {
            this.dog.retrieve();
          }
        });
      }
    }
    return ducksShot;
  }

  consumeLastShotDuckIds() {
    const lastShot = this.lastShotDuckIds || [];
    this.lastShotDuckIds = [];
    return lastShot;
  }

  clickedReplay(clickPoint) {
    const scaledClickPoint = this.getScaledClickLocation(clickPoint);
    return _inRange(scaledClickPoint.x, HUD_LOCATIONS.REPLAY_BUTTON.x - 240, HUD_LOCATIONS.REPLAY_BUTTON.x + 240) &&
      _inRange(scaledClickPoint.y, HUD_LOCATIONS.REPLAY_BUTTON.y - 24, HUD_LOCATIONS.REPLAY_BUTTON.y + 24);
  }

  clickedMenu(clickPoint) {
    const scaledClickPoint = this.getScaledClickLocation(clickPoint);
    return _inRange(scaledClickPoint.x, HUD_LOCATIONS.MENU_BUTTON.x - 180, HUD_LOCATIONS.MENU_BUTTON.x + 180) &&
      _inRange(scaledClickPoint.y, HUD_LOCATIONS.MENU_BUTTON.y - 24, HUD_LOCATIONS.MENU_BUTTON.y + 24);
  }

  clickedLevelCreatorLink(clickPoint) {
    const scaledClickPoint = this.getScaledClickLocation(clickPoint);

    // with this link we have a very narrow hit box, radius search is not appropriate
    return _inRange(scaledClickPoint.x, HUD_LOCATIONS.LEVEL_CREATOR_LINK.x-110, HUD_LOCATIONS.LEVEL_CREATOR_LINK.x) &&
      _inRange(scaledClickPoint.y, HUD_LOCATIONS.LEVEL_CREATOR_LINK.y-30, HUD_LOCATIONS.LEVEL_CREATOR_LINK.y+10);
  }

  clickedMenuLink(clickPoint) {
    const scaledClickPoint = this.getScaledClickLocation(clickPoint);
    return _inRange(scaledClickPoint.x, HUD_LOCATIONS.MENU_LINK.x - 160, HUD_LOCATIONS.MENU_LINK.x) &&
      _inRange(scaledClickPoint.y, HUD_LOCATIONS.MENU_LINK.y - 30, HUD_LOCATIONS.MENU_LINK.y + 10);
  }

  clickedPauseLink(clickPoint) {
    const scaledClickPoint = this.getScaledClickLocation(clickPoint);
    return _inRange(scaledClickPoint.x, HUD_LOCATIONS.PAUSE_LINK.x-110, HUD_LOCATIONS.PAUSE_LINK.x) &&
      _inRange(scaledClickPoint.y, HUD_LOCATIONS.PAUSE_LINK.y-30, HUD_LOCATIONS.PAUSE_LINK.y+10);
  }

  clickedFullscreenLink(clickPoint) {
    const scaledClickPoint = this.getScaledClickLocation(clickPoint);
    return _inRange(scaledClickPoint.x, HUD_LOCATIONS.FULL_SCREEN_LINK.x-110, HUD_LOCATIONS.FULL_SCREEN_LINK.x) &&
      _inRange(scaledClickPoint.y, HUD_LOCATIONS.FULL_SCREEN_LINK.y-30, HUD_LOCATIONS.FULL_SCREEN_LINK.y+10);
  }

  clickedMuteLink(clickPoint) {
    const scaledClickPoint = this.getScaledClickLocation(clickPoint);
    return _inRange(scaledClickPoint.x, HUD_LOCATIONS.MUTE_LINK.x-110, HUD_LOCATIONS.MUTE_LINK.x) &&
      _inRange(scaledClickPoint.y, HUD_LOCATIONS.MUTE_LINK.y-30, HUD_LOCATIONS.MUTE_LINK.y+10);
  }

  getScaledClickLocation(clickPoint) {
    return {
      x: clickPoint.x / this.scale.x,
      y: clickPoint.y / this.scale.y
    };
  }

  setCrosshairTarget(screenPoint) {
    this.crosshair.setTargetPosition(this.getScaledClickLocation(screenPoint));
  }

  setCrosshairRadius(radius) {
    this.crosshair.setRadius(radius);
  }

  getCrosshairPosition() {
    return this.crosshair.getCenter();
  }

  updateCrosshair() {
    this.crosshair.update();
  }

  showCrosshair() {
    this.crosshair.visible = true;
  }

  hideCrosshair() {
    this.crosshair.visible = false;
  }
  /**
   * flyAway
   * Helper method that causes the sky to change color and the ducks to fly away
   * @returns {Promise} - This promise is resolved when all the ducks have flown away
   */
  flyAway() {
    this.dog.stopAndClearTimeline();
    this.dog.laugh();
    this.lock();
    const duckPromises = [];

    for (let i = 0; i < this.ducks.length; i++) {
      const duck = this.ducks[i];
      if (duck.alive) {
        duckPromises.push(new BPromise((resolve) => {
          duck.stopAndClearTimeline();
          duck.flyTo({
            point: new Point(MAX_X / 2, -500),
            onComplete: resolve
          });
        }));
      }
    }

    return BPromise.all(duckPromises).then(this.cleanUpDucks.bind(this)).then(this.unlock.bind(this));
  }

  /**
   * cleanUpDucks
   * Helper that removes all ducks from the container and object
   */
  cleanUpDucks() {
    for (let i = 0; i < this.ducks.length; i++) {
      this.removeChild(this.ducks[i]);
    }
    this.ducks = [];
  }

  /**
   * ducksAlive
   * Helper that returns a boolean value depending on whether or not ducks are alive. The distinction
   * is that even dead ducks may be animating and still "active"
   * @returns {Boolean}
   */
  ducksAlive() {
    return _some(this.ducks, (duck) => {
      return duck.alive;
    });
  }

  /**
   * ducksActive
   * Helper that returns a boolean value depending on whether or not ducks are animating. Both live
   * and dead ducks may be animating.
   * @returns {Boolean}
   */
  ducksActive() {
    return _some(this.ducks, (duck) => {
      return duck.isActive();
    });
  }

  /**
   * dogActive
   * Helper proxy method that returns a boolean depending on whether the dog is animating
   * @returns {boolean}
   */
  dogActive() {
    return this.dog.isActive();
  }

  /**
   * isActive
   * High level helper to determine if things are animating on the stage
   * @returns {boolean|Boolean}
   */
  isActive() {
    return this.dogActive() || this.ducksAlive() || this.ducksActive();
  }

  /**
   * lock
   * Lock the stage to prevent new animations from being added to timelines, specifically useful for managing race and
   * edge conditions around dogs and ducks.
   */
  lock() {
    this.locked = true;
  }

  /**
   * unlock
   * Unlock the stage so that new animations can be added to timelines.
   */
  unlock() {
    this.locked = false;
  }

  /**
   * isLocked
   * Helper to tell if the stage is locked to new animations or not
   * @returns {Boolean}
   */
  isLocked() {
    return this.locked;
  }
}

export default Stage;
