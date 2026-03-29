# Arquitetura Atual do Jogo

## 1) Entrada e inicializacao

- Arquivo de entrada: `main.js`.
- Ao carregar o DOM, instancia `new Game({ spritesheet: 'sprites.json' }).load()`.
- O bundle principal eh gerado por `webpack.config.js` para `dist/duckhunt.js`.

Fluxo resumido:

1. `Game.load()` cria renderer Pixi com tamanho da janela.
2. `Assets.load(this.spritesheet)` carrega `dist/sprites.json` e `dist/sprites.png`.
3. `Game.onLoad()` adiciona canvas ao `document.body`, cria `Stage`, registra eventos e inicia a primeira fase.
4. `Game.animate()` roda continuamente via `requestAnimationFrame`.

## 2) Mapeamento de sprites e assets

### 2.1 Origem dos assets

- Imagens fonte: `src/assets/images/**`.
- Audio fonte: `src/assets/sounds/*.mp3`.
- Spritesheet final: `dist/sprites.json` + `dist/sprites.png`.
- Audiosprite final: `dist/audio.json` + audios.

Build dos assets:

- `npm run images` executa `gulp images` e usa TexturePacker para gerar `dist/sprites.json`.
- `npm run audio` executa `gulp audio` e gera `dist/audio.json`.

### 2.2 Estrutura observada no spritesheet (`dist/sprites.json`)

- Dog:
  - `dog/double/*`
  - `dog/find/*`
  - `dog/jump/*`
  - `dog/laugh/*`
  - `dog/single/*`
  - `dog/sniff/*`
- Duck (black e red):
  - `duck/black/{left,right,top-left,top-right,dead,shot}/*`
  - `duck/red/{left,right,top-left,top-right,dead,shot}/*`
- HUD:
  - `hud/bullet/*`
  - `hud/score-dead/*`
  - `hud/score-live/*`
- Cenario:
  - `scene/back/*`
  - `scene/tree/*`

### 2.3 Como os sprites sao vinculados no codigo

- `Character` (`src/modules/Character.js`) varre `Assets.get(spritesheet).textures`.
- O construtor filtra por prefixo (`spriteId`) e monta os `states` dinamicamente por path.
- Classes especializadas definem estados aceitos:
  - `Duck`: left, right, top-left, top-right, dead, shot.
  - `Dog`: double, single, find, jump, laugh, sniff.

## 3) Como o tiro eh executado hoje

Arquivos-chave:

- `src/modules/Game.js`
- `src/modules/Stage.js`
- `src/libs/utils.js`

Fluxo atual do clique/disparo:

1. Evento `pointerdown` no canvas chama `Game.handleClick(event)`.
2. O click em coordenada de tela vira `clickPoint = {x: clientX, y: clientY}`.
3. Antes de atirar, o jogo verifica se o click atingiu links HUD (pause/mute/fullscreen/creator).
4. Se estiver em condicao de tiro:
   - toca `gunSound`
   - decrementa balas (`this.bullets -= 1`)
   - chama `this.stage.shotsFired(clickPoint, this.level.radius)`
5. `Stage.shotsFired`:
   - exibe flash branco por ~60 ms
   - converte coordenada de tela para coordenada do stage com `getScaledClickLocation`
   - para cada pato vivo, aplica distancia euclidiana:
     - acerto quando `pointDistance(duck.position, clickEscalado) < radius`
   - ao acertar: `duck.shot()` + fila de `dog.retrieve()`
6. `Game.updateScore(ducksShot)` soma pontos.

Observacao tecnica importante:

- O tiro nao usa raycast. Usa area circular de impacto (`radius`) por distancia.
- O raio de tiro vem da fase (`level.radius` em `src/data/levels.json`).

## 4) Como os patos se movem hoje

Arquivos-chave:

- `src/modules/Stage.js`
- `src/modules/Duck.js`
- `src/libs/utils.js`

Fluxo de spawn e movimento:

1. `Game.startWave()` chama `stage.addDucks(level.ducks, level.speed)`.
2. `Stage.addDucks` cria patos alternando cor (`red` e `black`) e posiciona no ponto inicial `DUCK_POINTS.ORIGIN`.
3. Cada pato chama `randomFlight({ speed })`.
4. `Duck.randomFlight`:
   - sorteia destino aleatorio dentro de limites (`minX/maxX/minY/maxY`)
   - garante distancia minima (`randomFlightDelta`, default 300)
   - agenda `flyTo(destino)`
   - no `onComplete`, chama `randomFlight` novamente (movimento perpetuo)
5. `Duck.flyTo`:
   - define `speed` em escala 0..10 (mapeada para tempo de tween)
   - calcula direcao com `Utils.directionOfTravel`
   - troca estado visual conforme direcao (`left/right/top-left/top-right`)
   - anima posicao via timeline GSAP

Morte do pato:

- `duck.shot()` troca estado para `shot`, depois `dead`, cai ate `maxY`, toca sons (`quak` e `thud`), e some (`visible=false`).

## 5) Thread principal / loop de execucao

### 5.1 Estado atual (single-thread)

O jogo atual roda em uma unica thread JS principal (UI thread do browser):

- Input (mouse/teclado)
- Atualizacao de estado de jogo
- Render Pixi
- Timelines GSAP
- Audio Howler

Loop principal:

- `Game.animate()`:
  - se nao pausado: renderiza stage e avalia fim da wave
  - re-agenda a si mesmo com `requestAnimationFrame`

Timelines de animacao:

- Cada `Character` possui `this.timeline = gsap.timeline()`.
- Pause/resume global atua pausando/play nas timelines de dog e ducks.

### 5.2 Controle de wave/fase

- `Game.shouldWaveEnd()` encerra wave por:
  - tempo esgotado
  - sem bala e pato vivo
  - nenhum pato ativo
- `Stage.flyAway()` executa fuga dos patos vivos e animacao de risada do cachorro.
- Passagem entre levels depende de taxa de acerto (`SUCCESS_RATIO = 0.6`).

## 6) Pontos de extensao para IA (base tecnica)

- Entrada de tiro centralizada em `Game.handleClick` + `Stage.shotsFired`.
- Posicoes atuais dos patos disponiveis em `stage.ducks[i].position`.
- Estados dos patos disponiveis em `duck.alive`, `duck.visible`, `duck.state`.
- Raio de acerto ja existente (`level.radius`) pode ser reaproveitado como raio da mira.
- Necessidade de separar IA em Web Worker para nao bloquear `requestAnimationFrame`.

## 7) Riscos tecnicos observados

- Codigo atual nao tem arquitetura de plugins/modos de jogo; sera necessario introduzir camada de estrategia de controle.
- Nao ha infraestrutura de dataset/treino/versionamento de modelo.
- Nao ha detector de colisao desacoplado da coordenada de clique; tarefa da mira exige refatorar alvo do disparo.
- Thread principal ja concentra render + logica; IA sem worker pode degradar FPS.
