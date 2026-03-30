# IA de Mira Automática

## Como Modificar o Comportamento da IA

### 1. Ajustar Sensibilidade de Disparo

**Arquivo**: `src/workers/AIAimWorker.js`

```javascript
// Linha: const CONFIG = {
const CONFIG = {
  // ... outras configs ...
  CONFIDENCE_THRESHOLD: 0.6,    // Reduzir para disparo mais acessível
  LEAD_TIME_FRAMES: 6,           // Aumentar para prever mais à frente
  EPSILON_GREEDY: 0.1            // Aumentar para mais exploração
};
```

**Efeitos:**
- `CONFIDENCE_THRESHOLD: 0.3`: IA dispara mesmo com pato longe (agressivo)
- `CONFIDENCE_THRESHOLD: 0.8`: IA espera pato muito perto (conservador)
- `LEAD_TIME_FRAMES: 10`: IA prever mais casando voos rápidos
- `EPSILON_GREEDY: 0.2`: IA tenta coisas novas, aprender mais

### 2. Modificar Pesos de Aprendizado

**Arquivo**: `src/workers/AIAimWorker.js`

```javascript
class LearningModel {
  constructor() {
    this.weights = {
      distanceToCenter: -0.5,      // Importância de estar no centro
      leftBias: 0.0,               // Tendência para lado esquerdo
      topBias: 0.0,                // Tendência para lado superior
      velocityAlignment: 0.3,      // Importância de alinhar com velocidade
      duckCount: 0.2               // Bonus por múltiplos patos
    };
  }
}
```

**Como usar:**
1. Aumentar `distanceToCenter` → Prioriza acertos centrais
2. Aumentar `velocityAlignment` → Prioriza lead aiming
3. Aumentar `duckCount` → Prioriza situações de múltiplos patos
4. Adicionar biases → Corrigir para vieses observados do mapa

### 3. Alterar Estrutura de Recompensas

**Arquivo**: `src/workers/AIAimWorker.js`

```javascript
function shouldFire(frameState, targetPos) {
  // Modificar logic aqui
  
  // Atual:
  const shouldFireResult = confidence > CONFIG.CONFIDENCE_THRESHOLD && fireScore > 0;
  
  // Alternativa 1: Sempre dispara ao estar no raio
  const shouldFireResult = confidence > 0.4;
  
  // Alternativa 2: Mais seletivo
  const shouldFireResult = confidence > 0.8 && fireScore > 0.5;
}
```

**e em handleShotResult:**

```javascript
function handleShotResult(shotResult) {
  // Modificar recompensas
  
  // Atual:
  if (hits > 0) {
    reward = hits;
    if (isDoubleHit && hits === 2) reward = 2;
  } else {
    reward = -1;
  }
  
  // Alternativa: Triple bonus para double
  if (isDoubleHit && hits === 2) reward = 5;
  
  // Alternativa: Penalizar mais misses
  else reward = -2;
}
```

### 4. Implementar Detector TensorFlow.js

**Arquivo**: `src/workers/AIAimWorker.js`

Adicionar no topo do worker:

```javascript
// Já existe: importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.14.0');

// Adicionar:
let duckDetectionModel = null;

async function loadDuckDetector() {
  try {
    // Opção 1: Usar modelo pré-treinado from TensorFlow Hub
    duckDetectionModel = await tf.loadGraphModel(
      'https://tfhub.dev/google/tfjs-models/coco-ssd/1'
    );
    console.log('[Worker] Duck detector loaded');
  } catch (error) {
    console.error('[Worker] Failed to load model:', error);
  }
}

async function detectDucks(frameData) {
  if (!duckDetectionModel) return [];
  
  try {
    const predictions = await duckDetectionModel.detect(frameData);
    
    // Filtrar apenas patos
    const ducks = predictions.filter(p => 
      p.class === 'bird' && p.score > 0.5
    );
    
    return ducks.map(duck => ({
      x: duck.bbox[0] + duck.bbox[2] / 2,
      y: duck.bbox[1] + duck.bbox[3] / 2,
      confidence: duck.score
    }));
  } catch (error) {
    console.error('[Worker] Detection error:', error);
    return [];
  }
}

// Chamar em handleFrameState:
async function handleFrameState(frameState) {
  // ... existing code ...
  
  if (frameState.imageData) {
    const detectedDucks = await detectDucks(frameState.imageData);
    // Combinar com supervisão
  }
}
```

### 5. Adicionar Interface de Debug

**Arquivo**: `src/modules/AIMiraController.js`

```javascript
/**
 * Retorna estado debug para exibição
 */
getDebugInfo() {
  return {
    enabled: this.enabled,
    mode: this.mode,
    target: this.currentTarget,
    fireIntent: this.fireIntent,
    confidence: this.confidence,
    workerReady: this.workerReady,
    timestamp: this.lastTimestamp
  };
}
```

**Use em Game.js:**

```javascript
animate() {
  // ... existing code ...
  
  // Debug overlay
  if (DEBUG_MODE) {
    const debugInfo = this.aiController.getDebugInfo();
    console.log(`[DEBUG] Confidence: ${(debugInfo.confidence*100).toFixed(1)}% | Fire: ${debugInfo.fireIntent}`);
  }
}
```

