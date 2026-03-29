# Tarefa 2 - IA de Mira Automatica com TensorFlow.js (Worker separado)

## Objetivo

Implementar uma IA em thread separada para:

1. Detectar patos voando em tela.
2. Controlar a mira para perseguir o alvo (não usa o mouse como controle nesse modo).
3. Atirar automaticamente quando o alvo entrar no raio da mira.
4. Aprender com acertos/erros, incluindo bonus para double hit.

## Requisitos funcionais obrigatorios

- Rodar em Web Worker (nao bloquear thread principal).
- Usar TensorFlow.js.
- Usar sprites de patos voando como base de deteccao em `src/assets/images/duck`.
- Ignorar:
  - classes de pato em `dead` e `shot`
  - imagens do cachorro em `dog/single` e `dog/double`
- Acionar disparo automatico quando alvo entrar no circulo da mira.
- Reforco:
  - bonificacao quando acerta
  - penalidade quando erra
  - bonificacao dobrada quando acerta 2 patos no mesmo tiro
- Objetivo de medio prazo: prever direcao dos patos (lead aiming)

## Arquitetura proposta

### 1) Separacao por responsabilidades

Thread principal (jogo):

- Render Pixi
- Estado de partida
- Integracao de input humano e IA
- Verificacao oficial de hit (`Stage.shotsFiredAtPoint`)

Worker IA da mira:

- Inferencia de deteccao
- Predicao de deslocamento da mira
- Politica de disparo
- Atualizacao de parametros de aprendizado

Canal de mensagens:

- `postMessage` com payload enxuto e tipado.

### 2) Pipeline de visao

Entrada para IA:

- Frame reduzido (thumbnail do canvas, ex.: 200x150) ou metadados de entidades.
- Para reduzir custo inicial, fase 1 pode usar metadados de `stage.ducks` como supervisao bootstrap.

Rotulos supervisionados (deteccao):

- Positivos:
  - `duck/*/left/*`
  - `duck/*/right/*`
  - `duck/*/top-left/*`
  - `duck/*/top-right/*`
- Negativos/excluir:
  - `duck/*/dead/*`
  - `duck/*/shot/*`
  - `dog/single/*`
  - `dog/double/*`

Observacao:

- Evitar treino full in-browser em runtime de partida para nao degradar UX.
- Recomenda-se pre-treino offline e uso de modelo inicial em `dist/models/...`.

### 3) Acao da IA na mira

Saida do worker por tick:

- `targetCrosshairX`, `targetCrosshairY`
- `fireIntent` (boolean)
- `confidence` da deteccao

Main thread aplica:

- filtro/smoothing na mira
- bloqueios de tiro (balas, pausa, fim de wave)
- se permitido e `fireIntent=true`, chama disparo no centro da mira

### 4) Aprendizado nao supervisionado para acerto/erro

Sinal de recompensa sugerido:

- `+1` para acerto simples
- `+2` para double hit no mesmo disparo
- `-1` para tiro sem acerto

Estado minimo por amostra:

- vetor com posicao/velocidade estimada do(s) pato(s), posicao da mira, distancia ao centro da mira, tempo ate borda.

Objetivo de politica:

- maximizar hits por bala e pontuacao por wave.

### 5) Predicao de direcao (lead)

Heuristica inicial:

- estimar velocidade do pato por diferenca de posicao entre frames
- mirar em ponto futuro:
  - $p_{futuro} = p_{atual} + v * t$

`t` pode ser ajustado por gradiente/recompensa.

## Contratos de mensagem sugeridos

Main -> Worker:

- `type: FRAME_STATE`
- `timestamp`
- `ducks: [{id, x, y, alive, state}]`
- `crosshair: {x, y, radius}`
- `ammo`
- `paused`

Worker -> Main:

- `type: AIM_ACTION`
- `target: {x, y}`
- `fireIntent`
- `confidence`

Main -> Worker (feedback):

- `type: SHOT_RESULT`
- `hits`
- `reward`
- `wave`

## Fases de implementacao recomendadas

1. Infraestrutura worker + contratos de mensagem.
2. Auto-aim por heuristica (sem rede neural) para baseline.
3. Detector supervisionado com tfjs.
4. Politica de disparo com reforco (reward/penalty).
5. Predicao de direcao calibrada por desempenho.

## Criterios de aceite

1. IA roda em worker separado e nao bloqueia render.
2. Mira segue alvos detectados e dispara automaticamente.
3. Sistema ignora classes proibidas (`dead`, `shot`, `dog/single`, `dog/double`).
4. Feedback de recompensa considera double hit com bonus dobrado.
5. Existe melhora observavel de acuracia apos rounds consecutivos.

## Riscos e mitigacoes

- Risco: custo de inferencia alto no browser.
  - Mitigacao: resize de frame, batch pequeno, modelo leve (MobileNet/Head custom).
- Risco: labels fracos por sprites repetidas.
  - Mitigacao: augmentations simples (flip, brilho, ruido).
- Risco: drift de politica de tiro.
  - Mitigacao: epsilon-greedy com limite minimo de exploracao.
