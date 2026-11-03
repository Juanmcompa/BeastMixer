/*
 * BeastMixer — utilidades base: bus de señales (Signal Bus) y RNG con semilla.
 *
 * SignalBus: equivalente del Autoload SignalBus.gd del PDF. La interfaz se
 * suscribe a eventos y nunca llama directamente a la lógica (y viceversa).
 *
 * RNG: mulberry32. Todo lo aleatorio de la simulación sale de acá, con semilla,
 * para que el mismo combate dé SIEMPRE el mismo resultado en cualquier navegador.
 */
(function (BM) {
  'use strict';

  function crearBus() {
    var oyentes = {};
    return {
      on: function (evento, fn) {
        (oyentes[evento] = oyentes[evento] || []).push(fn);
        return function () {
          oyentes[evento] = (oyentes[evento] || []).filter(function (f) { return f !== fn; });
        };
      },
      emit: function (evento, datos) {
        var lista = (oyentes[evento] || []).slice();
        for (var i = 0; i < lista.length; i++) lista[i](datos);
      }
    };
  }

  function crearRng(semilla) {
    var a = (semilla >>> 0) || 1;
    function rng() {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    rng.entero = function (min, max) { return min + Math.floor(rng() * (max - min + 1)); };
    rng.elegir = function (lista) { return lista[Math.floor(rng() * lista.length)]; };
    return rng;
  }

  BM.bus = crearBus();
  BM.crearBus = crearBus;
  BM.crearRng = crearRng;
})(typeof window !== 'undefined' ? (window.BM = window.BM || {}) : (globalThis.BM = globalThis.BM || {}));