### 6. Diferentes Estratégias de Aiming

**Arquivo**: `src/workers/AIAimWorker.js`

```javascript
const STRATEGY = {
  HEURISTIC: 'heuristic',        // Atual - distância based
  PREDICTIVE: 'predictive',      // Lead aiming puro
  MACHINE_LEARNING: 'ml',        // TensorFlow detector
  HYBRID: 'hybrid'                // Combinação
};

function calculateCrosshairTarget(frameState, strategy) {
  switch(strategy) {
    case STRATEGY.PREDICTIVE:
      return predictiveAiming(frameState);
    case STRATEGY.MACHINE_LEARNING:
      return mlBasedAiming(frameState);
    case STRATEGY.HYBRID:
      return hybridAiming(frameState);
    default:
      return heuristicAiming(frameState);
  }
}
```

### 7. Treinar Modelo Offline

Fora do escopo do jogo, em Python:

```python
import tensorflow as tf
from tensorflow import keras
import numpy as np

# Criar dataset de screenshots + labels
# X: imagens de ducks
# y: posição correta dentro de raio

model = keras.Sequential([
    keras.layers.Conv2D(32, 3, activation='relu', input_shape=(224, 224, 3)),
    keras.layers.MaxPooling2D(),
    keras.layers.Conv2D(64, 3, activation='relu'),
    keras.layers.Flatten(),
    keras.layers.Dense(128, activation='relu'),
    keras.layers.Dense(2)  # (x, y) offset
])

model.compile(optimizer='adam', loss='mse')
model.fit(X_train, y_train, epochs=50, validation_split=0.2)

# Converter para TensorFlow.js
!tensorflowjs_converter --input_format=keras model.h5 ./web_model
```

### 8. Persistência de Aprendizado

**Arquivo**: `src/modules/AIMiraController.js`

```javascript
/**
 * Salvar pesos aprendidos em localStorage
 */
saveWeights() {
  if (!this.worker) return;
  
  this.worker.postMessage({
    type: 'SAVE_WEIGHTS'
  });
}

/**
 * Carregar pesos salvos
 */
loadWeights() {
  if (!this.worker) return;
  
  const savedWeights = localStorage.getItem('ai_weights');
  if (savedWeights) {
    this.worker.postMessage({
      type: 'LOAD_WEIGHTS',
      weights: JSON.parse(savedWeights)
    });
  }
}
```

**No Worker:**

```javascript
function handleLoadWeights(weights) {
  workerState.learningModel.weights = weights;
  console.log('[Worker] Weights loaded from storage');
}

// Em outro lugar, quando quer salvar:
self.postMessage({
  type: 'WEIGHTS_UPDATED',
  weights: workerState.learningModel.weights
});
```

## Padrões de Customização

### Pattern 1: Modo Agressivo
```javascript
// em Game.js
if (this.gameMode === 'AGGRESSIVE_AI') {
  this.aiController.sendFrameState({
    ...frameState,
    difficulty: 'hard'  // Custom param
  });
}
```

### Pattern 2: Modo com Limite de Munição
```javascript
// Modificar shouldFire
if (frameState.ammo < 3 && !isHighConfidence) {
  // Economizar munição
  return false;
}
```

### Pattern 3: Modo Learning Persistente
```javascript
// No constructor do AIMiraController
constructor(opts) {
  // ...
  this.persistLearning = opts.persistLearning || false;
  
  if (this.persistLearning) {
    this.loadWeights();
  }
}

disable() {
  if (this.persistLearning) {
    this.saveWeights();
  }
  this.enabled = false;
}
```

## Monitoramento de Métricas

**Arquivo**: `src/workers/AIAimWorker.js`

```javascript
const METRICS = {
  shotsAttempted: 0,
  shotsHit: 0,
  double_hits: 0,
  avgConfidence: 0,
  avgDistance: 0
};

function recordMetric(type, value) {
  METRICS[type] = value;
}

function getMetrics() {
  return {
    ...METRICS,
    accuracy: METRICS.shotsHit / Math.max(1, METRICS.shotsAttempted),
    doubleHitRate: METRICS.double_hits / Math.max(1, METRICS.shotsHit)
  };
}
```

## Exemplo Completo: Modo Expert

```javascript
// Custom Mode - Expert IA com aprendizado agressivo

const EXPERT_CONFIG = {
  CONFIDENCE_THRESHOLD: 0.4,
  LEAD_TIME_FRAMES: 10,
  EPSILON_GREEDY: 0.05,
  LEARNING_RATE: 0.05,
  SMOOTHING_FACTOR: 0.08
};

// Ativar em Game.js
if (mode === 'EXPERT_AI') {
  this.aiController.enable(mode);
  this.aiController.sendConfigUpdate(EXPERT_CONFIG);
}
```

## Considerar ao Estender

1. **Performance**: Worker deve completar em < 5ms
2. **Escalabilidade**: Suportar até 100+ patos simultâneos?
3. **Determinismo**: Para testes reproduzíveis, seedar randomness
4. **Compatibilidade**: Garantir fallback para navegadores antigos
5. **Separação**: Manter lógica de game e AI bem separadas
