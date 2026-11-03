// Tests de la IA con dificultades (BM.pensarIA): validez, escalera de fuerza y tiempos.
// node tests/ia.test.mjs   (sin navegador; mismo patrón de carga que sim.test.mjs)
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
globalThis.BM = {};
for (const f of ['src/data/animales.js', 'src/core/base.js', 'src/core/criatura.js',
  'src/core/simulacion.js', 'src/core/partida.js', 'src/core/ia.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(raiz, f), 'utf8'), { filename: f });
}
const BM = globalThis.BM;
const R = BM.REGLAS;

let fallas = 0;
function ok(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { console.log('  ✗ ' + msg); fallas++; }
}

const IDS = ['aprendiz', 'rival', 'experto', 'pesadilla'];

// Valida una decisión de la IA contra las reglas. Devuelve un texto de error o null.
function problema(op, r) {
  const celdas = new Set();
  for (const u of r.ej) {
    if (!BM.animalPorId(u.cab) || !BM.animalPorId(u.tor) || !BM.animalPorId(u.pat)) return 'parte desconocida';
    if (!Number.isInteger(u.col) || !Number.isInteger(u.prof) || u.col < 0 || u.col >= R.columnas || u.prof < 0 || u.prof >= R.filasZona) return 'celda fuera de rango';
    const k = u.col * 10 + u.prof;
    if (celdas.has(k)) return 'celda repetida';
    celdas.add(k);
  }
  for (const k of Object.keys(op.nivPrevio)) if (BM.nivelDiseno(r.niv, k) < BM.nivelDiseno(op.nivPrevio, k)) return 'nivel bajó en ' + k;
  for (const k of Object.keys(r.niv)) if (r.niv[k] < 1 || r.niv[k] > R.nivelMax) return 'nivel fuera de rango';
  const libre = BM.biomasaLibre(op.libreAnterior, op.ronda, op.ejPrevio, op.nivPrevio, r.ej, r.niv);
  if (libre < 0) return 'biomasa negativa (' + libre + ')';
  return null;
}

// Juega una partida completa entre dos dificultades. `lado` = bando de `a` (0 o 1).
async function partida(a, b, semilla, lado, opciones = {}) {
  const dif = lado === 0 ? [a, b] : [b, a];
  const st = [0, 1].map(() => ({ ej: [], niv: {}, libre: 0, mem: undefined }));
  const vida = [R.vidaJugador, R.vidaJugador];
  let ronda = 0;
  const maxR = opciones.maxRondas || 15;
  while (vida[0] > 0 && vida[1] > 0 && ronda < maxR) {
    ronda++;
    const nuevos = [];
    for (let s = 0; s < 2; s++) {
      const rival = st[1 - s];
      const op = { dificultad: dif[s], ronda, semilla: semilla * 1000 + ronda * 10 + s,
        ejPrevio: st[s].ej, nivPrevio: st[s].niv, libreAnterior: st[s].libre,
        ejVisto: rival.ej, nivVisto: rival.niv, memoria: st[s].mem, tiempoMax: opciones.tiempoMax };
      const r = await BM.pensarIA(op);
      const p = problema(op, r);
      if (p) throw new Error(dif[s] + ' ronda ' + ronda + ': ' + p);
      nuevos.push({ ej: r.ej, niv: r.niv, libre: BM.biomasaLibre(st[s].libre, ronda, st[s].ej, st[s].niv, r.ej, r.niv), mem: r.memoria });
    }
    for (let s = 0; s < 2; s++) Object.assign(st[s], nuevos[s]);
    const res = BM.resolverCombate(st[0].ej, st[1].ej, BM.semillaRonda(semilla, ronda), st[0].niv, st[1].niv);
    vida[0] = Math.max(0, vida[0] - res.dano[0]);
    vida[1] = Math.max(0, vida[1] - res.dano[1]);
  }
  // 1 = ganó `a`, 0 = ganó `b`, 0.5 = empate / sin definir
  const va = vida[lado], vb = vida[1 - lado];
  return { puntos: va === vb ? 0.5 : (va > vb ? 1 : 0), rondas: ronda };
}

async function escalera(a, b, partidas, minimo) {
  let pts = 0, rondas = 0;
  const t0 = Date.now();
  for (let g = 0; g < partidas; g++) {
    const r = await partida(a, b, 1000 + g * 37, g % 2, { tiempoMax: Infinity });
    pts += r.puntos; rondas += r.rondas;
  }
  const tasa = pts / partidas;
  const txt = a + ' vs ' + b + ': ' + pts + '/' + partidas + ' (' + Math.round(tasa * 100) + '%), ' +
    (rondas / partidas).toFixed(1) + ' rondas por partida, ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s';
  if (minimo !== undefined) ok(tasa >= minimo, txt + ' — mínimo ' + Math.round(minimo * 100) + '%');
  else console.log('  · ' + txt);
}

console.log('Dificultades');
ok(BM.DIFICULTADES.map(d => d.id).join() === IDS.join(), 'cuatro dificultades en orden: ' + IDS.join(', '));
ok(BM.DIFICULTADES.every(d => d.nombre && d.texto), 'cada una tiene nombre y texto');

console.log('Compatibilidad: generarEjercitoIA');
{
  const a = BM.generarEjercitoIA([], [], 4, 11), b = BM.generarEjercitoIA([], [], 4, 11);
  ok(JSON.stringify(a) === JSON.stringify(b) && a.length > 0, 'determinista y no vacía');
  const r = await BM.pensarIA({ dificultad: 'aprendiz', ronda: 4, semilla: 11, ejPrevio: [], nivPrevio: {}, libreAnterior: 0, ejVisto: [], nivVisto: {} });
  ok(r.ej.length > 0 && problema({ ronda: 4, ejPrevio: [], nivPrevio: {}, libreAnterior: 0 }, r) === null, 'aprendiz vía pensarIA devuelve un ejército válido');
}

console.log('Validez en una partida de 8 rondas (con los topes de tiempo reales)');
for (const dif of IDS) {
  let error = null, maxMs = 0, unidades = 0, mejoras = 0;
  const st = { ej: [], niv: {}, libre: 0, mem: undefined }, vis = { ej: [], niv: {}, libre: 0 };
  for (let ronda = 1; ronda <= 8 && !error; ronda++) {
    const op = { dificultad: dif, ronda, semilla: 77 + ronda, ejPrevio: st.ej, nivPrevio: st.niv, libreAnterior: st.libre,
      ejVisto: vis.ej, nivVisto: vis.niv, memoria: st.mem };
    const r = await BM.pensarIA(op);
    error = problema(op, r);
    maxMs = Math.max(maxMs, r.info.ms);
    st.libre = BM.biomasaLibre(st.libre, ronda, st.ej, st.niv, r.ej, r.niv);
    st.ej = r.ej; st.niv = r.niv; st.mem = r.memoria; unidades = r.ej.length;
    mejoras = Object.values(r.niv).filter(n => n > 1).length;
    // el "jugador" de prueba es una IA aprendiz: su ejército de esta ronda se verá en la siguiente
    const j = await BM.pensarIA({ dificultad: 'aprendiz', ronda, semilla: 5 + ronda, ejPrevio: vis.ej, nivPrevio: vis.niv, libreAnterior: vis.libre, ejVisto: [], nivVisto: {} });
    vis.libre = BM.biomasaLibre(vis.libre, ronda, vis.ej, vis.niv, j.ej, j.niv); vis.ej = j.ej; vis.niv = j.niv;
  }
  ok(!error, dif + ': 8 rondas válidas (celdas, biomasa ≥ 0, niveles) — ' + unidades + ' bestias al final, ' + mejoras + ' diseños mejorados, máx ' + maxMs + ' ms' + (error ? ' — ' + error : ''));
}

console.log('Reproducibilidad (sin tope de tiempo)');
for (const dif of ['rival', 'experto', 'pesadilla']) {
  const op = () => ({ dificultad: dif, ronda: 3, semilla: 99, ejPrevio: BM.generarEjercitoIA([], [], 2, 5), nivPrevio: {}, libreAnterior: 4,
    ejVisto: BM.generarEjercitoIA([], [], 2, 6), nivVisto: {}, tiempoMax: Infinity });
  const x = await BM.pensarIA(op()), y = await BM.pensarIA(op());
  ok(JSON.stringify(x.ej) === JSON.stringify(y.ej) && JSON.stringify(x.niv) === JSON.stringify(y.niv), dif + ': mismo pedido, mismo ejército');
}

console.log('Justicia: la IA sólo ve ejVisto');
{
  const base = { dificultad: 'experto', ronda: 2, semilla: 3, ejPrevio: [], nivPrevio: {}, libreAnterior: 0, ejVisto: BM.generarEjercitoIA([], [], 1, 8), nivVisto: {}, tiempoMax: Infinity };
  const x = await BM.pensarIA(base);
  const y = await BM.pensarIA(Object.assign({}, base, { jugadorActual: BM.generarEjercitoIA([], [], 2, 1234) }));
  ok(JSON.stringify(x.ej) === JSON.stringify(y.ej), 'datos extra del jugador no cambian la decisión');
}

console.log('Progreso y cesión del hilo');
{
  let llamadas = 0, ultimo = -1, creciente = true;
  let ticks = 0, vivo = true;
  const timer = setInterval(() => { if (vivo) ticks++; }, 1);
  await BM.pensarIA({ dificultad: 'rival', ronda: 4, semilla: 1, ejPrevio: BM.generarEjercitoIA([], [], 3, 1), nivPrevio: {}, libreAnterior: 40,
    ejVisto: BM.generarEjercitoIA([], [], 3, 2), nivVisto: {}, alProgreso: f => { llamadas++; if (f < ultimo - 1e-9) creciente = false; ultimo = f; } });
  vivo = false; clearInterval(timer);
  ok(llamadas >= 2 && ultimo === 1 && creciente, 'alProgreso se llama (' + llamadas + ' veces), crece y termina en 1');
  ok(ticks > 0, 'la IA cede el hilo entre rebanadas (timers atendidos: ' + ticks + ')');
}

console.log('Escalera de fuerza (partidas completas, hasta 15 rondas, lados alternados)');
await escalera('rival', 'aprendiz', 6, 0.55);
await escalera('experto', 'aprendiz', 6, 0.65);
await escalera('pesadilla', 'aprendiz', 4, 0.65);
await escalera('experto', 'rival', 4);
await escalera('pesadilla', 'experto', 2);

console.log('Tiempo por decisión en ronda tardía (ronda 8, ~22 bestias por lado)');
{
  let ejA = [], ejB = [], libA = 0, libB = 0;
  for (let r = 1; r < 8; r++) {
    const a = await BM.pensarIA({ dificultad: 'aprendiz', ronda: r, semilla: r * 3 + 1, ejPrevio: ejA, nivPrevio: {}, libreAnterior: libA, ejVisto: ejB, nivVisto: {} });
    const b = await BM.pensarIA({ dificultad: 'aprendiz', ronda: r, semilla: r * 7 + 2, ejPrevio: ejB, nivPrevio: {}, libreAnterior: libB, ejVisto: ejA, nivVisto: {} });
    libA = BM.biomasaLibre(libA, r, ejA, {}, a.ej, a.niv); libB = BM.biomasaLibre(libB, r, ejB, {}, b.ej, b.niv);
    ejA = a.ej; ejB = b.ej;
  }
  const topes = { aprendiz: 50, rival: 1000, experto: 2200, pesadilla: 3500 };
  for (const dif of IDS) {
    const ms = [];
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      await BM.pensarIA({ dificultad: dif, ronda: 8, semilla: 40 + i, ejPrevio: ejA, nivPrevio: {}, libreAnterior: libA, ejVisto: ejB, nivVisto: {} });
      ms.push(Date.now() - t0);
    }
    const prom = ms.reduce((p, c) => p + c, 0) / ms.length;
    ok(prom <= topes[dif], dif + ': ' + Math.round(prom) + ' ms por decisión (' + ms.join(', ') + '), límite ' + topes[dif] + ' ms');
  }
}

console.log(fallas ? '\n' + fallas + ' FALLAS' : '\nTodo OK');
process.exit(fallas ? 1 : 0);
