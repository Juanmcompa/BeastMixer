/*
 * BeastMixer — Partida: economía (biomasa), ejércitos y duelo asíncrono por link.
 *
 * ECONOMÍA (libro de cuentas por ronda; reemplaza a "presupuesto − costo del ejército"):
 *   Ingreso: la ronda 1 da REGLAS.biomasaInicial (60); cada ronda posterior da
 *   REGLAS.biomasaPorRonda (40). La biomasa que no se gasta SE ARRASTRA.
 *   Dentro de una ronda el jugador pasa del estado anterior (ejPrev, nivPrev) al
 *   nuevo (ejAct, nivAct). Por cada diseño (clave cab-tor-pat):
 *     delta = copias en ejAct − copias en ejPrev
 *     delta > 0 → compras    += delta × costo
 *     delta < 0 → reembolsos += (−delta) × floor(costo × 0.5)
 *   Reciclar una VETERANA (copia que sobrevivió de la ronda anterior) devuelve sólo
 *   el 50%. Reciclar algo comprado en esta misma ronda es "no comprarlo": la regla
 *   de cuenta neta da el reembolso completo sola (comprás 1, reciclás 1 → delta 0).
 *   Mover bestias de lugar es gratis.
 *   mejoras = suma de BM.costoSubirNivel por cada escalón de nivel entre
 *   nivPrev[k] y nivAct[k] (2×costo para 1→2, 4×costo para 2→3). Los niveles
 *   nunca bajan: si nivAct < nivPrev la ronda es inválida (balance.invalido).
 *   neto = reembolsos − compras − mejoras
 *   libre al final de la ronda = libreAnterior + ingreso(ronda) + neto
 *   Una ronda es inválida si deja la biomasa libre en negativo.
 *   API: balanceRonda, biomasaLibre, historialBiomasa, ingresoRonda,
 *   reembolsoAlReciclar, esVeterana. presupuesto() y costoEjercito() siguen
 *   existiendo (equivalen al libro cuando sólo se compra: la IA actual).
 *
 * NIVELES: pertenecen al DISEÑO (ver criatura.js). `niveles` = { 'cab-tor-pat': nivel },
 *   clave ausente = nivel 1. Hay que pasarlos a resolverCombate/crearCombate.
 *
 * Ejército = lista de { cab, tor, pat, col, prof }.
 *   col  0..11  (de izquierda a derecha, visto desde tu lado)
 *   prof 0..5   (0 = primera línea, 5 = retaguardia)
 *
 * Duelo por link: el estado entero viaja en el #hash de la URL.
 *   { v, s: semilla, n: [nombreA, nombreB], e: [[ronda1, ronda2, ...], [ronda1, ...]] }
 *   Cada ronda es un string: codigoEjercito [+ '~' + codigoNiveles].
 *     codigoEjercito: 5 caracteres por bestia (ver codificarEjercito).
 *     codigoNiveles : 4 caracteres por diseño con nivel ≥ 2: 3 índices de animal (0-7)
 *                     + el dígito del nivel. Los links viejos (sin '~') siguen valiendo
 *                     y se leen con niveles = {}. Cada ronda guarda el estado COMPLETO
 *                     (todos los niveles acumulados), igual que el ejército.
 * La vida y la biomasa de cada jugador NO se guardan: se recalculan re-simulando
 * todas las rondas (el combate es determinista), así nadie puede editarlas a mano.
 */
