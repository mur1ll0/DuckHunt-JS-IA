# Especificacoes do DuckHunt-JS-IA

Este diretorio consolida:

1. O mapeamento tecnico do jogo atual (sprites, tiro, movimento dos patos, loop principal).
2. As especificacoes de evolucao para IA e novos modos de jogo (Tarefas 0 a 3).

## Indice

- `arquitetura-atual.md`: estado atual do projeto com referencia aos pontos criticos no codigo.
- `tarefa-0-menu-principal-modos.md`: menu principal para selecionar modo de jogo.
- `tarefa-1-mira-spread-e-seguimento.md`: mira com spread, centro de disparo e inercia de movimento.
- `tarefa-2-ia-mira-automatica-tensorflow.md`: IA de deteccao de patos e disparo automatico.
- `tarefa-3-ia-patos-algoritmo-genetico.md`: IA dos patos para desvio da mira.

## Escopo desta fase

Nesta fase foi criado somente o pacote de especificacoes. Nenhuma alteracao funcional foi aplicada ao jogo.

## Dependencias relevantes para proximas tarefas

- Renderizacao: PixiJS
- Animacao: GSAP
- Audio: Howler
- Promises/async utilitario: Bluebird
- Build/dev: Webpack + Gulp
- IA planejada: TensorFlow.js
