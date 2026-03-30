import {Container, Graphics, Text} from 'pixi.js';

const MENU_SIZE = {
  width: 520,
  height: 340,
  x: 140,
  y: 110
};
const CHECKBOX_LAYOUT = {
  x: MENU_SIZE.x + 52,
  y: MENU_SIZE.y + 132,
  size: 30,
  spacing: 58
};
const START_BUTTON_LAYOUT = {
  x: MENU_SIZE.x + 120,
  y: MENU_SIZE.y + 248,
  width: MENU_SIZE.width - 240,
  height: 54
};
const COLORS = {
  panel: 0x0f2d57,
  panelBorder: 0xdceaf7,
  button: 0x1a4a89,
  buttonHover: 0x2669be,
  buttonBorder: 0xdceaf7,
  checkbox: 0x0a2244,
  checkboxHover: 0x14386c,
  checkboxTick: 0x7bf2b2,
  title: 0xffffff,
  subtitle: 0xdceaf7
};

class MainMenu extends Container {
  constructor() {
    super();
    this.hoveredControl = null;
    this.selection = {
      autoAim: false,
      duckAI: false
    };
    this.controls = {
      autoAim: {
        x: CHECKBOX_LAYOUT.x,
        y: CHECKBOX_LAYOUT.y,
        width: CHECKBOX_LAYOUT.size,
        height: CHECKBOX_LAYOUT.size
      },
      duckAI: {
        x: CHECKBOX_LAYOUT.x,
        y: CHECKBOX_LAYOUT.y + CHECKBOX_LAYOUT.spacing,
        width: CHECKBOX_LAYOUT.size,
        height: CHECKBOX_LAYOUT.size
      },
      start: {
        x: START_BUTTON_LAYOUT.x,
        y: START_BUTTON_LAYOUT.y,
        width: START_BUTTON_LAYOUT.width,
        height: START_BUTTON_LAYOUT.height
      }
    };
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

    const subtitle = new Text('Marque as opcoes e inicie a partida', {
      fontFamily: 'Arial',
      fontSize: '18px',
      align: 'center',
      fill: COLORS.subtitle
    });
    subtitle.anchor.set(0.5, 0.5);
    subtitle.position.set(MENU_SIZE.x + (MENU_SIZE.width / 2), MENU_SIZE.y + 88);
    this.addChild(subtitle);

    this.checkboxGraphics = {
      autoAim: new Graphics(),
      duckAI: new Graphics(),
      start: new Graphics()
    };

    this.addChild(this.checkboxGraphics.autoAim);
    this.addChild(this.checkboxGraphics.duckAI);
    this.addChild(this.checkboxGraphics.start);

    const autoAimLabel = new Text('Mira automatica', {
      fontFamily: 'Arial',
      fontSize: '28px',
      align: 'left',
      fill: COLORS.title
    });
    autoAimLabel.position.set(CHECKBOX_LAYOUT.x + 46, CHECKBOX_LAYOUT.y - 2);
    this.addChild(autoAimLabel);

    const duckAILabel = new Text('Patos com IA genetica', {
      fontFamily: 'Arial',
      fontSize: '28px',
      align: 'left',
      fill: COLORS.title
    });
    duckAILabel.position.set(CHECKBOX_LAYOUT.x + 46, CHECKBOX_LAYOUT.y + CHECKBOX_LAYOUT.spacing - 2);
    this.addChild(duckAILabel);

    this.startLabel = new Text('Iniciar jogo', {
      fontFamily: 'Arial',
      fontSize: '30px',
      align: 'center',
      fill: COLORS.title
    });
    this.startLabel.anchor.set(0.5, 0.5);
    this.startLabel.position.set(
      START_BUTTON_LAYOUT.x + (START_BUTTON_LAYOUT.width / 2),
      START_BUTTON_LAYOUT.y + (START_BUTTON_LAYOUT.height / 2)
    );
    this.addChild(this.startLabel);

    this.renderControls();
  }

  drawCheckbox(graphics, area, checked, hovered) {
    graphics.clear();
    graphics.roundRect(area.x, area.y, area.width, area.height, 6)
      .fill(hovered ? COLORS.checkboxHover : COLORS.checkbox)
      .stroke({
        color: COLORS.buttonBorder,
        width: 2
      });

    if (checked) {
      graphics.moveTo(area.x + 7, area.y + 16)
        .lineTo(area.x + 13, area.y + 23)
        .lineTo(area.x + 24, area.y + 8)
        .stroke({
          color: COLORS.checkboxTick,
          width: 4
        });
    }
  }

  drawStartButton(hovered) {
    const area = this.controls.start;
    this.checkboxGraphics.start.clear()
      .roundRect(area.x, area.y, area.width, area.height, 12)
      .fill(hovered ? COLORS.buttonHover : COLORS.button)
      .stroke({
        color: COLORS.buttonBorder,
        width: 2
      });
  }

  renderControls() {
    this.drawCheckbox(
      this.checkboxGraphics.autoAim,
      this.controls.autoAim,
      this.selection.autoAim,
      this.hoveredControl === 'autoAim'
    );
    this.drawCheckbox(
      this.checkboxGraphics.duckAI,
      this.controls.duckAI,
      this.selection.duckAI,
      this.hoveredControl === 'duckAI'
    );
    this.drawStartButton(this.hoveredControl === 'start');
  }

  getAction(clickPoint) {
    if (this.pointInRect(clickPoint, this.controls.autoAim)) {
      this.selection.autoAim = !this.selection.autoAim;
      this.renderControls();
      return {
        type: 'toggle',
        selection: {
          ...this.selection
        }
      };
    }

    if (this.pointInRect(clickPoint, this.controls.duckAI)) {
      this.selection.duckAI = !this.selection.duckAI;
      this.renderControls();
      return {
        type: 'toggle',
        selection: {
          ...this.selection
        }
      };
    }

    if (this.pointInRect(clickPoint, this.controls.start)) {
      return {
        type: 'start',
        selection: {
          ...this.selection
        }
      };
    }

    return null;
  }

  setHoverState(clickPoint) {
    let hovered = null;
    if (this.pointInRect(clickPoint, this.controls.autoAim)) {
      hovered = 'autoAim';
    } else if (this.pointInRect(clickPoint, this.controls.duckAI)) {
      hovered = 'duckAI';
    } else if (this.pointInRect(clickPoint, this.controls.start)) {
      hovered = 'start';
    }

    if (hovered !== this.hoveredControl) {
      this.hoveredControl = hovered;
      this.renderControls();
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
