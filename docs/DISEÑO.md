# BeastMixer — diseño y alcance

## ¿Qué tan lejos estamos?

Separado por escalones, porque cada uno es un salto distinto:

| Escalón | Qué incluye | Estado |
|---|---|---|
| **1. Prototipo jugable** | Mezcla de partes, despliegue en grilla, combate automático, rondas con vida, IA rival, duelo asíncrono por link | **Hecho (este repo).** Sirve para probar si el bucle es divertido. |
| **2. Vertical slice** | Arte propio por parte, sonido, 12–16 animales, tutorial, balance con jugadores reales, juego en celular pulido | Semanas a pocos meses en tiempo parcial con ayuda de IA. Lo que más cuesta es el arte. |
| **3. Juego publicable** | Servidor para el PvP (información oculta, anti-trampa, historial), cuentas, emparejamiento, más modos, tienda/Play Store | Meses. El código no es lo difícil; lo difícil es el arte y el balance. |

### Los tres problemas difíciles de verdad

1. **Arte combinatorio.** La magia de *Impossible Creatures* era que cualquier mezcla se veía bien (modelos 3D con partes intercambiables). Con 8 animales y 3 partes ya hay 512 bestias; con 20 animales son 8.000. El prototipo lo resuelve dibujando cada parte por código con la paleta de su animal. Para un juego final hay que diseñar **un sistema de partes con puntos de anclaje comunes** (cuello, cadera, hombros), ya sea en 2D vectorial, sprites por parte o 3D low-poly. Es un problema de diseño gráfico antes que de programación.
2. **Balance combinatorio.** Con miles de combinaciones aparecen bestias rotas. Herramienta clave: simular miles de combates automáticamente (ya está la base en `tests/sim.test.mjs`) y buscar combinaciones dominantes.
3. **PvP sin trampa.** Hoy el link contiene el ejército del rival: alguien curioso podría decodificarlo antes de desplegar. Entre amigos alcanza. La solución es un servidor chico que guarde los ejércitos y sólo revele el del rival cuando los dos enviaron (como el Worker de Cloudflare que ya usás para Shakedown). Como el combate es determinista, el servidor sólo guarda ejércitos y verifica resultados; no necesita correr el juego en tiempo real.

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

Todavía no implementado de Mechabellum: mejoras por unidad, tecnologías, especialistas, cartas de refuerzo, escuadrones, veteranía.

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
- **El render no toca la simulación**: lee posiciones y eventos e interpola entre pasos.

## Próximos pasos sugeridos

1. Jugar varias partidas con amigos y anotar qué combinaciones dominan.
2. Ampliar a 12 animales con un rol claro cada uno (volador, excavador, a distancia de área, sanador).
3. Diseñar el sistema de arte por partes con anclajes comunes.
4. Servidor mínimo para el duelo (Cloudflare Worker + KV): ocultar el ejército rival y guardar historial.
5. Mejoras de unidades entre rondas (a la Mechabellum) para que conservar el ejército tenga peso.
6. Si se decide pasar a Godot: portar `src/core` tal cual (es lógica pura) a GDScript y mantener la simulación determinista en vez de la física de `CharacterBody2D`.
