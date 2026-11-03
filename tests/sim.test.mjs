// Tests de la simulación (sin navegador): node tests/sim.test.mjs
// Verifica determinismo, codificación de ejércitos/duelos y un balance básico.
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

let fallas = 0;
function ok(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { console.log('  ✗ ' + msg); fallas++; }
}

function fila(cab, tor, pat, n, prof = 0) {
  const ej = [];
  for (let i = 0; i < n; i++) ej.push({ cab, tor, pat, col: i % 12, prof: prof + Math.floor(i / 12) });
  return ej;
}

console.log('Ensamblaje');
const h = BM.ensamblar('arana', 'tortuga', 'rana');
ok(h.nombre === 'Aratuga saltarín', 'nombre híbrido: ' + h.nombre);
ok(h.costo === 7 + 8 + 3, 'costo = suma de partes (' + h.costo + ')');
ok(h.habilidades.join() === 'veneno,caparazon,salto', 'habilidades de cada parte');
ok(BM.ensamblar('lobo', 'lobo', 'lobo').nombre === 'Lobo', 'animal puro conserva su nombre');

console.log('Determinismo');
const A = BM.generarEjercitoIA([], [], 4, 11);
const B = BM.generarEjercitoIA([], [], 4, 22);
const r1 = BM.resolverCombate(A, B, 1234);
const r2 = BM.resolverCombate(A, B, 1234);
ok(r1.huella === r2.huella && r1.pasos === r2.pasos, 'mismo combate, mismo resultado (' + r1.huella + ')');
ok(A.length > 3 && B.length > 3, 'la IA arma ejércitos (' + A.length + ' vs ' + B.length + ')');
ok(BM.costoEjercito(A) <= BM.presupuesto(4), 'la IA respeta el presupuesto');

console.log('Codificación');
const cod = BM.codificarEjercito(A);
const dec = BM.decodificarEjercito(cod);
ok(JSON.stringify(dec) === JSON.stringify(A), 'ejército ida y vuelta (' + cod.length + ' chars)');
const d = BM.nuevoDuelo('Juanma');
d.n[1] = 'Gonza';
d.e[0].push(BM.codificarEjercito(fila('lobo', 'lobo', 'lobo', 5)));
d.e[1].push(BM.codificarEjercito(fila('tortuga', 'tortuga', 'tortuga', 4)));
const d2 = BM.decodificarDuelo(BM.codificarDuelo(d));
ok(d2 && d2.n[1] === 'Gonza' && d2.e[1][0] === d.e[1][0], 'duelo ida y vuelta por link');
const est = BM.estadoDuelo(d2);
ok(est.rondasResueltas === 1 && est.turno === 0, 'estado del duelo: 1 ronda resuelta, turno de A');

console.log('Balance (piedra-papel-tijera)');
function gana(ejA, ejB) {
  let wins = 0;
  for (let s = 1; s <= 6; s++) {
    const r = BM.resolverCombate(ejA, ejB, s * 97);
    if (r.ganador === 0) wins++;
  }
  // y con los lados invertidos
  for (let s = 1; s <= 6; s++) {
    const r = BM.resolverCombate(ejB, ejA, s * 89);
    if (r.ganador === 1) wins++;
  }
  return wins / 12;
}
// Mismo presupuesto (ronda 2 = 100 de biomasa), animales puros
function puro(id, prof = 0) {
  const n = Math.floor(BM.presupuesto(2) / BM.ensamblar(id, id, id).costo);
  return fila(id, id, id, n, prof);
}
const lobos = puro('lobo'), tortugas = puro('tortuga'), aranas = puro('arana', 4);
const t1 = gana(tortugas, lobos), t2 = gana(aranas, tortugas), t3 = gana(lobos, aranas);
console.log(`    tortugas vs lobos ${t1}, arañas vs tortugas ${t2}, lobos vs arañas ${t3}`);
ok(t1 >= 0.5, 'las tortugas aguantan a los lobos');
ok(t2 >= 0.5, 'el veneno de araña vence a las tortugas');
ok(t3 >= 0.5, 'los lobos rápidos cazan a las arañas');

console.log('Partida completa IA vs IA');
let vida = [100, 100], prevA = [], prevB = [], ronda = 1;
while (vida[0] > 0 && vida[1] > 0 && ronda <= 20) {
  const ea = BM.generarEjercitoIA(prevA, prevB, ronda, 100 + ronda);
  const eb = BM.generarEjercitoIA(prevB, prevA, ronda, 200 + ronda);
  const r = BM.resolverCombate(ea, eb, ronda);
  vida = [vida[0] - r.dano[0], vida[1] - r.dano[1]];
  console.log(`    ronda ${ronda}: ${ea.length} vs ${eb.length} bestias, ganador ${r.ganador}, ${r.tiempo.toFixed(1)}s, vida ${vida}`);
  prevA = ea; prevB = eb; ronda++;
}
ok(ronda - 1 >= 4 && ronda - 1 <= 14, 'la partida dura entre 4 y 14 rondas (' + (ronda - 1) + ')');

console.log(fallas ? `\n${fallas} test(s) fallaron` : '\nTodo OK');
process.exit(fallas ? 1 : 0);
