/*
 * BeastMixer — Partida: economía (biomasa), ejércitos y duelo asíncrono por link.
 *
 * Economía (GestorEconomia del PDF, simplificada):
 *   presupuesto(ronda) = 60 + 40 × (ronda − 1)  (acumulado)
 *   biomasa libre      = presupuesto − costo del ejército desplegado
 *   reciclar una bestia devuelve el 100% (como en el PDF).
 *
 * Ejército = lista de { cab, tor, pat, col, prof }.
 *   col  0..11  (de izquierda a derecha, visto desde tu lado)
 *   prof 0..5   (0 = primera línea, 5 = retaguardia)
 *
 * Duelo por link: el estado entero viaja en el #hash de la URL.
 *   { v, s: semilla, n: [nombreA, nombreB], e: [[ejA r1, r2, ...], [ejB r1, ...]] }
 * La vida de cada jugador NO se guarda: se recalcula re-simulando todas las
 * rondas (el combate es determinista), así nadie puede editarla a mano.
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
    return decodificarEjercito(d.e[bando][ronda - 1] || '');
  }

  // Re-simula todas las rondas que ambos jugaron. Devuelve vidas e historial.
  function estadoDuelo(d) {
    var vida = [R.vidaJugador, R.vidaJugador];
    var rondas = Math.min(d.e[0].length, d.e[1].length);
    var historial = [];
    for (var r = 1; r <= rondas; r++) {
      if (vida[0] <= 0 || vida[1] <= 0) break;
      var res = BM.resolverCombate(ejercitoDuelo(d, 0, r), ejercitoDuelo(d, 1, r), semillaRonda(d.s, r));
      vida[0] = Math.max(0, vida[0] - res.dano[0]);
      vida[1] = Math.max(0, vida[1] - res.dano[1]);
      historial.push({ ronda: r, ganador: res.ganador, dano: res.dano, vida: vida.slice() });
    }
    var terminado = vida[0] <= 0 || vida[1] <= 0;
    // Le toca a quien jugó menos rondas (al empezar, a A).
    var turno = d.e[0].length <= d.e[1].length ? 0 : 1;
    return {
      vida: vida, historial: historial, terminado: terminado, turno: turno,
      rondasResueltas: historial.length,
      ganadorPartida: terminado ? (vida[0] <= 0 && vida[1] <= 0 ? -1 : (vida[0] <= 0 ? 1 : 0)) : null
    };
  }

  BM.presupuesto = presupuesto;
  BM.costoEjercito = costoEjercito;
  BM.celdaOcupada = celdaOcupada;
  BM.codificarEjercito = codificarEjercito;
  BM.decodificarEjercito = decodificarEjercito;
  BM.semillaRonda = semillaRonda;
  BM.nuevoDuelo = nuevoDuelo;
  BM.codificarDuelo = codificarDuelo;
  BM.decodificarDuelo = decodificarDuelo;
  BM.ejercitoDuelo = ejercitoDuelo;
  BM.estadoDuelo = estadoDuelo;
})(typeof window !== 'undefined' ? (window.BM = window.BM || {}) : (globalThis.BM = globalThis.BM || {}));
