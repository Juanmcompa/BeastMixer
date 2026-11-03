# BeastMixer

Prototipo jugable de un **auto-battler de bestias híbridas**: armás criaturas combinando cabeza, torso y patas de animales distintos (la idea de *Impossible Creatures*), las desplegás en tu mitad del tablero y el combate se juega solo, ronda tras ronda (la estructura de *Mechabellum*).

Es HTML + JavaScript puro: sin instalar nada, sin compilar, sin dependencias.

## Cómo jugar

- **En tu compu:** abrí `index.html` con doble clic.
- **Publicado:** en GitHub, *Settings → Pages → Deploy from a branch → `main` / `(root)`*. Queda en `https://<tu-usuario>.github.io/BeastMixer/`.

Modos:

1. **Contra la IA.** La IA conserva su ejército entre rondas, suma bestias nuevas y elige recetas que contrarrestan lo que desplegaste la ronda anterior.
2. **Duelo por link (PvP asíncrono).** Desplegás tu ronda y mandás el link por WhatsApp. Tu amigo lo abre, despliega la suya, ve el combate y te devuelve otro link. Todo el estado viaja en el link; no hace falta servidor.

## Reglas en una mirada

| | |
|---|---|
| Cabeza | cómo ataca: daño, cadencia, alcance y habilidad ofensiva |
| Torso | cuánto aguanta: vida, armadura, tamaño; los torsos pesados frenan |
| Patas | qué tan rápido va |
| Biomasa | 60 en la ronda 1 y +40 por ronda (acumulado). Reciclar devuelve el 100%. |
| Ronda | el que pierde pierde 8 de vida + 1 por cada 4 de costo de las bestias rivales que quedaron en pie |
| Partida | 100 de vida cada uno; gana quien deja al otro en 0 |

Triángulo base que verifican los tests: **tortugas** (armadura) frenan a los **lobos** (mordidas rápidas); el **veneno de araña** ignora la armadura; los **lobos** alcanzan a las arañas antes de que hagan daño.

## Estructura

```
index.html              página y pantallas
css/estilo.css          estética de cianotipo / plano técnico
src/data/animales.js    TODOS los números del juego (partes, habilidades, reglas)
src/core/base.js        bus de señales + RNG con semilla
src/core/criatura.js    ensamblaje: cabeza + torso + patas → estadísticas y nombre
src/core/simulacion.js  combate determinista a paso fijo (FSM por criatura)
src/core/partida.js     economía, codificación de ejércitos, duelo por link
src/core/ia.js          IA rival con recetas y contra-elección
src/render/bestias.js   dibujo procedural de cada parte (sin sprites)
src/render/campo.js     tablero, efectos, barras de vida
src/ui/juego.js         GameManager: fases, laboratorio, gestos, flujo del duelo
tests/sim.test.mjs      determinismo, codificación y balance
docs/DISEÑO.md          diseño, alcance real, propiedad intelectual y hoja de ruta
```

Para tocar el balance, editá `src/data/animales.js` y corré los tests:

```
node tests/sim.test.mjs
```

## Relación con el documento de arquitectura en Godot

El prototipo sigue las ideas del reporte *Arquitectura Godot MVP Auto-Battler*, traducidas a la web:

| Godot (PDF) | Acá |
|---|---|
| `CriaturaData` / `MutacionData` (Resources) | `animales.js` + `ensamblar()`: tres partes en vez de base + mutación |
| `duplicate(true)` para no mutar plantillas | `ensamblar()` es una función pura; el catálogo nunca se modifica |
| `SignalBus.gd` (Autoload) | `BM.bus` en `base.js` |
| `GestorEconomia.gd` | `presupuesto()` y `costoEjercito()` en `partida.js` |
| `GameManager.gd` (DRAFT / COMBATE) | `juego.js` (fases draft → combate → resultado) |
| `CriaturaFSM.gd` + `distance_squared_to` | `simulacion.js`: buscar → mover → atacar → muerto |
| `calcular_anclaje_grilla()` | `celdaDesdeMundo()` / `posicionCelda()` |

Una diferencia a propósito: en vez de `CharacterBody2D` + `move_and_slide()`, el combate es una **simulación determinista** propia. Es lo que permite el PvP asíncrono: los dos jugadores re-simulan el mismo combate y ven exactamente lo mismo.

---

Prototipo en desarrollo · Desarrollado por Juan M. Comparini
