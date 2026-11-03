/*
 * BeastMixer — Catálogo de animales (datos puros, Data-Driven Design).
 *
 * Cada animal aporta TRES partes intercambiables: cabeza, torso y patas.
 * Una bestia = cabeza de un animal + torso de otro + patas de otro.
 *
 *   cabeza → cómo ataca (daño por golpe, cadencia, alcance, habilidad ofensiva)
 *   torso  → cuánto aguanta (vida, armadura, tamaño, habilidad defensiva)
 *   patas  → cómo se mueve (velocidad, habilidad de movimiento)
 *
 * Unidades: distancias en px lógicos (celda = 40px), tiempo en segundos.
 * El costo de la bestia es la suma del costo de sus tres partes.
 *
 * Equivalente Godot (PDF): cada parte sería un Resource (.tres) — ParteData —
 * y CriaturaData compondría tres referencias en vez de "base + mutación".
 */
(function (BM) {
  'use strict';

  var ANIMALES = [
    {
      id: 'lobo', nombre: 'Lobo', pre: 'Lo', suf: 'bo',
      color: { base: '#8c8f99', oscuro: '#4d5059', acento: '#e9e4d8' },
      cabeza: { costo: 4, dano: 9, cadencia: 0.7, alcance: 14, tam: 0.9, habilidad: 'manada' },
      torso:  { costo: 4, vida: 110, armadura: 0, radio: 11 },
      patas:  { costo: 3, velocidad: 115 }
    },
    {
      id: 'tortuga', nombre: 'Tortuga', pre: 'Tor', suf: 'tuga',
      color: { base: '#6f8f4e', oscuro: '#3e5a2c', acento: '#c8b67a' },
      cabeza: { costo: 2, dano: 8, cadencia: 1.0, alcance: 12, tam: 0.7 },
      torso:  { costo: 8, vida: 300, armadura: 5, radio: 16, peso: 0.6, habilidad: 'caparazon' },
      patas:  { costo: 1, velocidad: 32 }
    },
    {
      id: 'arana', nombre: 'Araña', pre: 'Ara', suf: 'raña',
      color: { base: '#3a2f45', oscuro: '#1c1524', acento: '#d8433b' },
      cabeza: { costo: 7, dano: 6, cadencia: 1.0, alcance: 150, tam: 0.7, habilidad: 'veneno' },
      torso:  { costo: 2, vida: 70, armadura: 0, radio: 10 },
      patas:  { costo: 3, velocidad: 85 }
    },
    {
      id: 'rino', nombre: 'Rinoceronte', pre: 'Rino', suf: 'ceronte',
      color: { base: '#9a8f86', oscuro: '#5e554e', acento: '#efe6d6' },
      cabeza: { costo: 5, dano: 16, cadencia: 1.3, alcance: 14, tam: 1.0, habilidad: 'carga' },
      torso:  { costo: 6, vida: 230, armadura: 3, radio: 16, peso: 0.85 },
      patas:  { costo: 3, velocidad: 70 }
    },
    {
      id: 'escorpion', nombre: 'Escorpión', pre: 'Escor', suf: 'pión',
      color: { base: '#c98a2e', oscuro: '#7a4c12', acento: '#3b2a12' },
      cabeza: { costo: 5, dano: 9, cadencia: 1.0, alcance: 16, tam: 0.9, habilidad: 'aguijon' },
      torso:  { costo: 5, vida: 140, armadura: 4, radio: 12 },
      patas:  { costo: 2, velocidad: 62 }
    },
    {
      id: 'puercoespin', nombre: 'Puercoespín', pre: 'Puerco', suf: 'espín',
      color: { base: '#7a5b3f', oscuro: '#3f2c1c', acento: '#efe2c8' },
      cabeza: { costo: 2, dano: 8, cadencia: 0.9, alcance: 12, tam: 0.7 },
      torso:  { costo: 5, vida: 180, armadura: 1, radio: 12, habilidad: 'espinas' },
      patas:  { costo: 2, velocidad: 55 }
    },
    {
      id: 'elefante', nombre: 'Elefante', pre: 'Ele', suf: 'fante',
      color: { base: '#8e96a3', oscuro: '#565d69', acento: '#f1ece0' },
      cabeza: { costo: 6, dano: 14, cadencia: 1.5, alcance: 20, tam: 1.2, habilidad: 'trompazo' },
      torso:  { costo: 8, vida: 380, armadura: 2, radio: 20, peso: 0.75 },
      patas:  { costo: 2, velocidad: 45 }
    },
    {
      id: 'rana', nombre: 'Rana', pre: 'Ra', suf: 'nácea',
      color: { base: '#5fae4a', oscuro: '#2f6b25', acento: '#f0d34a' },
      cabeza: { costo: 4, dano: 8, cadencia: 0.9, alcance: 90, tam: 0.9, habilidad: 'lengua' },
      torso:  { costo: 3, vida: 80, armadura: 0, radio: 10, habilidad: 'regenera' },
      patas:  { costo: 3, velocidad: 95, habilidad: 'salto' }
    }
  ];

  // Texto de cada habilidad, como lo lee el jugador.
  var HABILIDADES = {
    manada:    { nombre: 'Manada',     parte: 'cabeza', texto: '+15% de daño por cada aliado con cabeza de lobo cerca (máx. +45%).' },
    veneno:    { nombre: 'Veneno',     parte: 'cabeza', texto: 'Escupe a distancia. Envenena: 4 de daño/s durante 4 s, ignora armadura. Se acumula hasta x4.' },
    carga:     { nombre: 'Carga',      parte: 'cabeza', texto: 'El primer golpe de cada combate hace triple daño.' },
    aguijon:   { nombre: 'Aguijón',    parte: 'cabeza', texto: 'Cada golpe envenena: 4 de daño/s durante 4 s, ignora armadura. Se acumula hasta x4.' },
    trompazo:  { nombre: 'Trompazo',   parte: 'cabeza', texto: 'Golpea en área: los enemigos cercanos al objetivo reciben 50%.' },
    lengua:    { nombre: 'Lengua',     parte: 'cabeza', texto: 'Ataca a media distancia.' },
    caparazon: { nombre: 'Caparazón',  parte: 'torso',  texto: 'Armadura alta: resta 5 a cada golpe recibido.' },
    espinas:   { nombre: 'Espinas',    parte: 'torso',  texto: 'Devuelve 50% del daño cuerpo a cuerpo recibido.' },
    regenera:  { nombre: 'Regenera',   parte: 'torso',  texto: 'Recupera 3 de vida por segundo.' },
    salto:     { nombre: 'Salto',      parte: 'patas',  texto: 'Al empezar el combate salta hacia adelante al triple de velocidad.' }
  };

  // Reglas generales de la partida (economía y daño al jugador).
  var REGLAS = {
    vidaJugador: 100,
    biomasaInicial: 60,       // presupuesto de la ronda 1
    biomasaPorRonda: 40,      // se suma cada ronda (presupuesto acumulado)
    danoBaseDerrota: 8,       // el perdedor de la ronda pierde esto...
    danoPorCosto: 4,          // ...más ceil(costo/4) por cada bestia rival que sobrevive
    duracionMaxCombate: 75,   // segundos simulados antes de declarar empate
    pasoSimulacion: 1 / 30,   // paso fijo => combate reproducible (PvP asíncrono)
    columnas: 12,
    filasZona: 6,             // filas de despliegue por jugador
    filasNeutras: 4,
    celda: 40,
    // ── Niveles por DISEÑO (cab-tor-pat) y veteranía ──────────────────────
    nivelMax: 3,
    multVidaNivel: [1, 1.35, 1.75],     // índice = nivel − 1
    multDanoNivel: [1, 1.25, 1.5],
    valorPorNivel: 0.5,                 // valor = costo × (1 + 0.5 × (nivel − 1)) → daño al jugador
    multCostoSubirNivel: [2, 4],        // índice = nivel actual − 1; × costo base de la bestia
    reembolsoVeterana: 0.5              // reciclar una bestia que sobrevivió de la ronda anterior devuelve el 50%
  };

  function porId(id) {
    for (var i = 0; i < ANIMALES.length; i++) if (ANIMALES[i].id === id) return ANIMALES[i];
    return null;
  }

  BM.ANIMALES = ANIMALES;
  BM.HABILIDADES = HABILIDADES;
  BM.REGLAS = REGLAS;
  BM.animalPorId = porId;
  BM.indiceAnimal = function (id) {
    for (var i = 0; i < ANIMALES.length; i++) if (ANIMALES[i].id === id) return i;
    return -1;
  };
})(typeof window !== 'undefined' ? (window.BM = window.BM || {}) : (globalThis.BM = globalThis.BM || {}));
