# IA dos Patos com Algoritmo Genetico

## Visao geral

A IA genetica dos patos roda em um Web Worker dedicado para manter o loop de renderizacao leve.

Componentes principais:

- `src/modules/Game.js`: envia estado do jogo e aplica acoes calculadas
- `src/modules/AIDuckController.js`: ponte entre thread principal e worker
- `src/workers/AIDuckWorker.js`: evolucao genetica, decisao e fitness
- `src/modules/Stage.js` e `src/modules/Duck.js`: aplicam movimento evasivo no palco

## Objetivo da IA

A IA tenta manter os patos vivos por mais tempo, desviando da mira e evitando trajetorias ruins.

Na pratica, cada pato recebe um genoma e o worker calcula um vetor de movimento por tick.

## Ativacao no jogo

No menu principal:

1. Marque **Patos com IA genetica**.
2. Clique em **Iniciar jogo**.
3. Opcionalmente combine com **Mira automatica**.

Quando o modo genetico esta ativo:

- o movimento dos patos usa `MOVEMENT_MODE.EVADE_AI`
- o fim de partida em vitoria/derrota reinicia automaticamente para continuar treino

## Ciclo por frame

Fluxo resumido:

1. `Game.animate()` coleta estado atual (mira, velocidade da mira, patos vivos, bounds).
2. `AIDuckController.sendDuckState()` envia `DUCK_STATE` ao worker com throttle.
3. `AIDuckWorker` calcula `DUCK_ACTION` para cada pato vivo.
4. `Stage.applyDuckAIActions()` aplica alvo e velocidade no objeto `Duck`.
5. `Duck.updateAIMovement()` integra movimento suavizado e clampa dentro da area aerea.

## Representacao do genoma

Cada individuo da populacao possui os genes:

- `repulsionWeight`: forca de afastamento da mira prevista
- `inertiaWeight`: continuidade de direcao (inercia)
- `edgeWeight`: forca de retorno ao miolo da area permitida
- `zigzagWeight`: componente lateral oscilatoria
- `turnClamp`: limite de mudanca brusca de direcao por tick
- `predictionHorizon`: horizonte de previsao da posicao futura da mira
- `speedBias`: multiplicador de velocidade do deslocamento

## Como a acao e calculada

Para cada pato vivo, o worker:

1. Prediz a posicao futura da mira usando velocidade atual da mira e `predictionHorizon`.
2. Calcula vetor de fuga da mira prevista.
3. Soma componentes de inercia, borda e zig-zag.
4. Limita viradas bruscas com `turnClamp`.
5. Gera alvo final `targetX/targetY` e `speed`.

Mensagem de saida:

- `DUCK_ACTION` com lista de acoes por `duck.id`

## Fitness e recompensa

Aptidao por episodio combina:

- sobrevivencia (`survivedMs / 6000`)
- penalidade forte se foi abatido (`shot`)
- bonus se terminou vivo no fechamento da wave
- recompensa adicional enviada pela thread principal (`reward`)
- penalidades por jitter excessivo e estagnacao

Recompensas enviadas por `Game`:

- ao ser abatido: `reward: -1.6`
- ao fim de wave vivo: `reward: 0.75`

## Evolucao genetica

Parametros atuais no worker:

- `POPULATION_SIZE = 24`
- `ELITE_COUNT = 4`
- `MUTATION_RATE = 0.2`
- `MUTATION_STRENGTH = 0.18`

Regra de evolucao:

- quando `totalSamples >= POPULATION_SIZE * 3`, a populacao evolui
- melhores individuos sao preservados por elitismo
- restante nasce de crossover + mutacao
- `generation` incrementa

## Persistencia

Persistencia via `localStorage` na chave:

- `duckhunt.duck_ai.ga_state.v1`

Fluxo:

1. Ao iniciar, `AIDuckController` envia estado salvo no `INIT`.
2. O worker sanitiza populacao e carrega geracao/campeao.
3. Periodicamente (`PERSIST_EVERY_MS`), worker envia `DUCK_PERSIST`.
4. Controller grava novamente no `localStorage`.

Isso permite continuar o treino entre sessoes.

## Debug

Debug pode ser ligado por:

- query string: `?duckAIDebug=1`
- toggle em runtime com tecla `g`

Metrica exibida na HUD:

- geracao
- best fitness
- median fitness
- total de samples
- patos vivos

## Restricao de voo (nao voltar ao chao)

O modo genetico usa bounds aereos e clamp continuo de posicao:

- bounds definidos em `Stage` (`DUCK_AI_BOUNDS`)
- clamp aplicado ao nascer e durante atualizacao de movimento

Assim os patos permanecem na janela de voo jogavel.

## Pontos de ajuste rapido

Se quiser acelerar o treino:

- aumentar levemente `MUTATION_STRENGTH`
- reduzir penalidade de jitter se trajetoria estiver muito dura
- revisar bonus de sobrevivencia no fim da wave

Se o voo ficar caotico:

- reduzir `zigzagWeight` maximo
- reduzir `turnClamp` maximo
- aumentar peso de inercia
