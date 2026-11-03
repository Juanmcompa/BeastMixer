/*
 * BeastMixer — Simulación de combate DETERMINISTA.
 *
 * Por qué no usamos un motor de física: para jugar PvP asíncrono por link,
 * los dos jugadores tienen que ver EXACTAMENTE el mismo combate a partir de
 * los mismos dos ejércitos. Por eso:
 *   - paso fijo (1/30 s), nunca el delta real del navegador;
 *   - sólo + - * / y Math.sqrt (resultados idénticos en todos los motores JS);
 *   - todo lo aleatorio sale de un RNG con semilla;
 *   - las unidades se procesan siempre en el mismo orden (por id).
 * El render sólo LEE este estado; nunca lo modifica.
 *
 * Cada criatura es una pequeña máquina de estados (FSM, como CriaturaFSM.gd):
 *   buscar → mover → atacar → (muerto)
 */
(function (BM) {
  'use strict';

  var R = BM.REGLAS;
  var ANCHO = R.columnas * R.celda;
  var ALTO = (R.filasZona * 2 + R.filasNeutras) * R.celda;
  var ALCANCE_MELEE = 40;
  var RADIO_MANADA2 = 90 * 90;
  var RADIO_AREA2 = 50 * 50;
  var VENENO_DPS = 4, VENENO_DURACION = 4, VENENO_MAX = 4;

  // Convierte (columna, profundidad) de un ejército a coordenadas del campo.
  // profundidad 0 = primera línea (pegada a la zona neutral), filasZona-1 = retaguardia.
  // El bando 0 juega abajo, el bando 1 arriba (rotado 180°).
  function posicionCelda(bando, col, prof) {
    var c = R.celda;
    if (bando === 0) {
      return { x: (col + 0.5) * c, y: (R.filasZona + R.filasNeutras + prof + 0.5) * c };
    }
    return { x: (R.columnas - 1 - col + 0.5) * c, y: (R.filasZona - 1 - prof + 0.5) * c };
  }

  function crearCombate(ejA, ejB, semilla) {
    var rng = BM.crearRng(semilla);
    var unidades = [];
    var ejercitos = [ejA || [], ejB || []];
    // ids intercalados (A0, B0, A1, B1, ...) para que ningún bando actúe siempre primero
    var maxLen = Math.max(ejercitos[0].length, ejercitos[1].length);
    for (var i = 0; i < maxLen; i++) {
      for (var b = 0; b < 2; b++) {
        var u = ejercitos[b][i];
        if (!u) continue;
        var s = BM.ensamblar(u.cab, u.tor, u.pat);
        var p = posicionCelda(b, u.col, u.prof);
        unidades.push({
          id: unidades.length, bando: b, s: s,
          x: p.x, y: p.y, x0: p.x, y0: p.y,
          vida: s.vida, viva: true,
          estado: 'buscar', objetivo: null, reobjetivo: 0,
          espera: s.cadencia * (0.3 + 0.4 * rng()),
          cargaLista: BM.tieneHabilidad(s, 'carga'),
          salto: BM.tieneHabilidad(s, 'salto') ? 0.8 : 0,
          veneno: [], dirX: 0, dirY: b === 0 ? -1 : 1, moviendo: false,
          golpeado: 0, atacando: 0
        });
      }
    }
    return {
      unidades: unidades, rng: rng, t: 0, terminado: false,
      ganador: null, eventos: [], semilla: semilla,
      ancho: ANCHO, alto: ALTO
    };
  }

  function dist2(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }

  function buscarObjetivo(c, u) {
    var mejor = null, mejorD = Infinity;
    for (var i = 0; i < c.unidades.length; i++) {
      var o = c.unidades[i];
      if (!o.viva || o.bando === u.bando) continue;
      var d = dist2(u, o);
      if (d < mejorD) { mejorD = d; mejor = o; }
    }
    return mejor;
  }

  function aplicarDano(c, obj, crudo, atacante, tipo) {
    if (!obj.viva) return 0;
    var neto = crudo - obj.s.armadura;
    if (neto < 1) neto = 1;
    obj.vida -= neto;
    obj.golpeado = 0.15;
    c.eventos.push({ t: 'golpe', de: atacante ? atacante.id : -1, a: obj.id, dano: neto, tipo: tipo, x: obj.x, y: obj.y });
    return neto;
  }

  function envenenar(obj) {
    if (obj.veneno.length >= VENENO_MAX) obj.veneno.shift();
    obj.veneno.push(VENENO_DURACION);
  }

  function golpear(c, u, obj) {
    var s = u.s;
    var crudo = s.dano;
    var tipo = s.distancia ? (s.cab === 'arana' ? 'escupitajo' : 'lengua') : 'mordida';
    if (BM.tieneHabilidad(s, 'manada')) {
      var n = 0;
      for (var i = 0; i < c.unidades.length; i++) {
        var a = c.unidades[i];
        if (a !== u && a.viva && a.bando === u.bando && a.s.cab === 'lobo' && dist2(a, u) <= RADIO_MANADA2) n++;
      }
      if (n > 3) n = 3;
      crudo *= 1 + 0.15 * n;
    }
    if (u.cargaLista) { crudo *= 3; u.cargaLista = false; tipo = 'carga'; }

    var neto = aplicarDano(c, obj, crudo, u, tipo);

    if (BM.tieneHabilidad(obj.s, 'espinas') && !s.distancia) {
      aplicarDano(c, u, neto * 0.5 + u.s.armadura, obj, 'espinas'); // espinas ignoran armadura
    }
    if (BM.tieneHabilidad(s, 'veneno') || BM.tieneHabilidad(s, 'aguijon')) envenenar(obj);
    if (BM.tieneHabilidad(s, 'trompazo')) {
      c.eventos.push({ t: 'area', x: obj.x, y: obj.y, de: u.id });
      for (var j = 0; j < c.unidades.length; j++) {
        var e = c.unidades[j];
        if (e !== obj && e.viva && e.bando !== u.bando && dist2(e, obj) <= RADIO_AREA2) {
          aplicarDano(c, e, crudo * 0.5, u, 'area');
        }
      }
    }
    u.atacando = 0.18;
  }

  function separar(c) {
    var us = c.unidades;
    for (var it = 0; it < 2; it++) {
      for (var i = 0; i < us.length; i++) {
        var a = us[i];
        if (!a.viva) continue;
        for (var j = i + 1; j < us.length; j++) {
          var b = us[j];
          if (!b.viva) continue;
          var dx = b.x - a.x, dy = b.y - a.y;
          var min = a.s.radio + b.s.radio;
          var d2 = dx * dx + dy * dy;
          if (d2 >= min * min) continue;
          var d = Math.sqrt(d2);
          if (d === 0) { dx = (a.id < b.id) ? 1 : -1; dy = 0; d = 1; }
          var solape = min - d;
          var wa = b.s.radio / min, wb = a.s.radio / min; // el más grande se mueve menos
          var nx = dx / d, ny = dy / d;
          a.x -= nx * solape * wa; a.y -= ny * solape * wa;
          b.x += nx * solape * wb; b.y += ny * solape * wb;
        }
      }
    }
    for (var k = 0; k < us.length; k++) {
      var u = us[k];
      if (u.x < u.s.radio) u.x = u.s.radio;
      if (u.x > ANCHO - u.s.radio) u.x = ANCHO - u.s.radio;
      if (u.y < u.s.radio) u.y = u.s.radio;
      if (u.y > ALTO - u.s.radio) u.y = ALTO - u.s.radio;
    }
  }

  function paso(c) {
    if (c.terminado) return c;
    var dt = R.pasoSimulacion;
    c.eventos = [];
    var us = c.unidades, i, u;

    for (i = 0; i < us.length; i++) {
      u = us[i];
      if (!u.viva) continue;
      if (u.golpeado > 0) u.golpeado -= dt;
      if (u.atacando > 0) u.atacando -= dt;
      u.moviendo = false;

      // Estados alterados
      if (u.veneno.length) {
        u.vida -= VENENO_DPS * u.veneno.length * dt;
        for (var v = u.veneno.length - 1; v >= 0; v--) {
          u.veneno[v] -= dt;
          if (u.veneno[v] <= 0) u.veneno.splice(v, 1);
        }
      }
      if (BM.tieneHabilidad(u.s, 'regenera') && u.vida < u.s.vida) {
        u.vida += 3 * dt;
        if (u.vida > u.s.vida) u.vida = u.s.vida;
      }

      // FSM
      u.reobjetivo -= dt;
      if (!u.objetivo || !u.objetivo.viva || u.reobjetivo <= 0) {
        u.objetivo = buscarObjetivo(c, u);
        u.reobjetivo = 0.5;
        u.estado = u.objetivo ? 'mover' : 'buscar';
      }
      var o = u.objetivo;
      if (!o) continue;

      var dx = o.x - u.x, dy = o.y - u.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      var borde = d - u.s.radio - o.s.radio;
      if (d > 0) { u.dirX = dx / d; u.dirY = dy / d; }

      if (borde <= u.s.alcance + 2) {
        u.estado = 'atacar';
        // Hostigar (kiting): una bestia a distancia retrocede si un cuerpo a cuerpo
        // más lento se le viene encima, sin dejar de atacar.
        if (u.s.distancia && !o.s.distancia && borde < u.s.alcance * 0.5 && u.s.velocidad > o.s.velocidad && d > 0) {
          var atras = u.s.velocidad * 0.6 * dt;
          u.x -= dx / d * atras;
          u.y -= dy / d * atras;
          u.moviendo = true;
        }
        u.espera -= dt;
        if (u.espera <= 0) {
          golpear(c, u, o);
          u.espera = u.s.cadencia;
        }
      } else {
        u.estado = 'mover';
        var vel = u.s.velocidad;
        if (u.salto > 0) { vel *= 3; u.salto -= dt; }
        var avance = vel * dt;
        if (avance > borde - u.s.alcance) avance = borde - u.s.alcance;
        if (avance > 0 && d > 0) {
          u.x += dx / d * avance;
          u.y += dy / d * avance;
          u.moviendo = true;
        }
        // mientras camina, la carga se prepara; el ataque se "arma" al llegar
        if (u.espera < u.s.cadencia * 0.35) u.espera = u.s.cadencia * 0.35;
      }
    }

    // Muertes (después de que todos actuaron en este paso)
    for (i = 0; i < us.length; i++) {
      u = us[i];
      if (u.viva && u.vida <= 0) {
        u.viva = false; u.vida = 0; u.estado = 'muerto';
        c.eventos.push({ t: 'muere', id: u.id, x: u.x, y: u.y });
      }
    }

    separar(c);
    c.t += dt;

    var vivos = [0, 0];
    for (i = 0; i < us.length; i++) if (us[i].viva) vivos[us[i].bando]++;
    if (vivos[0] === 0 || vivos[1] === 0) {
      c.terminado = true;
      c.ganador = vivos[0] === 0 && vivos[1] === 0 ? -1 : (vivos[0] === 0 ? 1 : 0);
    } else if (c.t >= R.duracionMaxCombate) {
      c.terminado = true;
      c.ganador = -1;
    }
    return c;
  }

  // Daño que recibe cada jugador al terminar la ronda (estilo Mechabellum).
  function calcularDanoJugadores(c) {
    var porSobrevivientes = [0, 0];
    for (var i = 0; i < c.unidades.length; i++) {
      var u = c.unidades[i];
      if (u.viva) porSobrevivientes[u.bando] += Math.ceil(u.s.costo / R.danoPorCosto);
    }
    var dano = [0, 0];
    if (c.ganador === 0) dano[1] = R.danoBaseDerrota + porSobrevivientes[0];
    else if (c.ganador === 1) dano[0] = R.danoBaseDerrota + porSobrevivientes[1];
    else { dano[0] = porSobrevivientes[1]; dano[1] = porSobrevivientes[0]; }
    return dano;
  }

  function resolver(ejA, ejB, semilla) {
    var c = crearCombate(ejA, ejB, semilla);
    var pasos = 0;
    while (!c.terminado) { paso(c); pasos++; }
    return {
      ganador: c.ganador,
      tiempo: c.t,
      pasos: pasos,
      dano: calcularDanoJugadores(c),
      vivos: c.unidades.filter(function (u) { return u.viva; }).map(function (u) { return { id: u.id, bando: u.bando, vida: u.vida }; }),
      huella: huella(c)
    };
  }

  // Huella del estado final: sirve para verificar que dos navegadores vieron lo mismo.
  function huella(c) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < c.unidades.length; i++) {
      var u = c.unidades[i];
      var vals = [u.x, u.y, u.vida, u.viva ? 1 : 0];
      for (var k = 0; k < vals.length; k++) {
        var str = vals[k].toFixed(4);
        for (var j = 0; j < str.length; j++) { h ^= str.charCodeAt(j); h = Math.imul(h, 16777619) >>> 0; }
      }
    }
    return h.toString(16);
  }

  BM.CAMPO = { ancho: ANCHO, alto: ALTO };
  BM.posicionCelda = posicionCelda;
  BM.crearCombate = crearCombate;
  BM.pasoCombate = paso;
  BM.resolverCombate = resolver;
  BM.calcularDanoJugadores = calcularDanoJugadores;
})(typeof window !== 'undefined' ? (window.BM = window.BM || {}) : (globalThis.BM = globalThis.BM || {}));
