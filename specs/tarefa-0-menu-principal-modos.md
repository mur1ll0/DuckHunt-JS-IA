# Tarefa 0 - Menu Principal com Modos de Jogo

## Objetivo

Adicionar um menu principal antes do inicio da partida para selecionar o modo:

1. Normal (comportamento atual)
2. Mira automatica (base para Tarefa 1 + Tarefa 2)
3. Modo guiado por IA (evolucao completa com IA da mira e IA dos patos)

## Escopo funcional

- O jogo deve abrir em tela de menu e iniciar somente apos selecao de modo.
- O modo selecionado deve ser persistido em memoria durante a sessao e refletir no fluxo de entrada/controle.
- Deve existir opcao de retornar ao menu ao final da partida (replay/menu).

## Arquitetura proposta

### 1) Estado global de modo

Criar enum central:

- `GAME_MODE.NORMAL`
- `GAME_MODE.AUTO_AIM`
- `GAME_MODE.IA_GUIDED`

Local recomendado:

- Novo arquivo `src/modules/GameModes.js`.

### 2) Tela de menu

Abordagem recomendada:

- Implementar menu como camada Pixi (`Container`) para manter renderizacao no mesmo canvas.
- Alternativa: overlay HTML/CSS em cima do canvas.

Comportamentos:

- Enquanto menu estiver ativo, `Game.animate()` continua renderizando o menu, mas sem iniciar `startLevel()`.
- Ao selecionar modo:
  - salva `gameMode`
  - remove/oculta menu
  - chama `startLevel()`.

### 3) Integracao com fluxo atual

No `Game.onLoad()`:

- Hoje inicia automaticamente `startLevel()`.
- Novo comportamento: inicializar HUD minimo + abrir menu.

No `Game.handleClick(event)`:

- Se menu ativo, click deve ser tratado pelo menu.
- Se menu inativo, segue fluxo normal do jogo.

## Alteracoes esperadas (alto nivel)

- `src/modules/Game.js`:
  - adicionar estado `gameMode`
  - controlar exibicao menu
  - bloquear inicio automatico da fase
- `src/modules/Stage.js` ou novo `src/modules/MainMenu.js`:
  - renderizar botoes e hitbox de selecao
- `src/modules/Hud.js`:
  - opcional: texto fixo com modo atual no rodape

## Criterios de aceite

1. Ao carregar a pagina, o jogo nao inicia wave sem escolha de modo.
2. Os 3 modos estao disponiveis e selecionaveis.
3. Modo selecionado fica acessivel para as tarefas seguintes.
4. Replay permite reiniciar no mesmo modo e existe opcao de voltar ao menu.

## Riscos e mitigacoes

- Risco: conflitar eventos de click do menu com HUD.
  - Mitigacao: gate explicito `if (menuAtivo) return handleMenuClick(...)` no inicio do `handleClick`.
- Risco: acoplamento excessivo de UI de menu ao Game.
  - Mitigacao: componente dedicado (`MainMenu`).

## Entregaveis

- Implementacao do menu
- Enumeracao de modos
- Documentacao rapida no README principal sobre como testar cada modo
