# Arte de BeastMixer

El arte se genera con IA de imágenes (se usó Nano Banana, de Google) y se procesa con un script para que el juego pueda armar cualquier combinación de piezas.

## Cómo funciona

1. Cada animal es **una imagen con cuatro piezas sueltas**, vistas desde arriba y mirando hacia arriba: cabeza, torso, pata delantera y pata trasera, sobre fondo magenta.
2. `tools/procesar_arte.py` quita el fondo, separa las piezas, las reduce de tamaño y calcula los puntos de anclaje:
   - **cabeza:** el centro de la base del cuello;
   - **torso:** el cuello, los hombros y las caderas, a partir del contorno del cuerpo (sin contar la cola);
   - **patas:** el extremo que se une al cuerpo.
3. El juego (`src/render/bestias.js`) arma cada bestia así: dibuja las patas en hombros y caderas (espejadas del otro lado), apoya la cabeza en el cuello y encima pone el torso. Cada pieza se escala según el ancho del torso que la recibe.

La vista cenital permite rotar las bestias en cualquier dirección sin dibujar cada ángulo.

## Regenerar o sumar un animal

1. Guardá la imagen como `arte/fuentes/<id>.jpg`. El id tiene que coincidir con `src/data/animales.js`.
2. Si es un animal nuevo, agregalo a `ANIMALES` en `tools/procesar_arte.py` y a `src/data/animales.js`.
3. Corré:

   ```
   python3 tools/procesar_arte.py
   ```

   Hace falta Python con `pillow`, `numpy` y `scipy`. Actualiza `assets/` y `src/data/sprites.js`.

El script frena si no encuentra exactamente cuatro piezas. En ese caso, pedile a la IA que las separe más.

## Prompts

### Primer animal (define el estilo)

```
Pixel art sprite sheet for a top-down strategy game. Strictly top-down view, camera directly above at 90 degrees, the animal is facing UP (toward the top of the image).

Draw the body parts of a WOLF as SEPARATE pieces, not assembled, with lots of empty space between them, arranged in one row from left to right:
1. HEAD: the head seen from above, snout pointing up, with a short neck stub at the bottom.
2. TORSO: the body seen from above WITHOUT head, legs or neck; include the tail at the bottom.
3. FRONT LEG: one single front leg seen from above, attached end at the top, paw at the bottom.
4. BACK LEG: one single hind leg seen from above, attached end at the top, paw at the bottom.

Style: detailed 16-bit pixel art like classic real-time strategy games (Age of Empires, StarCraft), naturalistic colors, strong readable silhouette, soft volume shading with light coming from the top-left, dark 1-pixel outline. Same pixel scale for all pieces. Proportions: the torso is about twice the length of the head.

Background: solid flat pure magenta (#FF00FF) everywhere, no gradient, no texture, no ground. No shadows on the ground, no text, no labels, no numbers, no borders, no grid lines.
```

### Los demás animales (adjuntando la imagen del primero)

```
Using the attached image as the exact style reference (same pixel art style, pixel size, outline, lighting from top-left, magenta background and layout), draw the same four separate pieces for a [ANIMAL]: HEAD, TORSO, FRONT LEG, BACK LEG, in one row from left to right, strictly top-down view facing UP, with lots of empty space between pieces.

Details for this animal: [DETAILS]

Background solid flat pure magenta (#FF00FF). No shadows, no text, no labels, no grid.
```

| Animal | [ANIMAL] | [DETAILS] |
|---|---|---|
| Tortuga | TORTOISE | domed shell with hexagonal plates as the torso; small beaked head; short stubby scaly legs |
| Araña | SPIDER | round abdomen with a red hourglass mark as the torso; small head with many eyes and two fangs; one long thin jointed leg for front and one for back |
| Rinoceronte | RHINOCEROS | thick grey wrinkled body; head with a big horn and a small second horn; thick legs |
| Escorpión | SCORPION | segmented amber body with the curled tail and stinger as part of the torso; head with two big pincers; thin jointed legs |
| Puercoespín | PORCUPINE | brown round body covered in long cream quills as the torso; small pointed snout; short dark legs |
| Elefante | ELEPHANT | large grey body; head with big ears, tusks and the trunk pointing up; thick round legs |
| Rana | FROG | green spotted body; wide head with two bulging yellow eyes; small front leg; big folded back leg with webbed foot |

### Mapa

Requisitos del juego: proporción 3:4 vertical; tres franjas (6 filas abajo, 4 en el medio, 6 arriba); simétrico al girarlo 180° para que los dos jugadores vean lo mismo; suelo tranquilo y sin obstáculos en el área de juego; sin grilla ni texto (los pone el juego).

```
Using the attached image as the exact style reference (same pixel art style, pixel size, dark outlines, lighting from the top-left), create the BACKGROUND MAP for a top-down strategy game battlefield.

Format: vertical image, aspect ratio 3:4. Strictly top-down view, camera directly above at 90 degrees, no perspective, no horizon.

Setting: an outdoor test arena of a genetics laboratory on a tropical island. The map is divided into three horizontal bands:
- BOTTOM 37% (player 1 deployment area): short, even grass with small dirt patches.
- MIDDLE 25% (no man's land): a dry, cracked riverbed of pale sand and small pebbles crossing the map from left to right, slightly darker than the grass areas.
- TOP 37% (player 2 deployment area): the same short grass as the bottom area.

The whole map must be 180-degree rotationally symmetric: the top half is the bottom half rotated 180 degrees.

Edges only (a thin border, no more than 5% of the width on each side): a low metal lab fence with posts, a few small bushes, rocks and two small concrete markers with lights. Nothing in the inner playing area: no trees, no rocks, no buildings, no water, no paths that look like obstacles.

The ground must be calm and low contrast so small creature sprites stay readable on top of it. Muted natural colors, slightly desaturated.

No grid lines, no text, no labels, no units, no creatures, no UI.
```

Variantes para otros mapas (mismo prompt, cambiando el escenario y las franjas):

| Mapa | Abajo y arriba | Medio | Bordes |
|---|---|---|---|
| Desierto | arena firme con grietas | duna baja de arena más clara | rocas rojizas, carteles de laboratorio semienterrados |
| Pantano | barro oscuro con charcos chicos | franja de agua poco profunda con juncos | árboles de manglar, pasarelas de madera |
| Nieve | nieve apisonada con huellas | hielo azulado | pinos, una estación de investigación |
| Laboratorio | piso de baldosas industriales | foso de rejilla metálica | máquinas, tanques de vidrio con líquido verde |

Los mapas se guardan como `arte/fuentes/mapa-<nombre>.jpg`. Por ahora el juego usa `isla`.
