# Tarefa 3 - IA dos Patos com Algoritmo Genetico (Worker separado)

## Objetivo

Criar uma IA em thread separada para controlar o movimento dos patos, substituindo trajetoria aleatoria por comportamento adaptativo de evasao da mira.

## Requisitos funcionais obrigatorios

- Rodar em Web Worker independente da IA da mira.
- Usar TensorFlow.js apenas se necessario para componentes auxiliares; nucleo de decisao baseado em algoritmo genetico.
- Patos devem identificar aproximacao da mira e desviar automaticamente.
- Comportamento deve preservar jogabilidade (nao pode tornar acerto impossivel).

## Estado atual de movimento (baseline)

- `Duck.randomFlight` escolhe destino aleatorio com distancia minima.
- `Duck.flyTo` executa tween linear ate destino e reinicia ciclo.
- Nao existe reacao ao estado da mira.

## Arquitetura proposta

### 1) Worker de IA dos patos

Responsabilidades:

- Evoluir parametros de movimento evasivo por geracoes.
- Receber estado resumido da partida e devolver vetor de direcao para cada pato vivo.

Entrada por tick:

- posicao da mira, raio, velocidade da mira
- posicao/velocidade dos patos
- limites do mapa

Saida por tick:

- para cada pato vivo: `desiredVelocity` ou `nextTargetPoint`

### 2) Representacao genetica

Gene sugerido por individuo (pato/agente):

- peso de repulsao da mira
- peso de inercia da direcao atual
- peso de borda (evitar sair da tela)
- fator de zig-zag
- fator de mudanca brusca maximo
- horizonte de predicao da mira

Fitness por episodio:

- sobrevivencia (tempo vivo)
- penalidade por ficar parado ou sair de area valida
- penalidade por trajetoria nao natural (jitter excessivo)
- penalidade forte ao ser abatido

### 3) Integracao com motor atual

Mudancas recomendadas:

- Introduzir modo de movimento em `Duck`:
  - `RANDOM` (atual)
  - `EVADE_AI` (novo)
- Em `EVADE_AI`, substituir cadeia `randomFlight -> flyTo(onComplete randomFlight)` por atualizacao incremental de destino/velocidade a cada tick.
- Stage/game enviam snapshot dos patos e mira para worker de evasao.

### 4) Convivencia com IA da mira (Tarefa 2)

- Manter workers separados:
  - Worker A: mira
  - Worker B: evasao dos patos
- Main thread arbitra:
  - atualiza mira
  - atualiza patos
  - valida colisao final

## Contratos de mensagem sugeridos

Main -> DuckWorker:

- `type: DUCK_STATE`
- `timestamp`
- `crosshair: {x, y, radius, vx, vy}`
- `ducks: [{id, x, y, vx, vy, alive}]`
- `bounds: {minX, maxX, minY, maxY}`

DuckWorker -> Main:

- `type: DUCK_ACTION`
- `actions: [{id, targetX, targetY, speed}]`

Main -> DuckWorker (feedback):

- `type: DUCK_REWARD`
- `duckId`
- `survivedMs`
- `shot` (boolean)
- `reward`

## Fases de implementacao recomendadas

1. Worker de evasao com heuristica fixa (sem GA) para baseline.
2. Implementar GA simples (populacao pequena + mutacao).
3. Evoluir fitness multiobjetivo (sobrevivencia x naturalidade).
4. Ajustar dificuldade por nivel para balanceamento.

## Criterios de aceite

1. Patos deixam de seguir apenas trajetoria aleatoria no modo IA.
2. Patos reagem de forma consistente a aproximacao da mira.
3. Execucao permanece fluida (sem queda severa de FPS).
4. Evolucao genetica melhora taxa media de sobrevivencia ao longo das geracoes.
5. Existe parametro de balanceamento para evitar dificuldade injusta.

## Riscos e mitigacoes

- Risco: comportamento caotico/incontrolavel.
  - Mitigacao: clamps de velocidade, suavizacao angular, penalidade por jitter.
- Risco: acoplamento dificil com timelines GSAP atuais.
  - Mitigacao: criar camada de movimento desacoplada e atualizar posicao por tick.
- Risco: custo de dois workers + render.
  - Mitigacao: reduzir frequencia de atualizacao da IA (ex.: 10-20 Hz) e interpolar no render.
