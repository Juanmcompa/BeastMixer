#!/usr/bin/env python3
"""
BeastMixer — procesa el arte generado (fondo magenta) y lo deja listo para el juego.

Entrada:  arte/fuentes/<animal>.jpg   una fila con 4 piezas: cabeza, torso, pata delantera, pata trasera
          arte/fuentes/mapa-<nombre>.jpg   fondo del tablero (proporción 3:4)
Salida:   assets/bestias/<animal>-<pieza>.png   piezas recortadas con transparencia
          assets/mapas/<nombre>.jpg
          src/data/sprites.js   tamaños y puntos de anclaje (cuello, hombros, caderas)

Uso:  python3 tools/procesar_arte.py
Requiere: pillow, numpy, scipy
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUENTES = os.path.join(RAIZ, 'arte', 'fuentes')
SALIDA_B = os.path.join(RAIZ, 'assets', 'bestias')
SALIDA_M = os.path.join(RAIZ, 'assets', 'mapas')
ANIMALES = ['lobo', 'tortuga', 'arana', 'rino', 'escorpion', 'puercoespin', 'elefante', 'rana']
PIEZAS = ['cabeza', 'torso', 'pataDel', 'pataTras']
ESCALA = 1 / 3          # las fuentes vienen grandes; esto alcanza para pantallas 2x
HUECO_MIN = 20          # columnas vacías que separan una pieza de otra


def mascara_fondo(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    dist = np.sqrt((r - 255) ** 2 + g ** 2 + (b - 255) ** 2)
    magenta = (r > 120) & (b > 120) & (g < np.minimum(r, b) - 55)
    return (dist < 150) | magenta


def quitar_derrame(rgb, fondo):
    """Saca el tinte magenta del borde que deja la compresión JPEG."""
    borde = ndimage.binary_dilation(fondo, iterations=3) & ~fondo
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    exceso = np.clip(np.minimum(r, b) - g, 0, None)
    for canal in (0, 2):
        rgb[..., canal] = np.where(borde, rgb[..., canal] - exceso * 0.85, rgb[..., canal])
    return rgb


def separar_piezas(solido):
    cols = solido.any(axis=0)
    grupos, inicio, vacias = [], None, 0
    for x, hay in enumerate(cols):
        if hay:
            if inicio is None:
                inicio = x
            vacias = 0
            fin = x
        elif inicio is not None:
            vacias += 1
            if vacias >= HUECO_MIN:
                grupos.append((inicio, fin + 1))
                inicio, vacias = None, 0
    if inicio is not None:
        grupos.append((inicio, fin + 1))
    # descartar manchas sueltas muy angostas
    grupos = [g for g in grupos if g[1] - g[0] > 30]
    return grupos


def recortar(rgba, x0, x1):
    pieza = rgba[:, x0:x1]
    filas = pieza[..., 3].any(axis=1)
    y0, y1 = np.argmax(filas), len(filas) - np.argmax(filas[::-1])
    return pieza[y0:y1]


def a_imagen(arr):
    im = Image.fromarray(arr.astype(np.uint8), 'RGBA')
    w, h = max(1, round(im.width * ESCALA)), max(1, round(im.height * ESCALA))
    return im.convert('RGBa').resize((w, h), Image.LANCZOS).convert('RGBA')


def perfil(alfa):
    """Ancho opaco por fila: (izq, der) o None."""
    out = []
    for fila in alfa > 128:
        xs = np.flatnonzero(fila)
        out.append((xs[0], xs[-1]) if len(xs) else None)
    return out


def anclas_torso(im):
    alfa = np.array(im)[..., 3]
    pf = perfil(alfa)
    anchos = np.array([(p[1] - p[0] + 1) if p else 0 for p in pf])
    maximo = anchos.max()
    cuerpo = np.flatnonzero(anchos >= maximo * 0.55)
    top, bottom = int(cuerpo[0]), int(cuerpo[-1])
    alto = bottom - top
    cx = float(np.mean([(pf[y][0] + pf[y][1]) / 2 for y in cuerpo]))

    def costado(frac):
        y = int(top + alto * frac)
        p = pf[y] or (cx - maximo / 2, cx + maximo / 2)
        return {'y': y, 'dx': round(float((p[1] - p[0]) / 2 * 0.78), 1)}

    return {
        'cx': round(cx, 1), 'arriba': top, 'abajo': bottom, 'ancho': int(maximo),
        'cuello': {'x': round(cx, 1), 'y': int(top + alto * 0.05)},
        'hombro': costado(0.24), 'cadera': costado(0.76)
    }


def ancla_superior(im):
    alfa = np.array(im)[..., 3]
    pf = perfil(alfa)
    filas = [p for p in pf[: max(3, len(pf) // 12)] if p]
    x = float(np.mean([(p[0] + p[1]) / 2 for p in filas]))
    return {'x': round(x, 1), 'y': 2}


def ancla_inferior(im):
    alfa = np.array(im)[..., 3]
    pf = perfil(alfa)
    filas = [p for p in pf[-max(3, len(pf) // 12):] if p]
    x = float(np.mean([(p[0] + p[1]) / 2 for p in filas]))
    return {'x': round(x, 1), 'y': im.height - 2}


def procesar_animal(nombre):
    ruta = os.path.join(FUENTES, nombre + '.jpg')
    rgb = np.array(Image.open(ruta).convert('RGB')).astype(np.float32)
    fondo = mascara_fondo(rgb)
    solido = ~fondo
    solido = ndimage.binary_opening(solido, iterations=1)
    etiquetas, n = ndimage.label(solido)
    tam = ndimage.sum(solido, etiquetas, range(1, n + 1))
    for i, t in enumerate(tam):
        if t < 150:
            solido[etiquetas == i + 1] = False
    fondo = ~solido
    rgb = quitar_derrame(rgb, fondo)
    alfa = np.where(solido, 255, 0).astype(np.float32)
    rgba = np.dstack([np.clip(rgb, 0, 255), alfa])

    grupos = separar_piezas(solido)
    if len(grupos) != 4:
        sys.exit(f'{nombre}: esperaba 4 piezas y encontré {len(grupos)} {grupos}')

    datos = {}
    for pieza, (x0, x1) in zip(PIEZAS, grupos):
        im = a_imagen(recortar(rgba, x0, x1))
        archivo = f'{nombre}-{pieza}.png'
        im.save(os.path.join(SALIDA_B, archivo), optimize=True)
        d = {'src': 'assets/bestias/' + archivo, 'w': im.width, 'h': im.height}
        if pieza == 'torso':
            d['cuerpo'] = anclas_torso(im)
        elif pieza == 'cabeza':
            d['ancla'] = ancla_inferior(im)
        else:
            d['ancla'] = ancla_superior(im)
        datos[pieza] = d
    return datos


def procesar_mapas():
    mapas = {}
    for f in sorted(os.listdir(FUENTES)):
        if not f.startswith('mapa-'):
            continue
        nombre = f[5:].rsplit('.', 1)[0]
        im = Image.open(os.path.join(FUENTES, f)).convert('RGB').resize((960, 1280), Image.LANCZOS)
        im.save(os.path.join(SALIDA_M, nombre + '.jpg'), quality=84, optimize=True, progressive=True)
        mapas[nombre] = {'src': f'assets/mapas/{nombre}.jpg', 'w': 960, 'h': 1280}
    return mapas


def main():
    os.makedirs(SALIDA_B, exist_ok=True)
    os.makedirs(SALIDA_M, exist_ok=True)
    datos = {'animales': {}, 'mapas': procesar_mapas()}
    for a in ANIMALES:
        if os.path.exists(os.path.join(FUENTES, a + '.jpg')):
            datos['animales'][a] = procesar_animal(a)
            print('ok', a)
    js = ('/* Generado por tools/procesar_arte.py — no editar a mano. */\n'
          '(function (BM) {\n  BM.SPRITES = ' + json.dumps(datos, indent=2, ensure_ascii=False).replace('\n', '\n  ') +
          ';\n})(typeof window !== \'undefined\' ? (window.BM = window.BM || {}) : (globalThis.BM = globalThis.BM || {}));\n')
    with open(os.path.join(RAIZ, 'src', 'data', 'sprites.js'), 'w', encoding='utf-8') as fh:
        fh.write(js)
    print('mapas:', ', '.join(datos['mapas']))


if __name__ == '__main__':
    main()
