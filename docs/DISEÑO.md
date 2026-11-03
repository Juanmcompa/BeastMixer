# BeastMixer — diseño y alcance

## ¿Qué tan lejos estamos?

Separado por escalones, porque cada uno es un salto distinto:

| Escalón | Qué incluye | Estado |
|---|---|---|
| **1. Prototipo jugable** | Mezcla de partes, despliegue en grilla, combate automático, rondas con vida, IA rival, duelo asíncrono por link | **Hecho (este repo).** Sirve para probar si el bucle es divertido. |
| **2. Vertical slice** | Arte propio por parte, sonido, 12–16 animales, tutorial, balance con jugadores reales, juego en celular pulido | Semanas a pocos meses en tiempo parcial con ayuda de IA. Lo que más cuesta es el arte. |
| **3. Juego publicable** | Servidor para el PvP (información oculta, anti-trampa, historial), cuentas, emparejamiento, más modos, tienda/Play Store | Meses. El código no es lo difícil; lo difícil es el arte y el balance. |

### Los tres problemas difíciles de verdad

1. **Arte combinatorio.** La magia de *Impossible Creatures* era que cualquier mezcla se veía bien (modelos 3D con partes intercambiables). Con 8 animales y 3 partes ya hay 512 bestias; con 20 animales son 8.000. El prototipo lo resuelve con **sprites por pieza vistos desde arriba** (cabeza, torso, pata delantera y trasera) que se encastran en puntos de anclaje comunes: cuello, hombros y caderas. Cada pieza se escala según el torso que la recibe. Ver [ARTE.md](ARTE.md). El siguiente salto es animar ataques y muertes, y probar vistas en 3/4 para dar más volumen.
2. **Balance combinatorio.** Con miles de combinaciones aparecen bestias rotas. Herramienta clave: simular miles de combates automáticamente (ya está la base en `tests/sim.test.mjs`) y buscar combinaciones dominantes.
3. **PvP sin trampa.** Hoy el link contiene el ejército del rival: alguien curioso podría decodificarlo antes de desplegar. Entre amigos alcanza. La solución es un servidor chico que guarde los ejércitos y sólo revele el del rival cuando los dos enviaron (por ejemplo, un Cloudflare Worker con almacenamiento KV). Como el combate es determinista, el servidor sólo guarda ejércitos y verifica resultados; no necesita correr el juego en tiempo real.

## Sobre la propiedad intelectual

*Impossible Creatures* (Relic, 2003) no está abandonado legalmente: desde 2015 los derechos son de **THQ Nordic**, que lo sigue vendiendo en Steam y GOG. Lo que conviene saber (no es asesoramiento legal):

- **Se puede tomar:** la idea de combinar partes de animales reales, el género auto-battler, mecánicas como rondas, despliegue y contraataque. Las mecánicas y los animales reales no tienen dueño.
- **No conviene tomar:** el nombre *Impossible Creatures*, sus personajes (Rex Chance, Dr. Chanikov, Lucy), su historia, arte, música, interfaz o textos. Tampoco presentar el juego como secuela o "remake oficial".
- Por eso el proyecto se llama **BeastMixer** y tiene identidad visual propia. Si algún día se publica comercialmente, consultá con un abogado de propiedad intelectual.

## Qué tomamos de cada referencia

**De Impossible Creatures:** la bestia como combinación de partes, donde cada parte aporta atributos y habilidades (caparazón, veneno, salto). Nombres híbridos generados ("Aratuga saltarín").

**De Mechabellum:**
- El ejército **persiste** entre rondas y cada ronda llega más presupuesto.
- Mientras desplegás, **ves lo que el rival puso la ronda pasada**, pero no lo nuevo: ahí está el juego de contrarrestar.
- El que pierde la ronda pierde vida según **cuántas unidades rivales sobrevivieron**.

Ya implementado de Mechabellum: mejoras por diseño (niveles) y el costo de cambiar de estrategia (reciclar veteranas devuelve la mitad). Todavía no: tecnologías, especialistas, cartas de refuerzo, escuadrones.

## Dificultad y progresión

El objetivo es que el juego sea difícil y que cada decisión pese. Se organiza en tres capas.

### 1. Una IA que contrarresta (implementado)

Como el combate es determinista y rápido, la IA **prueba antes de decidir**: arma muchos ejércitos candidatos y simula cada uno contra tu ejército de la ronda pasada (lo mismo que vos ves de ella; nunca mira lo que estás desplegando ahora).

| Dificultad | Qué hace |
|---|---|
| Aprendiz | Recetas fijas con algo de contra-elección |
| Rival | Prueba decenas de combinaciones contra tu último ejército |
| Experto | Prueba más, anticipa lo que podrías sumar y cuida la ubicación |
| Pesadilla | Búsqueda evolutiva: conserva y muta sus mejores ejércitos ronda a ronda |

Piensa en tandas cortas para no trabar la pantalla. En las pruebas, Rival y Experto le ganaron a Aprendiz en todas las partidas; Pesadilla todavía no es claramente más fuerte que Experto.

### 2. Progreso dentro de la partida (implementado en parte)

- **Mis bestias:** cada diseño que creás queda disponible toda la partida.
- **Niveles por diseño:** subir un diseño mejora todas sus copias (nivel 2: vida ×1,35 y daño ×1,25; nivel 3: vida ×1,75 y daño ×1,5). Cuesta 2× y 4× el costo de la bestia.
- **Veteranas:** reciclar algo que compraste esta ronda devuelve todo; reciclar algo que sobrevivió de una ronda anterior devuelve la mitad. La biomasa que no gastás se guarda.
- **Pendiente: mutaciones.** Cada ronda elegís 1 de 3 genes al azar para un diseño (*Sangre ácida*: daña al morir; *Corteza*: +3 armadura y −15% velocidad; *Feromonas*: aliados cercanos pegan 10% más; *Hambre*: se cura al matar; *Ojos compuestos*: +25% alcance).
- **Pendiente: familias.** Bonus por juntar 3 o más partes de una familia: mamíferos (fuerza en manada), artrópodos (veneno que se acumula más), reptiles y anfibios (regeneración).

