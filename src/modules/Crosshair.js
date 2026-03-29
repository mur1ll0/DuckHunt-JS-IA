import {Container, Graphics, Point} from 'pixi.js';

const DEFAULT_RADIUS = 60;
const DEFAULT_SMOOTHING_FACTOR = 0.12;
const COLOR = 0xff2a2a;

class Crosshair extends Container {
  constructor(opts = {}) {
    super();

    const startPoint = opts.startPoint || new Point(0, 0);
    this.targetPosition = new Point(startPoint.x, startPoint.y);
    this.smoothingFactor = opts.smoothingFactor || DEFAULT_SMOOTHING_FACTOR;
    this.radius = opts.radius || DEFAULT_RADIUS;
    this.graphics = new Graphics();

    this.addChild(this.graphics);
    this.position.set(startPoint.x, startPoint.y);
    this.redraw();
  }

  setTargetPosition(point) {
    this.targetPosition.set(point.x, point.y);
  }

  setRadius(radius) {
    this.radius = radius;
    this.redraw();
  }

  getCenter() {
    return {
      x: this.position.x,
      y: this.position.y
    };
  }

  update() {
    const nextX = this.position.x + ((this.targetPosition.x - this.position.x) * this.smoothingFactor);
    const nextY = this.position.y + ((this.targetPosition.y - this.position.y) * this.smoothingFactor);
    this.position.set(nextX, nextY);
  }

  redraw() {
    this.graphics.clear()
      .circle(0, 0, this.radius)
      .stroke({
        color: COLOR,
        width: 2
      })
      .circle(0, 0, 3)
      .fill(COLOR);
  }
}

export default Crosshair;