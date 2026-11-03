/*
 * BeastMixer — Ensamblaje de bestias.
 *
 * ensamblar(cabeza, torso, patas, nivel) compone las estadísticas finales a
 * partir de las tres partes. Es una función pura: no guarda estado, no muta los
 * datos del catálogo (equivale al duplicate(true) del PDF: nunca se toca la plantilla).
 *
 * NIVELES (por DISEÑO, no por unidad):
 *   Un diseño es la tripleta cab-tor-pat (BM.claveDiseno). Todas las copias de un
 *   diseño comparten nivel. Los niveles de un jugador viajan como un objeto
 *   `niveles` = { 'cab-tor-pat': nivel }; una clave ausente vale nivel 1.
 *   Niveles 1..REGLAS.nivelMax (3):
 *     nivel 1: vida ×1,    daño ×1
 *     nivel 2: vida ×1.35, daño ×1.25
 *     nivel 3: vida ×1.75, daño ×1.5     (la vida se redondea a entero)
 *   s.costo  = costo BASE de la bestia (no cambia con el nivel; es lo que se paga al comprar).
 *   s.valor  = costo × (1 + 0.5 × (nivel − 1)); se usa para el daño al jugador
 *              (una bestia mejorada que sobrevive duele más).
 *   s.nivel  = nivel aplicado.
 *   costoSubirNivel(cab, tor, pat, nivelActual) = biomasa para pasar de nivelActual
 *   a nivelActual+1: 2×costo (1→2), 4×costo (2→3), null si ya está al máximo.
 *
 * Determinismo: los multiplicadores son constantes fijas y la cuenta usa sólo
 * * y Math.round, así que todos los dispositivos obtienen los mismos números.
 */
(function (BM) {
  'use strict';

  var ADJETIVO_PATAS = {
    lobo: 'veloz', tortuga: 'parsimonioso', arana: 'zancudo', rino: 'trotón',
    escorpion: 'rastrero', puercoespin: 'patón', elefante: 'pisotón', rana: 'saltarín'
  };

  function nombreHibrido(cab, tor, pat) {
    var A = BM.animalPorId(cab), B = BM.animalPorId(tor);
    var base;
    if (cab === tor) base = A.nombre;
    else {
      var suf = B.suf;
      // Evita letras dobles feas: "Lo"+"ortuga"
      if (A.pre.slice(-1).toLowerCase() === suf.charAt(0).toLowerCase()) suf = suf.slice(1);
      base = A.pre + suf;
    }
    // Las patas sólo agregan un adjetivo si vienen de un tercer animal.
    if (pat !== cab && pat !== tor) base += ' ' + ADJETIVO_PATAS[pat];
    return base;
  }

  // Clave de un diseño (la tripleta de animales). Acepta una bestia/unidad { cab, tor, pat }.
  function claveDiseno(u) { return u.cab + '-' + u.tor + '-' + u.pat; }

  // Normaliza un nivel: entero entre 1 y nivelMax (cualquier cosa rara vale 1).
  function normalizarNivel(n) {
    n = Math.floor(+n);
    if (!(n >= 1)) return 1;
    return n > BM.REGLAS.nivelMax ? BM.REGLAS.nivelMax : n;
  }

  // Nivel de un diseño dentro de un mapa `niveles` (ausente = 1). `u` es una unidad o una clave.
  function nivelDiseno(niveles, u) {
    var clave = typeof u === 'string' ? u : claveDiseno(u);
    return normalizarNivel(niveles && niveles[clave] ? niveles[clave] : 1);
  }

  function ensamblar(cab, tor, pat, nivel) {
    var A = BM.animalPorId(cab), B = BM.animalPorId(tor), C = BM.animalPorId(pat);
    if (!A || !B || !C) throw new Error('Parte desconocida: ' + cab + '/' + tor + '/' + pat);
    var hab = [];
    if (A.cabeza.habilidad) hab.push(A.cabeza.habilidad);
    if (B.torso.habilidad) hab.push(B.torso.habilidad);
    if (C.patas.habilidad) hab.push(C.patas.habilidad);
    nivel = normalizarNivel(nivel === undefined ? 1 : nivel);
    var R = BM.REGLAS;
    var multVida = R.multVidaNivel[nivel - 1], multDano = R.multDanoNivel[nivel - 1];
    var costo = A.cabeza.costo + B.torso.costo + C.patas.costo;
    var s = {
      cab: cab, tor: tor, pat: pat, nivel: nivel,
      nombre: nombreHibrido(cab, tor, pat),
      costo: costo,
      valor: costo * (1 + R.valorPorNivel * (nivel - 1)),
      vida: Math.round(B.torso.vida * multVida),
      armadura: B.torso.armadura,
      radio: B.torso.radio,
      velocidad: Math.round(C.patas.velocidad * (B.torso.peso || 1)),
      dano: A.cabeza.dano * multDano,
      cadencia: A.cabeza.cadencia,
      alcance: A.cabeza.alcance,
      tamCabeza: A.cabeza.tam,
      habilidades: hab
    };
    s.distancia = s.alcance > 40;
    s.dps = s.dano / s.cadencia + ((cab === 'arana' || cab === 'escorpion') ? 4 : 0);
    return s;
  }

  // Biomasa para subir un diseño de nivelActual a nivelActual+1 (null si ya está al máximo).
  function costoSubirNivel(cab, tor, pat, nivelActual) {
    nivelActual = normalizarNivel(nivelActual === undefined ? 1 : nivelActual);
    if (nivelActual >= BM.REGLAS.nivelMax) return null;
    return ensamblar(cab, tor, pat).costo * BM.REGLAS.multCostoSubirNivel[nivelActual - 1];
  }

  function tiene(stats, habilidad) { return stats.habilidades.indexOf(habilidad) !== -1; }

  BM.ensamblar = ensamblar;
  BM.claveDiseno = claveDiseno;
  BM.normalizarNivel = normalizarNivel;
  BM.nivelDiseno = nivelDiseno;
  BM.costoSubirNivel = costoSubirNivel;
  BM.nombreHibrido = nombreHibrido;
  BM.tieneHabilidad = tiene;
})(typeof window !== 'undefined' ? (window.BM = window.BM || {}) : (globalThis.BM = globalThis.BM || {}));
