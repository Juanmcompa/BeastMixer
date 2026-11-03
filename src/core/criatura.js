/*
 * BeastMixer — Ensamblaje de bestias.
 *
 * ensamblar(cabeza, torso, patas) compone las estadísticas finales a partir
 * de las tres partes. Es una función pura: no guarda estado, no muta los datos
 * del catálogo (equivale al duplicate(true) del PDF: nunca se toca la plantilla).
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

  function ensamblar(cab, tor, pat) {
    var A = BM.animalPorId(cab), B = BM.animalPorId(tor), C = BM.animalPorId(pat);
    if (!A || !B || !C) throw new Error('Parte desconocida: ' + cab + '/' + tor + '/' + pat);
    var hab = [];
    if (A.cabeza.habilidad) hab.push(A.cabeza.habilidad);
    if (B.torso.habilidad) hab.push(B.torso.habilidad);
    if (C.patas.habilidad) hab.push(C.patas.habilidad);
    var s = {
      cab: cab, tor: tor, pat: pat,
      nombre: nombreHibrido(cab, tor, pat),
      costo: A.cabeza.costo + B.torso.costo + C.patas.costo,
      vida: B.torso.vida,
      armadura: B.torso.armadura,
      radio: B.torso.radio,
      velocidad: Math.round(C.patas.velocidad * (B.torso.peso || 1)),
      dano: A.cabeza.dano,
      cadencia: A.cabeza.cadencia,
      alcance: A.cabeza.alcance,
      tamCabeza: A.cabeza.tam,
      habilidades: hab
    };
    s.distancia = s.alcance > 40;
    s.dps = s.dano / s.cadencia + ((cab === 'arana' || cab === 'escorpion') ? 4 : 0);
    return s;
  }

  function tiene(stats, habilidad) { return stats.habilidades.indexOf(habilidad) !== -1; }

  BM.ensamblar = ensamblar;
  BM.nombreHibrido = nombreHibrido;
  BM.tieneHabilidad = tiene;
})(typeof window !== 'undefined' ? (window.BM = window.BM || {}) : (globalThis.BM = globalThis.BM || {}));
