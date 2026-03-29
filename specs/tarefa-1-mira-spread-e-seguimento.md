# Tarefa 1 - Mira com Spread e Seguimento do Mouse

## Objetivo

Adicionar uma mira visual (circulo vermelho) que represente exatamente a area de acerto do tiro.

Regras obrigatorias:

- A mira segue o mouse com atraso/inercia (nao teleporta para o clique).
- O disparo usa o centro da mira (nao usa diretamente a coordenada do clique).
- A area da mira deve equivaler ao `radius` de acerto do nivel.

## Escopo funcional

1. Exibir mira em tela durante a partida.
2. Atualizar alvo da mira continuamente com base no mouse.
3. Aplicar suavizacao no movimento da mira.
4. Alterar logica de tiro para usar `crosshair.position`.

## Especificacao tecnica

### 1) Componente de mira

Criar novo modulo sugerido:

- `src/modules/Crosshair.js`

Representacao:

- `Graphics` do Pixi desenhando:
  - circulo externo vermelho com raio = `level.radius`
  - ponto central pequeno (centro do disparo)

Estado minimo:

- `position` (x, y) atual
- `targetPosition` (x, y) derivado do mouse
- `smoothingFactor` (ex.: 0.12)

Atualizacao por frame:

- A cada frame, aproximar mira do alvo:
  - $x = x + (targetX - x) * a$
  - $y = y + (targetY - y) * a$
- Onde $a$ eh o smoothingFactor.

### 2) Captura de mouse

Em `Game.bindEvents()`:

- Registrar `pointermove` no canvas para atualizar `targetPosition` da mira.
- Registrar `pointerdown` apenas para comando de atirar.

### 3) Alteracao da origem do tiro

No `Game.handleClick(event)`:

- Manter validacoes de HUD/menu.
- Trocar alvo do tiro de `clickPoint` para `crosshairCenter`.

Implementacao sugerida:

- Criar metodo em `Stage`: `shotsFiredAtPoint(worldPoint, radius)`.
- `shotsFired(clickPoint, radius)` pode ser mantido por compatibilidade e delegar para o novo metodo.

### 4) Conversao de coordenadas

Como stage eh escalado para janela, manter conversao para sistema interno 800x600.

- `crosshairCenter` deve estar no mesmo sistema usado em `duck.position` antes da comparacao de distancia.

### 5) Sincronizacao visual x hitbox

Requisito de consistencia:

- Raio visual da mira == `level.radius`.
- Formula de hit continua `pointDistance < radius` para preservar comportamento.

## Criterios de aceite

1. Mira visivel durante jogo em modo automatico/IA.
2. Mira acompanha mouse com atraso perceptivel (sem salto instantaneo).
3. Clique dispara no centro da mira mesmo se mouse estiver em outra posicao no momento.
4. Taxa de acerto respeita exatamente o mesmo raio da mira.
5. Nao quebra controles existentes de pause/mute/fullscreen.

## Metricas sugeridas de validacao

- FPS medio antes/depois da mira.
- Erro medio entre ponteiro e mira ao longo do tempo (deve convergir).
- Testes manuais de acerto na borda do circulo.

## Riscos e mitigacoes

- Risco: jitter por escala e coordenadas de tela.
  - Mitigacao: converter tudo para coordenadas do stage antes de calcular distancia.
- Risco: disputa de input entre HUD e tiro.
  - Mitigacao: processar HUD primeiro; tiro apenas se click nao for em links.
