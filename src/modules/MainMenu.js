import {Container, Graphics, Text} from 'pixi.js';
import {GAME_MODE, GAME_MODE_LABELS} from './GameModes';

const MENU_SIZE = {
  width: 520,
  height: 360,
  x: 140,
  y: 110
};
const BUTTON_LAYOUT = {
  x: MENU_SIZE.x + 40,
  width: MENU_SIZE.width - 80,
  height: 56,
  spacing: 18,
  firstY: MENU_SIZE.y + 120
};
const COLORS = {
  panel: 0x0f2d57,
  panelBorder: 0xdceaf7,
  button: 0x1a4a89,
  buttonHover: 0x2669be,
  buttonBorder: 0xdceaf7,
  title: 0xffffff,
  subtitle: 0xdceaf7
};

class MainMenu extends Container {
  constructor() {
    super();
    this.modeButtons = [];
    this.createMenu();
  }

  createMenu() {
    const panel = new Graphics();
    panel.roundRect(MENU_SIZE.x, MENU_SIZE.y, MENU_SIZE.width, MENU_SIZE.height, 18)
      .fill(COLORS.panel)
      .stroke({
        color: COLORS.panelBorder,
        width: 3
      });

    this.addChild(panel);

    const title = new Text('Selecione o modo de jogo', {
      fontFamily: 'Arial',
      fontSize: '36px',
      align: 'center',
      fill: COLORS.title
    });
    title.anchor.set(0.5, 0.5);
    title.position.set(MENU_SIZE.x + (MENU_SIZE.width / 2), MENU_SIZE.y + 52);
    this.addChild(title);

    const subtitle = new Text('A partida inicia somente apos a selecao', {
      fontFamily: 'Arial',
      fontSize: '18px',
      align: 'center',
      fill: COLORS.subtitle
    });
    subtitle.anchor.set(0.5, 0.5);
    subtitle.position.set(MENU_SIZE.x + (MENU_SIZE.width / 2), MENU_SIZE.y + 88);
    this.addChild(subtitle);

    this.addModeButton(GAME_MODE.NORMAL, BUTTON_LAYOUT.firstY);
    this.addModeButton(GAME_MODE.AUTO_AIM, BUTTON_LAYOUT.firstY + BUTTON_LAYOUT.height + BUTTON_LAYOUT.spacing);
    this.addModeButton(GAME_MODE.IA_GUIDED, BUTTON_LAYOUT.firstY + ((BUTTON_LAYOUT.height + BUTTON_LAYOUT.spacing) * 2));
  }

  addModeButton(mode, y) {
    const button = new Graphics();
    button.roundRect(BUTTON_LAYOUT.x, y, BUTTON_LAYOUT.width, BUTTON_LAYOUT.height, 12)
      .fill(COLORS.button)
      .stroke({
        color: COLORS.buttonBorder,
        width: 2
      });

    const label = new Text(GAME_MODE_LABELS[mode], {
      fontFamily: 'Arial',
      fontSize: '26px',
      align: 'center',
      fill: COLORS.title
    });
    label.anchor.set(0.5, 0.5);
    label.position.set(BUTTON_LAYOUT.x + (BUTTON_LAYOUT.width / 2), y + (BUTTON_LAYOUT.height / 2));

    this.addChild(button);
    this.addChild(label);

    this.modeButtons.push({
      mode,
      graphics: button,
      area: {
        x: BUTTON_LAYOUT.x,
        y,
        width: BUTTON_LAYOUT.width,
        height: BUTTON_LAYOUT.height
      }
    });
  }

  getSelectedMode(clickPoint) {
    for (let i = 0; i < this.modeButtons.length; i++) {
      const button = this.modeButtons[i];
      if (this.pointInRect(clickPoint, button.area)) {
        return button.mode;
      }
    }
    return null;
  }

  setHoverState(clickPoint) {
    for (let i = 0; i < this.modeButtons.length; i++) {
      const button = this.modeButtons[i];
      const hovered = this.pointInRect(clickPoint, button.area);
      button.graphics.clear()
        .roundRect(button.area.x, button.area.y, button.area.width, button.area.height, 12)
        .fill(hovered ? COLORS.buttonHover : COLORS.button)
        .stroke({
          color: COLORS.buttonBorder,
          width: 2
        });
    }
  }

  pointInRect(point, rect) {
    return point &&
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height;
  }
}

export default MainMenu;
