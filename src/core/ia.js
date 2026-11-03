/*
 * BeastMixer — IA rival (modo "Contra la IA").
 *
 * Igual que en Mechabellum, la IA conserva su ejército de la ronda anterior y
 * agrega bestias nuevas con el presupuesto extra. Mira lo que desplegaste vos
 * la ronda pasada y sube la probabilidad de las recetas que lo contrarrestan.
 */
(function (BM) {
  'use strict';

  var R = BM.REGLAS;

  // Recetas: híbridos que la IA sabe armar, con el rol que cumplen.
  var RECETAS = [
    { id: 'muralla',     cab: 'rino',      tor: 'tortuga',     pat: 'lobo',      rol: 'tanque' },
    { id: 'erizo',       cab: 'escorpion', tor: 'puercoespin', pat: 'rino',      rol: 'tanque' },
    { id: 'jauria',      cab: 'lobo',      tor: 'lobo',        pat: 'lobo',      rol: 'rapido' },
    { id: 'lobo-coraza', cab: 'lobo',      tor: 'escorpion',   pat: 'lobo',      rol: 'rapido' },
    { id: 'escupidora',  cab: 'arana',     tor: 'rana',        pat: 'arana',     rol: 'distancia' },
    { id: 'torreta',     cab: 'arana',     tor: 'escorpion',   pat: 'arana',     rol: 'distancia' },
    { id: 'lenguaraz',   cab: 'rana',      tor: 'lobo',        pat: 'rana',      rol: 'distancia' },
    { id: 'aplanadora',  cab: 'elefante',  tor: 'elefante',    pat: 'rino',      rol: 'area' },
    { id: 'embestida',   cab: 'rino',      tor: 'rino',        pat: 'lobo',      rol: 'carga' }
  ];

  function analizar(ej) {
    var n = ej.length;
    if (!n) return { n: 0, armadura: 0, distancia: 0, livianas: 0, melee: 0 };
    var arm = 0, dist = 0, liv = 0;
    for (var i = 0; i < n; i++) {
      var s = BM.ensamblar(ej[i].cab, ej[i].tor, ej[i].pat);
      arm += s.armadura;
      if (s.distancia) dist++;
      if (s.vida <= 110) liv++;
    }
    return { n: n, armadura: arm / n, distancia: dist / n, livianas: liv / n, melee: 1 - dist / n };
  }

  function pesos(info, ronda) {
    var p = {};
    for (var i = 0; i < RECETAS.length; i++) p[RECETAS[i].id] = 1;
    if (info.armadura >= 3) { p.escupidora += 2; p.torreta += 2; p.aplanadora += 1.5; p.embestida += 1.5; p.jauria = 0.3; }
    if (info.distancia >= 0.4) { p.jauria += 2.5; p['lobo-coraza'] += 2; p.lenguaraz += 1; }
    if (info.livianas >= 0.5 && info.n >= 5) { p.aplanadora += 2; p.erizo += 1.5; }
    if (info.melee >= 0.7 && info.n >= 3) { p.erizo += 2; p.muralla += 1; p.torreta += 1; }
    if (ronda <= 1) { p.aplanadora = 0.3; }
    return p;
  }

  function elegirReceta(rng, p, disponible) {
    var total = 0, candidatas = [];
    for (var i = 0; i < RECETAS.length; i++) {
      var r = RECETAS[i];
      var costo = BM.ensamblar(r.cab, r.tor, r.pat).costo;
      if (costo <= disponible && p[r.id] > 0) { candidatas.push(r); total += p[r.id]; }
    }
    if (!candidatas.length) return null;
    var x = rng() * total;
    for (var j = 0; j < candidatas.length; j++) {
      x -= p[candidatas[j].id];
      if (x <= 0) return candidatas[j];
    }
    return candidatas[candidatas.length - 1];
  }

  // Filas preferidas según rol (0 = frente).
  var FILAS = {
    tanque: [0, 1, 2], carga: [0, 1, 2], rapido: [1, 0, 2, 3],
    area: [1, 2, 0, 3], distancia: [4, 3, 5, 2]
  };

  function ubicar(rng, ej, rol) {
    var filas = (FILAS[rol] || [2, 3]).filter(function (f) { return f < R.filasZona; });
    for (var f = 0; f < filas.length; f++) {
      var libres = [];
      for (var col = 1; col < R.columnas - 1; col++) {
        if (!BM.celdaOcupada(ej, col, filas[f])) libres.push(col);
      }
      if (libres.length) {
        // preferir el centro del campo
        libres.sort(function (a, b) { return Math.abs(a - 5.5) - Math.abs(b - 5.5); });
        var top = libres.slice(0, Math.max(3, Math.ceil(libres.length / 2)));
        return { col: rng.elegir(top), prof: filas[f] };
      }
    }
    for (var p = 0; p < R.filasZona; p++) {
      for (var c = 0; c < R.columnas; c++) if (!BM.celdaOcupada(ej, c, p)) return { col: c, prof: p };
    }
    return null;
  }

  function generarEjercitoIA(ejPrevio, ejJugadorVisto, ronda, semilla) {
    var rng = BM.crearRng(semilla);
    var ej = (ejPrevio || []).map(function (u) { return { cab: u.cab, tor: u.tor, pat: u.pat, col: u.col, prof: u.prof }; });
    var disponible = BM.presupuesto(ronda) - BM.costoEjercito(ej);
    var p = pesos(analizar(ejJugadorVisto || []), ronda);
    for (var guard = 0; guard < 40; guard++) {
      var r = elegirReceta(rng, p, disponible);
      if (!r) break;
      var lugar = ubicar(rng, ej, r.rol);
      if (!lugar) break;
      ej.push({ cab: r.cab, tor: r.tor, pat: r.pat, col: lugar.col, prof: lugar.prof });
      disponible -= BM.ensamblar(r.cab, r.tor, r.pat).costo;
    }
    return ej;
  }

  BM.RECETAS_IA = RECETAS;
  BM.generarEjercitoIA = generarEjercitoIA;
})(typeof window !== 'undefined' ? (window.BM = window.BM || {}) : (globalThis.BM = globalThis.BM || {}));
