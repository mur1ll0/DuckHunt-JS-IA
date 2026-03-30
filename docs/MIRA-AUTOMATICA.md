# IA de Mira Automatica

## Visao geral

A mira automatica roda em um Web Worker separado e controla dois comportamentos:

- mover a mira para acompanhar patos validos
- decidir quando disparar

A integracao principal acontece entre:

- `src/modules/Game.js`
- `src/modules/AIMiraController.js`
- `src/workers/AIAimWorker.js`

## Como ativar no jogo

No menu principal, marque a opcao **Mira automatica** e clique em **Iniciar jogo**.

A opcao pode ser combinada com **Patos com IA genetica**. Ou seja, as duas IAs podem rodar ao mesmo tempo.

## Fluxo de execucao

1. `Game` envia `FRAME_STATE` para o worker via `AIMiraController.sendFrameState()`.
2. O worker calcula alvo da mira com previsao de movimento do pato (lead aiming).
3. O worker retorna `AIM_ACTION` com:
   - `target` (novo alvo da mira)
   - `fireIntent` (se deve atirar)
   - `confidence`
4. `Game` aplica o alvo da mira e, se houver `fireIntent`, executa o disparo.
5. Resultado do disparo volta ao worker por `SHOT_RESULT` para ajustar pesos de aprendizado.

## O que o worker considera

O worker filtra patos invalidos antes de mirar:

- pato morto
- pato em estado de tiro
- pato fora da janela de voo (proximo ao chao)

Depois disso ele:

- escolhe pato valido mais proximo da mira
- estima velocidade do pato
- projeta posicao futura usando `LEAD_TIME_FRAMES`
- aplica suavizacao adaptativa de mira conforme velocidade dos patos

## Parametros principais (AIAimWorker)

Arquivo: `src/workers/AIAimWorker.js`

- `LEAD_TIME_FRAMES`: quantos frames prever a frente
- `CONFIDENCE_THRESHOLD`: limiar minimo para disparo
- `BASE_SMOOTHING_FACTOR`: suavizacao base da mira
- `MAX_DISTANCE_TO_FIRE`: limite relativo para permitir tiro
- `GROUND_EXCLUSION_HEIGHT`: faixa inferior onde alvo e ignorado

## Aprendizado por recompensa

`AIMiraController.sendShotResult()` envia recompensa ao worker:

- acerto: recompensa positiva (proporcional a hits)
- erro: recompensa negativa

No worker, `LearningModel.updateWeights()` ajusta pesos como:

- `distanceToCenter`
- `velocityAlignment`
- `duckCount`
- `leadPrediction`

## Interacao com input do jogador

Quando a mira automatica esta ativa:

- movimento manual da mira por mouse e ignorado
- clique manual de tiro e ignorado
- links de HUD (menu, pause, mute, fullscreen) continuam funcionando

## Dicas de ajuste

- IA muito lenta para acompanhar pato rapido:
  - aumentar `BASE_SMOOTHING_FACTOR` ou `LEAD_TIME_FRAMES`
- IA atirando cedo demais:
  - aumentar `CONFIDENCE_THRESHOLD`
- IA conservadora demais:
  - reduzir `CONFIDENCE_THRESHOLD`

## Observacoes

- O worker usa `importScripts` de TensorFlow.js, mas a decisao atual de mira/disparo e heuristica + feedback de recompensa.
- A mira automatica foi feita para operar sem bloquear renderizacao, por isso todo calculo de decisao fica no worker.
