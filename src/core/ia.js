/*
 * BeastMixer — IA rival (modo "Contra la IA").
 *
 * Igual que en Mechabellum, la IA conserva su ejército de la ronda anterior y
 * agrega bestias nuevas con el presupuesto extra. Mira lo que desplegaste vos
 * la ronda pasada y sube la probabilidad de las recetas que lo contrarrestan.
 *
 * DIFICULTADES (BM.DIFICULTADES, BM.pensarIA):
 *   aprendiz  recetas fijas con pesos (generarEjercitoIA).
 *   rival     prueba ~36 armados contra tu último ejército, simulando el combate.
 *   experto   ~100 armados, anticipa tu respuesta y prueba variantes de ubicación.
 *   pesadilla algoritmo genético: una población que evoluciona ronda a ronda.
 * La IA "piensa" simulando con el mismo motor determinista del juego, así que sólo
 * mira lo que la regla le permite ver: su propio ejército previo y el TUYO DE LA
 * RONDA ANTERIOR (ejVisto). Nunca lee tu ejército actual.
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

  // Agrega recetas (con pesos `p`) al ejército `ej` hasta gastar `disponible`.
  function completarConRecetas(rng, ej, p, disponible) {
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

  function copiarEj(ej) {
    return (ej || []).map(function (u) { return { cab: u.cab, tor: u.tor, pat: u.pat, col: u.col, prof: u.prof }; });
  }

  function generarEjercitoIA(ejPrevio, ejJugadorVisto, ronda, semilla) {
    var rng = BM.crearRng(semilla);
    var ej = copiarEj(ejPrevio);
    var disponible = BM.presupuesto(ronda) - BM.costoEjercito(ej);
    var p = pesos(analizar(ejJugadorVisto || []), ronda);
    return completarConRecetas(rng, ej, p, disponible);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  IA que piensa simulando
  // ══════════════════════════════════════════════════════════════════════

  var DIFICULTADES = [
    { id: 'aprendiz',  nombre: 'Aprendiz',  texto: 'Arma recetas fijas.' },
    { id: 'rival',     nombre: 'Rival',     texto: 'Prueba combinaciones contra tu último ejército.' },
    { id: 'experto',   nombre: 'Experto',   texto: 'Anticipa tu respuesta y cuida la ubicación.' },
    { id: 'pesadilla', nombre: 'Pesadilla', texto: 'Evoluciona su ejército ronda a ronda.' }
  ];

  // Presupuestos por dificultad. `ms` es un tope de seguridad de tiempo de cómputo (no cuenta
  // lo que el navegador tarda entre rebanadas); las cantidades son las que fija el diseño y,
  // si el tope no se alcanza, el resultado es reproducible. `op.tiempoMax` (ms; Infinity = sin
  // tope) lo reemplaza.
  var CONFIG = {
    rival:     { ms: 600,  maxCand: 60,  semillas: 2 },
    experto:   { ms: 1500, maxCand: 160, top: 8, semillas: 2 },
    pesadilla: { ms: 2500, pob: 14, semillas: 2 }
  };

  var RANURA_MS = 12;          // cuánto trabajar antes de ceder el hilo
  var HORIZONTE_RAPIDO = 45;   // segundos simulados al puntuar candidatos (el real dura hasta 75)

  var reloj = (typeof performance !== 'undefined' && performance.now)
    ? function () { return performance.now(); }
    : function () { return Date.now(); };

  function ceder() { return new Promise(function (res) { setTimeout(res, 0); }); }

  // ── Tabla de los 512 diseños ───────────────────────────────────────────
  var TABLA = null;

  function rolDe(s) {
    if (s.distancia) return 'distancia';
    if (s.cab === 'elefante') return 'area';
    if (s.vida >= 230 || s.armadura >= 4) return 'tanque';
    if (s.cab === 'rino') return 'carga';
    if (s.velocidad >= 85) return 'rapido';
    return 'melee';
  }

  function tabla() {
    if (TABLA) return TABLA;
    var lista = [], porClave = {};
    for (var a = 0; a < BM.ANIMALES.length; a++) {
      for (var b = 0; b < BM.ANIMALES.length; b++) {
        for (var c = 0; c < BM.ANIMALES.length; c++) {
          var s = BM.ensamblar(BM.ANIMALES[a].id, BM.ANIMALES[b].id, BM.ANIMALES[c].id);
          var d = { i: lista.length, cab: s.cab, tor: s.tor, pat: s.pat, clave: s.cab + '-' + s.tor + '-' + s.pat,
            costo: s.costo, s: s, rol: rolDe(s) };
          lista.push(d);
          porClave[d.clave] = d;
        }
      }
    }
    var minCosto = Infinity;
    for (var i = 0; i < lista.length; i++) if (lista[i].costo < minCosto) minCosto = lista[i].costo;
    TABLA = { lista: lista, porClave: porClave, minCosto: minCosto };
    return TABLA;
  }

  function disenoDe(u) { return tabla().porClave[u.cab + '-' + u.tor + '-' + u.pat]; }

  // Eficacia estimada (sin simular) de `a` contra `d` uno a uno, ajustada por costo. > 1 = a rinde más.
  function eficaciaPar(a, d) {
    function dps(x, y) {
      var v = Math.max(1, x.dano - y.armadura) / x.cadencia;
      if (x.cab === 'lobo') v *= 1.25;
      else if (x.cab === 'elefante') v *= 1.4;
      else if (x.cab === 'rino') v *= 1.1;
      else if (x.cab === 'arana' || x.cab === 'escorpion') v += 10;
      return v;
    }
    var ad = dps(a, d), da = dps(d, a);
    if (!a.distancia && d.tor === 'puercoespin') da += 0.5 * ad;
    if (!d.distancia && a.tor === 'puercoespin') ad += 0.5 * da;
    var r = (a.vida * ad) / (d.vida * da);
    if (a.distancia && !d.distancia) r *= 1.4;
    else if (d.distancia && !a.distancia) r /= (a.velocidad >= d.velocidad * 1.3 ? 1.1 : 1.5);
    return r * d.costo / a.costo;
  }

  // Pesos (0..1) de cada diseño contra un ejército enemigo: la "intuición" que guía el muestreo.
  function pesosContra(ej, niv) {
    var T = tabla(), enemigos = [], porClave = {}, i, k;
    for (i = 0; i < ej.length; i++) {
      k = BM.claveDiseno(ej[i]);
      if (!porClave[k]) { porClave[k] = { n: 0, s: BM.ensamblar(ej[i].cab, ej[i].tor, ej[i].pat, BM.nivelDiseno(niv || {}, k)) }; enemigos.push(porClave[k]); }
      porClave[k].n++;
    }
    var w = new Array(T.lista.length), max = 0, tot = 0;
    for (i = 0; i < enemigos.length; i++) tot += enemigos[i].n * enemigos[i].s.costo;
    for (i = 0; i < T.lista.length; i++) {
      var d = T.lista[i], lg = 0;
      if (!enemigos.length) {
        // sin referencias: calidad genérica (vida × daño por segundo por costo²)
        lg = Math.log(Math.sqrt(d.s.vida * (1 + d.s.armadura / 6) * d.s.dps) / d.costo);
      } else {
        for (var e = 0; e < enemigos.length; e++) {
          lg += Math.log(Math.max(0.05, eficaciaPar(d.s, enemigos[e].s))) * (enemigos[e].n * enemigos[e].s.costo / tot);
        }
      }
      w[i] = Math.exp(2 * lg);
      if (w[i] > max) max = w[i];
    }
    for (i = 0; i < w.length; i++) w[i] /= max;
    return w;
  }

  // ── Contexto de una llamada (reloj cooperativo, RNG, contadores) ───────
  function crearCtx(op, cfg) {
    var tope = op.tiempoMax !== undefined ? op.tiempoMax : cfg.ms;
    var ejPrevio = copiarEj(op.ejPrevio);
    return {
      op: op, cfg: cfg, tope: tope,
      rng: BM.crearRng(((op.semilla >>> 0) ^ 0x5bd1e995) + (op.ronda | 0) * 1013),
      ronda: op.ronda || 1, libreAnt: op.libreAnterior || 0,
      ejPrevio: ejPrevio, nivPrevio: op.nivPrevio || {},
      prevCnt: BM.contarDisenos(ejPrevio),
      gastado: 0, inicio: reloj(), t0: reloj(), evals: 0, progreso: 0, w: null, S: 0
    };
  }

  // Simulaciones que caben en el tope, estimadas por el tamaño de los ejércitos (determinista).
  function presupuestoSims(ctx) {
    var n = ctx.ejPrevio.length + 8 + (ctx.op.ejVisto || []).length;
    var tope = isFinite(ctx.tope) ? ctx.tope : ctx.cfg.ms;
    ctx.S = Math.max(30, Math.floor(0.9 * tope / (1.5 + 0.15 * n)));
    return ctx.S;
  }

  function usado(ctx) { return ctx.gastado + (reloj() - ctx.t0); }
  function agotado(ctx, tope) { return usado(ctx) >= (tope === undefined ? ctx.tope : tope); }

  // Cede el hilo si ya trabajamos una ranura entera.
  async function pulso(ctx) {
    var t = reloj();
    if (t - ctx.t0 >= RANURA_MS) {
      ctx.gastado += t - ctx.t0;
      if (ctx.op.alProgreso) { try { ctx.op.alProgreso(Math.min(0.99, ctx.progreso)); } catch (e) { /* la UI no debe romper la IA */ } }
      await ceder();
      ctx.t0 = reloj();
    }
  }

  // ── Puntuación por simulación ──────────────────────────────────────────
  // La IA juega siempre de bando 1 (como en el modo contra la IA). Devuelve el balance de vida
  // (daño al rival − daño propio) más un desempate suave por la fuerza que queda en pie.
  function puntaje(ctx, ej, niv, rival, semilla, horizonte) {
    var c = BM.crearCombate(rival.ej, ej, semilla, rival.niv, niv);
    while (!c.terminado && c.t < horizonte) BM.pasoCombate(c);
    var f = [0, 0], i, u;
    for (i = 0; i < c.unidades.length; i++) {
      u = c.unidades[i];
      if (u.viva) f[u.bando] += u.s.valor * u.vida / u.s.vida;
    }
    if (!c.terminado) {
      // cortado por el horizonte: gana (provisoriamente) quien conserva más fuerza
      var tot = f[0] + f[1];
      if (tot > 0 && Math.abs(f[0] - f[1]) > 0.08 * tot) c.ganador = f[1] > f[0] ? 1 : 0;
    }
    var dano = BM.calcularDanoJugadores(c);
    ctx.evals++;
    return (dano[0] - dano[1]) + 0.025 * (f[1] - f[0]);
  }

  function espejado(r) {
    if (!r.esp) {
      r.esp = { ej: r.ej.map(function (u) { return { cab: u.cab, tor: u.tor, pat: u.pat, col: R.columnas - 1 - u.col, prof: u.prof }; }), niv: r.niv };
    }
    return r.esp;
  }

  // Puntaje medio contra un conjunto de rivales [{ej, niv, peso}] con `n` semillas.
  // Devuelve { media, min } (ponderado por peso).
  function evaluar(ctx, ej, niv, rivales, n, horizonte) {
    var tp = 0, suma = 0, min = Infinity;
    for (var r = 0; r < rivales.length; r++) {
      var s = 0;
      for (var k = 0; k < n; k++) {
        // la 2ª muestra enfrenta al rival ESPEJADO: así no nos ajustamos a su ubicación exacta
        s += puntaje(ctx, ej, niv, k === 0 ? rivales[r] : espejado(rivales[r]), (ctx.op.semilla >>> 0) + 7919 * (k + 1) + 31 * r, horizonte);
      }
      s /= n;
      suma += s * rivales[r].peso; tp += rivales[r].peso;
      if (s < min) min = s;
    }
    return { media: suma / tp, min: min };
  }

  function valorFinal(res, ponderMin) { return (1 - ponderMin) * res.media + ponderMin * res.min; }

  // ── Estado de armado (un ejército + niveles + libro de biomasa) ────────
  function nuevoEstado(ctx) {
    var E = { u: copiarEj(ctx.ejPrevio), niv: {}, libre: ctx.libreAnt + BM.ingresoRonda(ctx.ronda), occ: {}, cnt: BM.contarDisenos(ctx.ejPrevio), tag: '' };
    for (var k in ctx.nivPrevio) E.niv[k] = ctx.nivPrevio[k];
    for (var i = 0; i < E.u.length; i++) E.occ[E.u[i].col * 8 + E.u[i].prof] = true;
    return E;
  }

  function clonarEstado(E) {
    var n = { u: copiarEj(E.u), niv: {}, libre: E.libre, occ: {}, cnt: {}, tag: E.tag };
    var k;
    for (k in E.niv) n.niv[k] = E.niv[k];
    for (k in E.cnt) n.cnt[k] = E.cnt[k];
    for (var i = 0; i < n.u.length; i++) n.occ[n.u[i].col * 8 + n.u[i].prof] = true;
    return n;
  }

  // Reconstruye un estado coherente a partir de una lista de unidades y niveles (libro de cuentas real).
  function estadoDesde(ctx, unidades, niv) {
    var E = { u: [], niv: {}, libre: 0, occ: {}, cnt: {}, tag: '' }, k, i;
    for (k in ctx.nivPrevio) E.niv[k] = ctx.nivPrevio[k];
    for (k in niv) if (BM.nivelDiseno(niv, k) > BM.nivelDiseno(E.niv, k)) E.niv[k] = BM.nivelDiseno(niv, k);
    for (i = 0; i < unidades.length; i++) {
      var u = unidades[i];
      if (E.occ[u.col * 8 + u.prof] || u.col < 0 || u.col >= R.columnas || u.prof < 0 || u.prof >= R.filasZona) continue;
      E.occ[u.col * 8 + u.prof] = true;
      E.u.push({ cab: u.cab, tor: u.tor, pat: u.pat, col: u.col, prof: u.prof });
    }
    E.cnt = BM.contarDisenos(E.u);
    E.libre = recalcLibre(ctx, E);
    return E;
  }

  function recalcLibre(ctx, E) {
    return BM.biomasaLibre(ctx.libreAnt, ctx.ronda, ctx.ejPrevio, ctx.nivPrevio, E.u, E.niv);
  }

  // Filas preferidas según rol (0 = frente).
  var FILAS_ROL = {
    tanque: [0, 1, 2], carga: [0, 1, 2], melee: [1, 0, 2, 3], rapido: [1, 2, 0, 3],
    area: [1, 2, 0, 3], distancia: [4, 3, 5, 2]
  };
  var ORDEN_COL = [5, 6, 4, 7, 3, 8, 2, 9, 1, 10, 0, 11];
  var PRIORIDAD_ROL = { tanque: 0, carga: 1, melee: 2, rapido: 3, area: 4, distancia: 5 };

  function celdaLibreRol(E, rol, rng) {
    var filas = FILAS_ROL[rol] || [2, 3];
    for (var f = 0; f < filas.length; f++) {
      var libres = [];
      for (var i = 0; i < ORDEN_COL.length; i++) if (!E.occ[ORDEN_COL[i] * 8 + filas[f]]) libres.push(ORDEN_COL[i]);
      if (libres.length) return { col: libres[Math.floor(rng() * Math.min(libres.length, 4))], prof: filas[f] };
    }
    for (var p = 0; p < R.filasZona; p++) {
      for (var c = 0; c < R.columnas; c++) if (!E.occ[c * 8 + p]) return { col: c, prof: p };
    }
    return null;
  }

  function comprar(E, d, rng) {
    if (d.costo > E.libre) return false;
    var lugar = celdaLibreRol(E, d.rol, rng);
    if (!lugar) return false;
    E.u.push({ cab: d.cab, tor: d.tor, pat: d.pat, col: lugar.col, prof: lugar.prof });
    E.occ[lugar.col * 8 + lugar.prof] = true;
    E.cnt[d.clave] = (E.cnt[d.clave] || 0) + 1;
    E.libre -= d.costo;
    return true;
  }

  // Recicla la unidad i: reembolso completo si es compra de esta ronda, 50% si es veterana.
  function reciclar(ctx, E, i) {
    var u = E.u[i], d = disenoDe(u);
    var compra = (E.cnt[d.clave] || 0) > (ctx.prevCnt[d.clave] || 0);
    E.libre += compra ? d.costo : Math.floor(d.costo * R.reembolsoVeterana);
    E.cnt[d.clave]--;
    delete E.occ[u.col * 8 + u.prof];
    E.u[i] = E.u[E.u.length - 1];
    E.u.pop();
  }

  function subirNivel(E, clave) {
    var d = tabla().porClave[clave];
    var n = BM.nivelDiseno(E.niv, clave);
    var costo = BM.costoSubirNivel(d.cab, d.tor, d.pat, n);
    if (costo === null || costo > E.libre) return false;
    E.niv[clave] = n + 1;
    E.libre -= costo;
    return true;
  }

  // ── Ubicación del ejército completo (mover es gratis) ──────────────────
  function columnasFila(k, modo) {
    var cols = [], i;
    if (modo === 'ancho') {
      for (i = 0; i < k; i++) cols.push(Math.floor((i + 0.5) * R.columnas / k));
    } else if (modo === 'flancos') {
      var orden = [0, 11, 1, 10, 2, 9, 3, 8, 4, 7, 5, 6];
      cols = orden.slice(0, k);
    } else {
      cols = ORDEN_COL.slice(0, k);
    }
    return cols;
  }

  // estilo = { cols: 'centro'|'ancho'|'flancos', cap: máx. por fila, espejo: bool }
  function redistribuir(E, estilo, rng) {
    var us = E.u.slice();
    // barajar y ordenar (estable) por prioridad de rol
    for (var i = us.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = us[i]; us[i] = us[j]; us[j] = t; }
    var rolu = us.map(function (u) { return disenoDe(u).rol; });
    var idx = us.map(function (u, n) { return n; });
    idx.sort(function (a, b) { return PRIORIDAD_ROL[rolu[a]] - PRIORIDAD_ROL[rolu[b]]; });
    var filas = [[], [], [], [], [], []];
    for (var n = 0; n < idx.length; n++) {
      var prefs = FILAS_ROL[rolu[idx[n]]];
      var puesto = false;
      for (var f = 0; f < prefs.length && !puesto; f++) {
        if (filas[prefs[f]].length < estilo.cap) { filas[prefs[f]].push(us[idx[n]]); puesto = true; }
      }
      for (var r = 0; r < R.filasZona && !puesto; r++) {
        if (filas[r].length < R.columnas) { filas[r].push(us[idx[n]]); puesto = true; }
      }
    }
    E.occ = {};
    for (var fr = 0; fr < R.filasZona; fr++) {
      var fila = filas[fr];
      var cols = columnasFila(fila.length, estilo.cols);
      for (var q = 0; q < fila.length; q++) {
        var col = estilo.espejo ? R.columnas - 1 - cols[q] : cols[q];
        fila[q].col = col; fila[q].prof = fr;
        E.occ[col * 8 + fr] = true;
      }
    }
    E.u = us;
    return E;
  }

  function estiloAzar(rng) {
    var x = rng();
    return {
      cols: x < 0.4 ? 'ancho' : (x < 0.8 ? 'centro' : 'flancos'),
      cap: rng.elegir([12, 8, 6]),
      espejo: rng() < 0.5
    };
  }

  // ── Elegir qué comprar ─────────────────────────────────────────────────
  function elegirPonderado(ctx, limite, pesos, soloTop) {
    var T = tabla(), rng = ctx.rng, tot = 0, i;
    for (i = 0; i < T.lista.length; i++) if (T.lista[i].costo <= limite) tot += pesos ? pesos[i] : 1;
    if (tot <= 0) return null;
    var x = rng() * tot;
    var last = null;
    for (i = 0; i < T.lista.length; i++) {
      if (T.lista[i].costo > limite) continue;
      last = T.lista[i];
      x -= pesos ? pesos[i] : 1;
      if (x <= 0) return last;
    }
    return last;
  }

  function porReceta(ctx, limite, p) {
    var r = elegirReceta(ctx.rng, p, limite);
    return r ? tabla().porClave[r.cab + '-' + r.tor + '-' + r.pat] : null;
  }

  // Gasta la biomasa libre de E (menos `reserva`) comprando según `modo`.
  function rellenar(ctx, E, modo, reserva) {
    var rng = ctx.rng, guard = 0, masa = null, quedan = 0, T = tabla();
    if (modo === 'masa') { masa = elegirPonderado(ctx, E.libre - reserva, ctx.w); quedan = rng.entero(3, 12); }
    if (modo === 'copia' && E.u.length) {
      var mejor = null, nm = 0;
      for (var k in E.cnt) if (E.cnt[k] > nm) { nm = E.cnt[k]; mejor = T.porClave[k]; }
      masa = mejor; quedan = rng.entero(2, 8);
    }
    while (guard++ < 70) {
      var lim = E.libre - reserva;
      if (lim < T.minCosto) break;
      var d = null;
      if (masa && quedan > 0 && masa.costo <= lim) { d = masa; quedan--; }
      else if (modo === 'receta') d = porReceta(ctx, lim, ctx.pesosRecetas);
      else if (modo === 'uniforme') d = elegirPonderado(ctx, lim, null);
      else d = elegirPonderado(ctx, lim, ctx.w);
      if (!d) d = elegirPonderado(ctx, lim, ctx.w);
      if (!d || !comprar(E, d, rng)) break;
    }
    return E;
  }

  // Un armado aleatorio partiendo del ejército previo.
  function construirCandidato(ctx, n) {
    var rng = ctx.rng, E = nuevoEstado(ctx), T = tabla(), k, i;
    var modos = ['hibrido', 'hibrido', 'masa', 'receta', 'copia', 'uniforme'];
    var modo = n === 0 ? 'receta' : (n === 1 ? 'hibrido' : rng.elegir(modos));
    var partes = [];

    // mejora de nivel de un diseño (más copias → más conveniente)
    if (n > 1 && E.u.length && rng() < 0.4) {
      var claves = Object.keys(E.cnt).filter(function (c) { return E.cnt[c] > 0; });
      var elegida = null, mejorV = -1;
      for (i = 0; i < claves.length; i++) {
        var v = E.cnt[claves[i]] * T.porClave[claves[i]].costo * (0.5 + rng());
        if (v > mejorV) { mejorV = v; elegida = claves[i]; }
      }
      if (elegida && subirNivel(E, elegida)) partes.push('sube');
    }
    // reciclar algunas veteranas flojas contra el enemigo
    if (n > 1 && E.u.length > 2 && rng() < 0.3) {
      var cuantas = rng.entero(1, 3);
      for (var q = 0; q < cuantas && E.u.length > 1; q++) {
        var pj = -1, mejorP = Infinity;
        for (i = 0; i < 3; i++) {
          var cand = rng.entero(0, E.u.length - 1);
          var pw = ctx.w[disenoDe(E.u[cand]).i];
          if (pw < mejorP) { mejorP = pw; pj = cand; }
        }
        reciclar(ctx, E, pj);
      }
      partes.push('recicla');
    }
    var reserva = (n > 1 && rng() < 0.15) ? Math.floor(E.libre * rng() * 0.3) : 0;
    rellenar(ctx, E, modo, reserva);
    partes.push(modo);
    // ubicación: mantener lo ya puesto, o reubicar todo con un estilo
    if (n > 0 && rng() < 0.7) { redistribuir(E, estiloAzar(rng), rng); partes.push('redist'); }
    E.tag = partes.join('+');
    return E;
  }

  // ¿El estado respeta las reglas? (celdas, rango, libro de biomasa, niveles).
  function valido(ctx, E) {
    var vistos = {};
    for (var i = 0; i < E.u.length; i++) {
      var u = E.u[i], k = u.col * 8 + u.prof;
      if (u.col < 0 || u.col >= R.columnas || u.prof < 0 || u.prof >= R.filasZona || vistos[k]) return false;
      vistos[k] = true;
    }
    var b = BM.balanceRonda(ctx.ejPrevio, ctx.nivPrevio, E.u, E.niv);
    if (b.invalido) return false;
    return BM.biomasaLibre(ctx.libreAnt, ctx.ronda, ctx.ejPrevio, ctx.nivPrevio, E.u, E.niv) >= 0;
  }

  // ── Rivales de referencia y predicciones ───────────────────────────────
  function referencias(ctx) {
    var out = [];
    for (var i = 0; i < 4; i++) {
      var ej = generarEjercitoIA([], [], ctx.ronda, (ctx.op.semilla >>> 0) + 101 * (i + 1));
      out.push({ ej: ej, niv: {}, peso: 1 });
    }
    return out;
  }

  // Ejército ya visto + lo que el jugador podría sumar con su próximo ingreso.
  function sumarAlRival(ctx, ejVisto, nivVisto, disenos, presupuesto, rng) {
    var E = { u: copiarEj(ejVisto), occ: {}, cnt: {}, libre: presupuesto, niv: {} };
    for (var i = 0; i < E.u.length; i++) E.occ[E.u[i].col * 8 + E.u[i].prof] = true;
    var guard = 0, n = 0;
    while (guard++ < 40 && disenos.length) {
      var d = disenos[n++ % disenos.length];
      if (d.costo > E.libre) {
        var barata = null;
        for (var j = 0; j < disenos.length; j++) if (disenos[j].costo <= E.libre) { barata = disenos[j]; break; }
        if (!barata) break;
        d = barata;
      }
      if (!comprar(E, d, rng)) break;
    }
    return { ej: E.u, niv: nivVisto || {} };
  }

  function predecir(ctx, nContra) {
    var op = ctx.op, T = tabla(), ejV = op.ejVisto || [], rng = BM.crearRng((op.semilla >>> 0) + 777);
    var out = [];
    if (!ejV.length) return out;
    var ing = BM.ingresoRonda(ctx.ronda + 1);
    // 1) el jugador repite lo que sumó la ronda anterior (o su diseño más numeroso)
    var previo = (op.memoria && op.memoria.visto) ? BM.contarDisenos(op.memoria.visto.ej) : {};
    var cntV = BM.contarDisenos(ejV), nuevos = [], mas = null, nm = 0, k;
    for (k in cntV) {
      if (cntV[k] > (previo[k] || 0)) nuevos.push(T.porClave[k]);
      if (cntV[k] > nm) { nm = cntV[k]; mas = T.porClave[k]; }
    }
    var repite = nuevos.length ? nuevos : [mas];
    var rep = sumarAlRival(ctx, ejV, op.nivVisto, repite, ing, rng);
    out.push({ nombre: 'repite', ej: rep.ej, niv: rep.niv, peso: 1 });
    // 2) el jugador responde a MI ejército previo con el mejor contraataque que se le ocurra
    if (ctx.ejPrevio.length) {
      var wC = pesosContra(ctx.ejPrevio, ctx.nivPrevio);
      var ord = T.lista.map(function (d) { return d; }).sort(function (a, b) { return wC[b.i] - wC[a.i]; }).slice(0, 5);
      var cs = [];
      for (var i = 0; i < ord.length; i++) {
        var cand = sumarAlRival(ctx, ejV, op.nivVisto, [ord[i]], ing, rng);
        // mejor para el jugador = peor puntaje para mí
        cs.push({ nombre: 'contra', ej: cand.ej, niv: cand.niv, peso: 1,
          sc: puntaje(ctx, ctx.ejPrevio, ctx.nivPrevio, cand, (op.semilla >>> 0) + 5, HORIZONTE_RAPIDO) });
      }
      cs.sort(function (a, b) { return a.sc - b.sc; });
      for (i = 0; i < nContra && i < cs.length; i++) out.push(cs[i]);
    }
    return out;
  }

  // ── Resultado ──────────────────────────────────────────────────────────
  function limpiarNiv(ctx, niv) {
    var out = {}, k;
    for (k in niv) if (BM.nivelDiseno(niv, k) > 1 || ctx.nivPrevio[k] !== undefined) out[k] = BM.nivelDiseno(niv, k);
    return out;
  }

  function resultado(ctx, E, memoria, extra) {
    var ej = copiarEj(E.u);
    var niv = limpiarNiv(ctx, E.niv);
    var info = { candidatosProbados: ctx.evals, ms: Math.round(reloj() - ctx.inicio), dificultad: ctx.op.dificultad };
    if (extra) for (var k in extra) info[k] = extra[k];
    return { ej: ej, niv: niv, memoria: memoria, info: info };
  }

  function memoriaBase(ctx, extra) {
    var m = { v: 1, ronda: ctx.ronda, visto: { ej: copiarEj(ctx.op.ejVisto), niv: ctx.op.nivVisto || {} } };
    if (extra) for (var k in extra) m[k] = extra[k];
    return m;
  }

  // ── Rival ──────────────────────────────────────────────────────────────
  async function pensarRival(ctx) {
    var cfg = ctx.cfg, op = ctx.op;
    var rivales = (op.ejVisto && op.ejVisto.length) ? [{ ej: op.ejVisto, niv: op.nivVisto || {}, peso: 1 }] : referencias(ctx);
    ctx.w = pesosContra(op.ejVisto || [], op.nivVisto);
    ctx.pesosRecetas = pesos(analizar(op.ejVisto || []), ctx.ronda);
    var mejor = null, mejorV = -Infinity;
    var cand = Math.min(cfg.maxCand, Math.floor(presupuestoSims(ctx) / cfg.semillas));
    for (var n = 0; n < cand; n++) {
      if (n > 0 && agotado(ctx)) break;
      var E = construirCandidato(ctx, n);
      if (!valido(ctx, E)) continue;
      var v = valorFinal(evaluar(ctx, E.u, E.niv, rivales, cfg.semillas, HORIZONTE_RAPIDO), 0) + 0.01 * E.libre;
      if (v > mejorV) { mejorV = v; mejor = E; }
      ctx.progreso = (n + 1) / cand;
      await pulso(ctx);
    }
    return resultado(ctx, mejor, memoriaBase(ctx), { puntaje: mejorV });
  }

  // ── Experto ────────────────────────────────────────────────────────────
  async function pensarExperto(ctx) {
    var cfg = ctx.cfg, op = ctx.op, rng = ctx.rng, i, n;
    var hayVisto = !!(op.ejVisto && op.ejVisto.length);
    var S = presupuestoSims(ctx);
    ctx.w = pesosContra(op.ejVisto || [], op.nivVisto);
    ctx.pesosRecetas = pesos(analizar(op.ejVisto || []), ctx.ronda);
    var refs = hayVisto ? [{ ej: op.ejVisto, niv: op.nivVisto || {}, peso: 1 }] : referencias(ctx);
    var preds = hayVisto ? predecir(ctx, 2) : [];
    await pulso(ctx);
    // conjunto de evaluación final: ejército visto (peso 2) y anticipaciones
    var conjunto = refs.map(function (r) { return { ej: r.ej, niv: r.niv, peso: hayVisto ? 2 : 1 }; });
    for (i = 0; i < preds.length; i++) conjunto.push({ ej: preds[i].ej, niv: preds[i].niv, peso: 1 });

    // etapa 1: tamizar muchos armados contra lo visto (1 simulación c/u)
    var cands = [];
    var evals1 = ctx.evals + Math.floor(0.45 * S);
    for (n = 0; n < cfg.maxCand && (n === 0 || (ctx.evals < evals1 && !agotado(ctx, ctx.tope * 0.5))); n++) {
      var E = construirCandidato(ctx, n);
      if (!valido(ctx, E)) continue;
      var r1 = evaluar(ctx, E.u, E.niv, refs, 1, HORIZONTE_RAPIDO);
      cands.push({ E: E, v: r1.media + 0.01 * E.libre });
      ctx.progreso = 0.5 * ctx.evals / evals1;
      await pulso(ctx);
    }
    cands.sort(function (a, b) { return b.v - a.v; });
    var top = cands.slice(0, cfg.top);

    // etapa 2: evaluar a fondo los mejores contra lo visto (y espejado) y lo anticipado
    function profundo(E) {
      var r = evaluar(ctx, E.u, E.niv, conjunto, cfg.semillas, HORIZONTE_RAPIDO);
      return valorFinal(r, 0.35) + 0.01 * E.libre;
    }
    var evals2 = ctx.evals + Math.floor(0.3 * S), finales = [];
    for (i = 0; i < top.length; i++) {
      if (i > 0 && (ctx.evals >= evals2 || agotado(ctx, ctx.tope * 0.75))) break;
      finales.push({ E: top[i].E, v: profundo(top[i].E) });
      ctx.progreso = 0.5 + 0.25 * (i + 1) / top.length;
      await pulso(ctx);
    }
    finales.sort(function (a, b) { return b.v - a.v; });

    // etapa 3: variaciones de ubicación sobre los 3 mejores
    var top3 = finales.slice(0, 3), evals3 = ctx.evals + Math.floor(0.25 * S);
    for (var j = 0; j < 12 && top3.length && ctx.evals < evals3 && !agotado(ctx); j++) {
      var base = top3[j % top3.length], V = clonarEstado(base.E), q = Math.floor(j / top3.length);
      redistribuir(V, q === 0 ? { cols: 'ancho', cap: 12, espejo: false } : (q === 1 ? { cols: 'centro', cap: 8, espejo: false } : estiloAzar(rng)), rng);
      V.tag += '+var';
      if (valido(ctx, V)) finales.push({ E: V, v: profundo(V) });
      ctx.progreso = 0.75 + 0.25 * ctx.evals / evals3;
      await pulso(ctx);
    }
    finales.sort(function (a, b) { return b.v - a.v; });
    return resultado(ctx, finales[0].E, memoriaBase(ctx), { puntaje: finales[0].v, tag: finales[0].E.tag });
  }

  // ── Pesadilla: algoritmo genético ──────────────────────────────────────
  function reparar(ctx, E, rng) {
    // sube niveles a lo que ya había y quita lo que no alcanza a pagarse
    var guard = 0;
    E.libre = recalcLibre(ctx, E);
    while (E.libre < 0 && guard++ < 80) {
      var nuevos = [], i, k;
      for (i = 0; i < E.u.length; i++) {
        k = BM.claveDiseno(E.u[i]);
        if ((E.cnt[k] || 0) > (ctx.prevCnt[k] || 0)) nuevos.push(i);
      }
      var mejoras = Object.keys(E.niv).filter(function (c) { return BM.nivelDiseno(E.niv, c) > BM.nivelDiseno(ctx.nivPrevio, c); });
      if (mejoras.length && rng() < 0.3) {
        var c2 = rng.elegir(mejoras);
        E.niv[c2] = BM.nivelDiseno(E.niv, c2) - 1;
      } else if (nuevos.length) {
        reciclar(ctx, E, rng.elegir(nuevos));
      } else if (E.u.length) {
        reciclar(ctx, E, rng.entero(0, E.u.length - 1));
      } else break;
      E.libre = recalcLibre(ctx, E);
    }
    return E;
  }

  function mutar(ctx, E, rng) {
    var T = tabla(), veces = rng.entero(1, 3);
    for (var m = 0; m < veces; m++) {
      var op = rng();
      if (op < 0.22 && E.u.length) {                       // cambiar una parte de una bestia
        var i = rng.entero(0, E.u.length - 1), u = E.u[i];
        var animal = rng.elegir(BM.ANIMALES).id, parte = rng.elegir(['cab', 'tor', 'pat']);
        var nueva = { cab: u.cab, tor: u.tor, pat: u.pat };
        nueva[parte] = animal;
        var d = T.porClave[nueva.cab + '-' + nueva.tor + '-' + nueva.pat];
        var viejo = disenoDe(u);
        if (d !== viejo) {
          var col = u.col, prof = u.prof;
          reciclar(ctx, E, i);
          if (d.costo <= E.libre) {
            E.u.push({ cab: d.cab, tor: d.tor, pat: d.pat, col: col, prof: prof });
            E.occ[col * 8 + prof] = true; E.cnt[d.clave] = (E.cnt[d.clave] || 0) + 1; E.libre -= d.costo;
          }
        }
      } else if (op < 0.45 && E.u.length) {                // mover o intercambiar
        var a = rng.entero(0, E.u.length - 1);
        if (rng() < 0.5 && E.u.length > 1) {
          var b = rng.entero(0, E.u.length - 1), tc = E.u[a].col, tp = E.u[a].prof;
          E.u[a].col = E.u[b].col; E.u[a].prof = E.u[b].prof; E.u[b].col = tc; E.u[b].prof = tp;
        } else {
          var cc = rng.entero(0, R.columnas - 1), pp = rng.entero(0, R.filasZona - 1);
          if (!E.occ[cc * 8 + pp]) {
            delete E.occ[E.u[a].col * 8 + E.u[a].prof];
            E.u[a].col = cc; E.u[a].prof = pp; E.occ[cc * 8 + pp] = true;
          }
        }
      } else if (op < 0.62) {                              // sumar una bestia
        var dd = elegirPonderado(ctx, E.libre, ctx.w);
        if (dd) comprar(E, dd, rng);
      } else if (op < 0.72 && E.u.length) {                // mejorar un diseño
        var ks = Object.keys(E.cnt).filter(function (c) { return E.cnt[c] > 0; });
        if (ks.length) subirNivel(E, rng.elegir(ks));
      } else if (op < 0.84 && E.u.length > 1) {            // reciclar la más floja de tres al azar
        var pj = -1, pm = Infinity;
        for (var t = 0; t < 3; t++) {
          var cand = rng.entero(0, E.u.length - 1), pw = ctx.w[disenoDe(E.u[cand]).i];
          if (pw < pm) { pm = pw; pj = cand; }
        }
        reciclar(ctx, E, pj);
      } else if (op < 0.93) {                              // reubicar todo
        redistribuir(E, estiloAzar(rng), rng);
      } else if (E.u.length) {                             // desplazar todo el ejército de columnas
        var dx = rng() < 0.5 ? -1 : 1, ok = true, j;
        for (j = 0; j < E.u.length; j++) if (E.u[j].col + dx < 0 || E.u[j].col + dx >= R.columnas) ok = false;
        if (ok) {
          E.occ = {};
          for (j = 0; j < E.u.length; j++) { E.u[j].col += dx; E.occ[E.u[j].col * 8 + E.u[j].prof] = true; }
        }
      }
    }
    return E;
  }

  function cruzar(ctx, A, B, rng) {
    // cruce espacial: columnas a la izquierda del corte de A, resto de B
    var corte = rng.entero(2, R.columnas - 2), us = [], i;
    for (i = 0; i < A.u.length; i++) if (A.u[i].col < corte) us.push(A.u[i]);
    for (i = 0; i < B.u.length; i++) if (B.u[i].col >= corte) us.push(B.u[i]);
    var niv = {}, k;
    for (k in A.niv) niv[k] = A.niv[k];
    for (k in B.niv) if (BM.nivelDiseno(B.niv, k) > BM.nivelDiseno(niv, k) && rng() < 0.5) niv[k] = B.niv[k];
    var H = estadoDesde(ctx, us, niv);
    // conservar siempre al menos los veteranos que no estén: no hace falta (el libro ya cuenta reciclajes)
    return H;
  }

  async function pensarPesadilla(ctx) {
    var cfg = ctx.cfg, op = ctx.op, rng = ctx.rng, i;
    var hayVisto = !!(op.ejVisto && op.ejVisto.length);
    var S = presupuestoSims(ctx);
    ctx.w = pesosContra(op.ejVisto || [], op.nivVisto);
    ctx.pesosRecetas = pesos(analizar(op.ejVisto || []), ctx.ronda);
    var refs = hayVisto ? [{ ej: op.ejVisto, niv: op.nivVisto || {}, peso: 2 }] : referencias(ctx);
    var preds = hayVisto ? predecir(ctx, 3) : [];
    var conjunto = refs.slice(), medio = refs.slice();
    for (i = 0; i < preds.length; i++) {
      var pr = { ej: preds[i].ej, niv: preds[i].niv, peso: 1 };
      conjunto.push(pr);
      medio.push(pr);
    }
    await pulso(ctx);

    function aptitud(E, rivales, semillas) {
      return valorFinal(evaluar(ctx, E.u, E.niv, rivales, semillas, HORIZONTE_RAPIDO), 0.3) + 0.01 * E.libre;
    }

    // población inicial: élite de la ronda pasada (reparada y completada) + armados nuevos tamizados
    var pob = [], mem = op.memoria && op.memoria.pob ? op.memoria.pob : [];
    for (i = 0; i < mem.length && i < 4; i++) {
      var Em = estadoDesde(ctx, mem[i].u, mem[i].niv);
      reparar(ctx, Em, rng);
      rellenar(ctx, Em, 'hibrido', 0);
      if (valido(ctx, Em)) pob.push({ E: Em, v: null });
    }
    var cands = [], n, evals1 = ctx.evals + Math.floor(0.4 * S);
    for (n = 0; n < 300 && (n === 0 || (ctx.evals < evals1 && !agotado(ctx, ctx.tope * 0.45))); n++) {
      var E0 = construirCandidato(ctx, n);
      if (!valido(ctx, E0)) continue;
      cands.push({ E: E0, v: evaluar(ctx, E0.u, E0.niv, refs, 1, HORIZONTE_RAPIDO).media + 0.01 * E0.libre });
      ctx.progreso = 0.25 * ctx.evals / evals1;
      await pulso(ctx);
    }
    cands.sort(function (a, b) { return b.v - a.v; });
    for (i = 0; i < cands.length && pob.length < cfg.pob; i++) pob.push({ E: cands[i].E, v: null });
    for (i = 0; i < pob.length; i++) {
      pob[i].v = aptitud(pob[i].E, medio, 1);
      await pulso(ctx);
    }
    function ordenar() { pob.sort(function (a, b) { return b.v - a.v; }); }
    ordenar();

    function torneo() {
      var a = pob[rng.entero(0, pob.length - 1)], b = pob[rng.entero(0, pob.length - 1)];
      return a.v >= b.v ? a : b;
    }

    var hechas = 0, evals2 = Math.floor(0.7 * S);
    while (ctx.evals < evals2 && !agotado(ctx, ctx.tope * 0.85) && hechas < 1000) {
      hechas++;
      var hijo;
      if (rng() < 0.35 && pob.length > 1) hijo = cruzar(ctx, torneo().E, torneo().E, rng);
      else hijo = clonarEstado(torneo().E);
      mutar(ctx, hijo, rng);
      reparar(ctx, hijo, rng);
      if (rng() < 0.6) rellenar(ctx, hijo, rng() < 0.5 ? 'hibrido' : 'copia', 0);
      hijo.tag = 'gen';
      if (!valido(ctx, hijo)) continue;
      pob.push({ E: hijo, v: aptitud(hijo, medio, 1) });
      ordenar();
      if (pob.length > cfg.pob) pob.length = cfg.pob;
      ctx.progreso = 0.25 + 0.55 * ctx.evals / evals2;
      await pulso(ctx);
    }

    // final: los mejores contra todo el conjunto (y su espejo), más variantes de ubicación
    var fin = [], finalistas = pob.slice(0, 4).map(function (p) { return p.E; });
    for (i = 0; i < cands.length && finalistas.length < 10; i++) {   // diversidad: los mejores del tamiz inicial
      if (finalistas.indexOf(cands[i].E) === -1) finalistas.push(cands[i].E);
    }
    for (i = 0; i < finalistas.length; i++) {
      if (i > 0 && agotado(ctx)) break;
      fin.push({ E: finalistas[i], v: aptitud(finalistas[i], conjunto, cfg.semillas) });
      await pulso(ctx);
    }
    fin.sort(function (a, b) { return b.v - a.v; });
    var top2 = fin.slice(0, 2);
    for (var j = 0; j < 8 && top2.length && ctx.evals < S && !agotado(ctx); j++) {
      var V = clonarEstado(top2[j % top2.length].E);
      redistribuir(V, j < 4 ? [{ cols: 'ancho', cap: 12, espejo: false }, { cols: 'centro', cap: 8, espejo: false }][j >> 1 & 1] : estiloAzar(rng), rng);
      V.tag += '+var';
      if (valido(ctx, V)) fin.push({ E: V, v: aptitud(V, conjunto, cfg.semillas) });
      await pulso(ctx);
    }
    fin.sort(function (a, b) { return b.v - a.v; });
    var elite = fin[0];
    var memPob = [elite.E].concat(pob.map(function (p) { return p.E; }).filter(function (e) { return e !== elite.E; })).slice(0, cfg.pob)
      .map(function (e) { return { u: copiarEj(e.u), niv: limpiarNiv(ctx, e.niv) }; });
    return resultado(ctx, elite.E, memoriaBase(ctx, { pob: memPob }), { puntaje: elite.v, generaciones: hechas });
  }

  // ── Punto de entrada ───────────────────────────────────────────────────
  function pensarAprendiz(op) {
    var t0 = reloj(), rng = BM.crearRng(op.semilla);
    var ej = copiarEj(op.ejPrevio);
    var disponible = (op.libreAnterior || 0) + BM.ingresoRonda(op.ronda) + BM.balanceRonda(op.ejPrevio, op.nivPrevio, ej, op.nivPrevio).neto;
    var p = pesos(analizar(op.ejVisto || []), op.ronda);
    completarConRecetas(rng, ej, p, disponible);
    var niv = {};
    for (var k in (op.nivPrevio || {})) niv[k] = op.nivPrevio[k];
    return { ej: ej, niv: niv, memoria: op.memoria || { v: 1 }, info: { candidatosProbados: 1, ms: Math.round(reloj() - t0), dificultad: 'aprendiz' } };
  }

  // Devuelve una Promise; se puede llamar desde el hilo de la UI: trabaja por ranuras de ~12 ms.
  async function pensarIA(opEntrada) {
    var op = {};
    for (var clave in (opEntrada || {})) op[clave] = opEntrada[clave];
    op.ronda = op.ronda || 1;
    op.ejPrevio = op.ejPrevio || []; op.nivPrevio = op.nivPrevio || {};
    op.ejVisto = op.ejVisto || []; op.nivVisto = op.nivVisto || {};
    op.libreAnterior = op.libreAnterior || 0;
    if (op.semilla === undefined) op.semilla = 1;
    var dif = op.dificultad || 'aprendiz';
    if (dif === 'aprendiz' || !CONFIG[dif]) return pensarAprendiz(op);
    var ctx = crearCtx(op, CONFIG[dif]);
    var res;
    if (dif === 'rival') res = await pensarRival(ctx);
    else if (dif === 'experto') res = await pensarExperto(ctx);
    else res = await pensarPesadilla(ctx);
    if (op.alProgreso) { try { op.alProgreso(1); } catch (e) { /* ignorar */ } }
    return res;
  }

  BM.DIFICULTADES = DIFICULTADES;
  BM.pensarIA = pensarIA;

  BM.RECETAS_IA = RECETAS;
  BM.generarEjercitoIA = generarEjercitoIA;
})(typeof window !== 'undefined' ? (window.BM = window.BM || {}) : (globalThis.BM = globalThis.BM || {}));