### 3. Desbloqueables entre partidas (pendiente)

Regla para no romper el PvP: **se desbloquean opciones, no poder**.

- **Genoteca:** se arranca con 4 animales y los demás se ganan con logros. Animales nuevos con roles nuevos (murciélago que vuela, topo que aparece en la retaguardia, mantis con golpe crítico).
- **Expediciones:** campaña de rivales con personalidad en mapas distintos; cada victoria desbloquea un animal o una mutación.
- **Desafío del día:** el mismo ejército rival para todos, con presupuesto fijo; ganar gastando lo menos posible y compartir el resultado.
- **Informe de batalla:** qué diseño hizo más daño y cuál cayó primero, para entender por qué ganaste o perdiste.

## Partes del prototipo

| Animal | Cabeza (daño / cadencia / alcance) | Torso (vida / armadura) | Patas (velocidad) | Costo c+t+p |
|---|---|---|---|---|
| Lobo | 9 / 0.7 s / cuerpo a cuerpo · **Manada** | 110 / 0 | 115 | 4 + 4 + 3 |
| Tortuga | 8 / 1 s / cuerpo a cuerpo | 300 / 5 (pesado ×0.6) · **Caparazón** | 32 | 2 + 8 + 1 |
| Araña | 6 / 1 s / 150 · **Veneno** | 70 / 0 | 85 | 7 + 2 + 3 |
| Rinoceronte | 16 / 1.3 s / cuerpo a cuerpo · **Carga** | 230 / 3 (pesado ×0.85) | 70 | 5 + 6 + 3 |
| Escorpión | 9 / 1 s / cuerpo a cuerpo · **Aguijón** | 140 / 4 | 62 | 5 + 5 + 2 |
| Puercoespín | 8 / 0.9 s / cuerpo a cuerpo | 180 / 1 · **Espinas** | 55 | 2 + 5 + 2 |
| Elefante | 14 / 1.5 s / cuerpo a cuerpo · **Trompazo** | 380 / 2 (pesado ×0.75) | 45 | 6 + 8 + 2 |
| Rana | 8 / 0.9 s / 90 · **Lengua** | 80 / 0 · **Regenera** | 95 · **Salto** | 4 + 3 + 3 |

Reglas de daño: cada golpe resta la armadura del objetivo (mínimo 1). El veneno y las espinas ignoran la armadura. Las bestias a distancia retroceden si un cuerpo a cuerpo más lento se les viene encima.

## Decisiones técnicas del prototipo

- **HTML/JS sin dependencias**, scripts clásicos (no módulos) para que funcione con doble clic.
- **Simulación determinista**: paso fijo de 1/30 s, sólo operaciones con resultado idéntico en todos los navegadores, RNG con semilla, orden fijo. Mismo par de ejércitos + misma semilla = mismo combate en cualquier lado. La vida de cada jugador no se guarda: se recalcula re-simulando todas las rondas, así no se puede editar a mano.
- **Duelo por link**: el estado completo va en `#d=...` (menos de 100 caracteres en la ronda 1; crece unos 7 por bestia y por ronda). Cada navegador recuerda qué lado jugó en cada duelo, para avisar si abrís tu propio link.
- **Arte por piezas**: cuatro sprites por animal con anclajes calculados automáticamente (`tools/procesar_arte.py`). Si una imagen no carga, el juego vuelve al dibujo por código.
- **El render no toca la simulación**: lee posiciones y eventos e interpola entre pasos.

## Relación con la arquitectura en Godot

El prototipo parte de un reporte de arquitectura para un MVP de auto-battler en Godot 4 exportado a la web. Las ideas se tradujeron así:

| Godot | BeastMixer |
|---|---|
| `CriaturaData` / `MutacionData` (Resources) | `animales.js` + `ensamblar()`: tres partes en vez de base + mutación |
| `duplicate(true)` para no mutar plantillas | `ensamblar()` es una función pura; el catálogo nunca se modifica |
| `SignalBus.gd` (Autoload) | `BM.bus` en `base.js` |
| `GestorEconomia.gd` | `presupuesto()` y `costoEjercito()` en `partida.js` |
| `GameManager.gd` (DRAFT / COMBATE) | `juego.js` (fases draft → combate → resultado) |
| `CriaturaFSM.gd` + `distance_squared_to` | `simulacion.js`: buscar → mover → atacar → muerto |
| `calcular_anclaje_grilla()` | `celdaDesdeMundo()` / `posicionCelda()` |

La diferencia principal: en vez de `CharacterBody2D` + `move_and_slide()`, el combate es una simulación determinista propia, que es lo que habilita el PvP asíncrono.

## Próximos pasos sugeridos

1. Jugar varias partidas con amigos y anotar qué combinaciones dominan.
2. Ampliar a 12 animales con un rol claro cada uno (volador, excavador, a distancia de área, sanador).
3. Animaciones de ataque y muerte por pieza; más mapas con las variantes de ARTE.md.
4. Servidor mínimo para el duelo (Cloudflare Worker + KV): ocultar el ejército rival y guardar historial.
5. Mejoras de unidades entre rondas (a la Mechabellum) para que conservar el ejército tenga peso.
6. Si se decide pasar a Godot: portar `src/core` tal cual (es lógica pura) a GDScript y mantener la simulación determinista en vez de la física de `CharacterBody2D`.