(function (BM) {
  'use strict';

  var R = BM.REGLAS;

  function presupuesto(ronda) { return R.biomasaInicial + R.biomasaPorRonda * (ronda - 1); }

  function costoEjercito(ej) {
    var t = 0;
    for (var i = 0; i < ej.length; i++) t += BM.ensamblar(ej[i].cab, ej[i].tor, ej[i].pat).costo;
    return t;
  }

  // ── Libro de cuentas de biomasa ─────────────────────────────────────────

  // Cuenta las copias por diseño: { 'cab-tor-pat': n }.
  function contarDisenos(ej) {
    var m = {};
    for (var i = 0; i < ej.length; i++) {
      var k = BM.claveDiseno(ej[i]);
      m[k] = (m[k] || 0) + 1;
    }
    return m;
  }

  // Parte una clave 'cab-tor-pat' en sus tres animales.
  function partesDeClave(k) { var p = k.split('-'); return { cab: p[0], tor: p[1], pat: p[2] }; }

  // Biomasa que entra en una ronda: la 1 da biomasaInicial, las demás biomasaPorRonda.
  function ingresoRonda(ronda) { return ronda <= 1 ? R.biomasaInicial : R.biomasaPorRonda; }

  // Balance de una ronda. ejPrev/nivPrev = estado al cerrar la ronda anterior ([] / {} en la
  // ronda 1); ejAct/nivAct = estado actual. Devuelve { compras, reembolsos, mejoras, neto, invalido }
  // con neto = reembolsos − compras − mejoras (invalido = true si algún nivel bajó).
  function balanceRonda(ejPrev, nivPrev, ejAct, nivAct) {
    ejPrev = ejPrev || []; ejAct = ejAct || [];
    nivPrev = nivPrev || {}; nivAct = nivAct || {};
    var antes = contarDisenos(ejPrev), ahora = contarDisenos(ejAct);
    var compras = 0, reembolsos = 0, mejoras = 0, invalido = false, k, p, costo;
    var claves = {};
    for (k in antes) claves[k] = 1;
    for (k in ahora) claves[k] = 1;
    var ordenadas = Object.keys(claves).sort();
    for (var i = 0; i < ordenadas.length; i++) {
      k = ordenadas[i]; p = partesDeClave(k);
      costo = BM.ensamblar(p.cab, p.tor, p.pat).costo;
      var delta = (ahora[k] || 0) - (antes[k] || 0);
      if (delta > 0) compras += delta * costo;
      else if (delta < 0) reembolsos += (-delta) * Math.floor(costo * R.reembolsoVeterana);
    }
    // Mejoras: todas las claves de nivel de ambos mapas (se puede mejorar un diseño sin copias en mesa).
    var clavesNiv = {};
    for (k in nivPrev) clavesNiv[k] = 1;
    for (k in nivAct) clavesNiv[k] = 1;
    var ordNiv = Object.keys(clavesNiv).sort();
    for (var j = 0; j < ordNiv.length; j++) {
      k = ordNiv[j]; p = partesDeClave(k);
      var n0 = BM.nivelDiseno(nivPrev, k), n1 = BM.nivelDiseno(nivAct, k);
      if (n1 < n0) { invalido = true; continue; }
      for (var n = n0; n < n1; n++) mejoras += BM.costoSubirNivel(p.cab, p.tor, p.pat, n);
    }
    return { compras: compras, reembolsos: reembolsos, mejoras: mejoras,
      neto: reembolsos - compras - mejoras, invalido: invalido };
  }

  // Biomasa libre al cerrar la ronda `ronda` (libreAnterior = 0 en la ronda 1).
  function biomasaLibre(libreAnterior, ronda, ejPrev, nivPrev, ejAct, nivAct) {
    return (libreAnterior || 0) + ingresoRonda(ronda) + balanceRonda(ejPrev, nivPrev, ejAct, nivAct).neto;
  }

  // rondas = [{ ej, niv }, ...] con la ronda 1 primero (su estado previo es vacío).
  // Devuelve { libre: [libre al final de cada ronda], balances: [balanceRonda de cada una],
  //   invalido: true si alguna ronda quedó en negativo o bajó un nivel,
  //   primeraInvalida: nº de ronda (1-based) de la primera inválida, o null }.
  function historialBiomasa(rondas) {
    var libre = [], balances = [], invalido = false, primera = null;
    var ejPrev = [], nivPrev = {}, acum = 0;
    rondas = rondas || [];
    for (var i = 0; i < rondas.length; i++) {
      var ej = rondas[i].ej || [], niv = rondas[i].niv || {};
      var b = balanceRonda(ejPrev, nivPrev, ej, niv);
      acum = acum + ingresoRonda(i + 1) + b.neto;
      libre.push(acum); balances.push(b);
      if ((acum < 0 || b.invalido) && !invalido) { invalido = true; primera = i + 1; }
      ejPrev = ej; nivPrev = niv;
    }
    return { libre: libre, balances: balances, invalido: invalido, primeraInvalida: primera };
  }

  // ¿La bestia `u` (que está en ejAct) es veterana, es decir, sobrevivió de la ronda anterior?
  // Lo es si su diseño NO tiene más copias ahora que en ejPrev (no hay "compra nueva" que reciclar primero).
  function esVeterana(ejPrev, ejAct, u) {
    var k = BM.claveDiseno(u);
    return (contarDisenos(ejAct || [])[k] || 0) <= (contarDisenos(ejPrev || [])[k] || 0);
  }

  // Cuánta biomasa devolvería ahora mismo quitar `u` de ejAct: 100% del costo si es una compra de
  // esta ronda, floor(50%) si es veterana.
  function reembolsoAlReciclar(ejPrev, ejAct, u) {
    var costo = BM.ensamblar(u.cab, u.tor, u.pat).costo;
    return esVeterana(ejPrev, ejAct, u) ? Math.floor(costo * R.reembolsoVeterana) : costo;
  }

  function celdaOcupada(ej, col, prof, ignorar) {
    for (var i = 0; i < ej.length; i++) {
      if (ej[i] !== ignorar && ej[i].col === col && ej[i].prof === prof) return ej[i];
    }
    return null;
  }

  // ── Codificación compacta: 5 caracteres por bestia ──────────────────────
  // [cabeza][torso][patas] (índice 0-7) + celda (col*filasZona+prof) en base 36 (2 chars)
  function codificarEjercito(ej) {
    var s = '';
    for (var i = 0; i < ej.length; i++) {
      var u = ej[i];
      var celda = u.col * R.filasZona + u.prof;
      s += BM.indiceAnimal(u.cab) + '' + BM.indiceAnimal(u.tor) + '' + BM.indiceAnimal(u.pat) +
        ('0' + celda.toString(36)).slice(-2);
    }
    return s;
  }

  function decodificarEjercito(str) {
    var ej = [];
    if (!str) return ej;
    var tilde = str.indexOf('~');
    if (tilde !== -1) str = str.slice(0, tilde); // ignora la parte de niveles
    for (var i = 0; i + 5 <= str.length; i += 5) {
      var a = BM.ANIMALES[+str[i]], b = BM.ANIMALES[+str[i + 1]], c = BM.ANIMALES[+str[i + 2]];
      var celda = parseInt(str.substr(i + 3, 2), 36);
      if (!a || !b || !c || isNaN(celda)) continue;
      var col = Math.floor(celda / R.filasZona), prof = celda % R.filasZona;
      if (col >= R.columnas || celdaOcupada(ej, col, prof)) continue;
      ej.push({ cab: a.id, tor: b.id, pat: c.id, col: col, prof: prof });
    }
    return ej;
  }

  // ── Ronda con niveles: ejército + ('~' + niveles) ──────────────────────
  // Niveles: 4 caracteres por diseño con nivel ≥ 2 → 3 índices de animal (0-7) + dígito del nivel.
  function codificarNiveles(niv) {
    var claves = Object.keys(niv || {}).sort(), s = '';
    for (var i = 0; i < claves.length; i++) {
      var p = partesDeClave(claves[i]);
      var a = BM.indiceAnimal(p.cab), b = BM.indiceAnimal(p.tor), c = BM.indiceAnimal(p.pat);
      var n = BM.nivelDiseno(niv, claves[i]);
      if (a < 0 || b < 0 || c < 0 || n < 2) continue;
      s += a + '' + b + '' + c + n;
    }
    return s;
  }

  function decodificarNiveles(str) {
    var niv = {};
    for (var i = 0; i + 4 <= (str || '').length; i += 4) {
      var a = BM.ANIMALES[+str[i]], b = BM.ANIMALES[+str[i + 1]], c = BM.ANIMALES[+str[i + 2]];
      var n = +str[i + 3];
      if (!a || !b || !c || !(n >= 2)) continue;
      niv[a.id + '-' + b.id + '-' + c.id] = BM.normalizarNivel(n);
    }
    return niv;
  }

  function codificarRonda(ej, niv) {
    var n = codificarNiveles(niv);
    return codificarEjercito(ej || []) + (n ? '~' + n : '');
  }

  // Devuelve { ej, niv }. Los strings viejos (sin '~') dan niv = {}.
  function decodificarRonda(str) {
    str = str || '';
    var tilde = str.indexOf('~');
    if (tilde === -1) return { ej: decodificarEjercito(str), niv: {} };
    return { ej: decodificarEjercito(str.slice(0, tilde)), niv: decodificarNiveles(str.slice(tilde + 1)) };
  }

  function aBase64Url(texto) {
    var bytes = new TextEncoder().encode(texto);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function deBase64Url(b64) {
    b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function semillaRonda(semilla, ronda) { return ((semilla >>> 0) + ronda * 7919) >>> 0; }

  // ── Duelo asíncrono ─────────────────────────────────────────────────────
  function nuevoDuelo(nombreA) {
    return { v: 1, s: (Math.random() * 0xffffffff) >>> 0, n: [nombreA || 'Jugador A', ''], e: [[], []] };
  }

  function codificarDuelo(d) { return aBase64Url(JSON.stringify(d)); }

  function decodificarDuelo(str) {
    try {
      var d = JSON.parse(deBase64Url(str));
      if (!d || d.v !== 1 || !d.e || d.e.length !== 2) return null;
      return d;
    } catch (err) { return null; }
  }

  function ejercitoDuelo(d, bando, ronda) {
    return decodificarRonda(d.e[bando][ronda - 1] || '').ej;
  }

  // Niveles del jugador `bando` en la ronda `ronda` ({} si no hay ronda o es un link viejo).
  function nivelesDuelo(d, bando, ronda) {
    return decodificarRonda(d.e[bando][ronda - 1] || '').niv;
  }

  // Re-simula todas las rondas que ambos jugaron. Devuelve vidas e historial.
  // Además calcula el historial de biomasa de cada jugador (todas las rondas que envió,
  // aunque la rival aún no haya respondido):
  //   est.biomasa[bando]  = biomasa libre al final de cada ronda enviada
  //   est.libre[bando]    = la última de esas (o 0 si no envió ninguna)
  //   est.invalido[bando] = nº de ronda (1-based) en que su biomasa quedó negativa o bajó un
  //                         nivel, o null si todo es válido. NO se lanza error: la UI decide.
  //   est.hayInvalido     = true si algún bando es inválido.
  function estadoDuelo(d) {
    var vida = [R.vidaJugador, R.vidaJugador];
    var rondas = Math.min(d.e[0].length, d.e[1].length);
    var historial = [];
    var decod = [[], []];
    for (var b = 0; b < 2; b++) {
      for (var k = 0; k < d.e[b].length; k++) decod[b].push(decodificarRonda(d.e[b][k] || ''));
    }
    for (var r = 1; r <= rondas; r++) {
      if (vida[0] <= 0 || vida[1] <= 0) break;
      var ra = decod[0][r - 1], rb = decod[1][r - 1];
      var res = BM.resolverCombate(ra.ej, rb.ej, semillaRonda(d.s, r), ra.niv, rb.niv);
      vida[0] = Math.max(0, vida[0] - res.dano[0]);
      vida[1] = Math.max(0, vida[1] - res.dano[1]);
      historial.push({ ronda: r, ganador: res.ganador, dano: res.dano, vida: vida.slice() });
    }
    var terminado = vida[0] <= 0 || vida[1] <= 0;
    // Le toca a quien jugó menos rondas (al empezar, a A).
    var turno = d.e[0].length <= d.e[1].length ? 0 : 1;
    var hist = [historialBiomasa(decod[0].map(function (x) { return { ej: x.ej, niv: x.niv }; })),
      historialBiomasa(decod[1].map(function (x) { return { ej: x.ej, niv: x.niv }; }))];
    var biomasa = [hist[0].libre, hist[1].libre];
    var invalido = [hist[0].primeraInvalida, hist[1].primeraInvalida];
    return {
      vida: vida, historial: historial, terminado: terminado, turno: turno,
      rondasResueltas: historial.length,
      ganadorPartida: terminado ? (vida[0] <= 0 && vida[1] <= 0 ? -1 : (vida[0] <= 0 ? 1 : 0)) : null,
      biomasa: biomasa,
      libre: [biomasa[0].length ? biomasa[0][biomasa[0].length - 1] : 0, biomasa[1].length ? biomasa[1][biomasa[1].length - 1] : 0],
      invalido: invalido,
      hayInvalido: invalido[0] !== null || invalido[1] !== null
    };
  }

  BM.presupuesto = presupuesto;
  BM.costoEjercito = costoEjercito;
  BM.celdaOcupada = celdaOcupada;
  BM.contarDisenos = contarDisenos;
  BM.ingresoRonda = ingresoRonda;
  BM.balanceRonda = balanceRonda;
  BM.biomasaLibre = biomasaLibre;
  BM.historialBiomasa = historialBiomasa;
  BM.esVeterana = esVeterana;
  BM.reembolsoAlReciclar = reembolsoAlReciclar;
  BM.codificarRonda = codificarRonda;
  BM.decodificarRonda = decodificarRonda;
  BM.codificarEjercito = codificarEjercito;
  BM.decodificarEjercito = decodificarEjercito;
  BM.semillaRonda = semillaRonda;
  BM.nuevoDuelo = nuevoDuelo;
  BM.codificarDuelo = codificarDuelo;
  BM.decodificarDuelo = decodificarDuelo;
  BM.ejercitoDuelo = ejercitoDuelo;
  BM.nivelesDuelo = nivelesDuelo;
  BM.estadoDuelo = estadoDuelo;
})(typeof window !== 'undefined' ? (window.BM = window.BM || {}) : (globalThis.BM = globalThis.BM || {}));
