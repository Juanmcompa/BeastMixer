// Tests de niveles por diseño, economía (libro de biomasa) y duelo con niveles.
// node tests/economia.test.mjs   (sin navegador; mismo patrón de carga que sim.test.mjs)
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
function igual(a, b, msg) {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  ok(sa === sb, msg + (sa === sb ? '' : '  (obtenido ' + sa + ', esperado ' + sb + ')'));
}

function fila(cab, tor, pat, n, prof = 0, col0 = 0) {
  const ej = [];
  for (let i = 0; i < n; i++) ej.push({ cab, tor, pat, col: (col0 + i) % 12, prof: prof + Math.floor((col0 + i) / 12) });
  return ej;
}
const k = (c, t, p) => c + '-' + t + '-' + p;

// ── Batallas fijas sin niveles: las huellas se calcularon con el código BASE (antes de los niveles).
const IA_A = BM.generarEjercitoIA([], [], 4, 11);
const IA_B = BM.generarEjercitoIA([], [], 4, 22);
const BATALLAS = [
  { nombre: '5 lobos vs 4 tortugas', a: fila('lobo', 'lobo', 'lobo', 5), b: fila('tortuga', 'tortuga', 'tortuga', 4), semilla: 1234 },
  { nombre: 'arañas vs tortugas', a: fila('arana', 'arana', 'arana', 8, 4), b: fila('tortuga', 'tortuga', 'tortuga', 6), semilla: 97 },
  { nombre: 'IA ronda 4 vs IA ronda 4', a: IA_A, b: IA_B, semilla: 1234 },
  { nombre: 'elefantes vs mezcla', a: fila('elefante', 'elefante', 'rino', 3), b: fila('escorpion', 'puercoespin', 'rana', 5), semilla: 7 },
  { nombre: 'ranas lobo vs rinos', a: fila('rana', 'lobo', 'rana', 6, 3), b: fila('rino', 'rino', 'lobo', 6), semilla: 99 },
  { nombre: 'ejército vacío vs lobos', a: [], b: fila('lobo', 'lobo', 'lobo', 2), semilla: 5 }
];
const ESPERADO = {
  // (generadas con GENERAR_HUELLAS=1 sobre el commit base, antes de agregar niveles)
  '5 lobos vs 4 tortugas': { huella: 'c0f2b29c', pasos: 965, ganador: 1, dano: [14, 0] },
  'arañas vs tortugas': { huella: 'b5e67230', pasos: 1624, ganador: 0, dano: [0, 29] },
  'IA ronda 4 vs IA ronda 4': { huella: 'dd7ec750', pasos: 1082, ganador: 0, dano: [0, 24] },
  'elefantes vs mezcla': { huella: '71e1fb64', pasos: 587, ganador: 1, dano: [16, 0] },
  'ranas lobo vs rinos': { huella: '2693cf4f', pasos: 334, ganador: 1, dano: [32, 0] },
  'ejército vacío vs lobos': { huella: 'f10a5d0d', pasos: 1, ganador: 1, dano: [14, 0] }
};

if (process.env.GENERAR_HUELLAS) {
  const out = {};
  for (const b of BATALLAS) {
    const r = BM.resolverCombate(b.a, b.b, b.semilla);
    out[b.nombre] = { huella: r.huella, pasos: r.pasos, ganador: r.ganador, dano: r.dano };
  }
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

console.log('Huellas sin niveles (idénticas al código anterior)');
for (const b of BATALLAS) {
  const e = ESPERADO[b.nombre];
  const r = BM.resolverCombate(b.a, b.b, b.semilla);
  const r2 = BM.resolverCombate(b.a, b.b, b.semilla, {}, {});
  const r3 = BM.resolverCombate(b.a, b.b, b.semilla, undefined, null);
  igual({ huella: r.huella, pasos: r.pasos, ganador: r.ganador, dano: r.dano }, e, b.nombre);
  ok(r2.huella === e.huella && r3.huella === e.huella, '  con mapas de niveles vacíos/nulos: misma huella');
}

console.log('Ensamblar con niveles');
const base = BM.ensamblar('elefante', 'tortuga', 'lobo');
const n1 = BM.ensamblar('elefante', 'tortuga', 'lobo', 1);
const n2 = BM.ensamblar('elefante', 'tortuga', 'lobo', 2);
const n3 = BM.ensamblar('elefante', 'tortuga', 'lobo', 3);
ok(base.nivel === 1 && JSON.stringify(base) === JSON.stringify(n1), 'nivel por defecto = 1');
ok(n2.vida === Math.round(300 * 1.35) && n2.dano === 14 * 1.25, 'nivel 2: vida ×1.35 (' + n2.vida + '), daño ×1.25 (' + n2.dano + ')');
ok(n3.vida === Math.round(300 * 1.75) && n3.dano === 14 * 1.5, 'nivel 3: vida ×1.75 (' + n3.vida + '), daño ×1.5 (' + n3.dano + ')');
ok(Number.isInteger(n2.vida) && Number.isInteger(n3.vida), 'la vida es entera');
ok(n3.costo === base.costo && n2.costo === base.costo, 's.costo es el costo base (' + base.costo + ')');
ok(base.valor === base.costo && n2.valor === base.costo * 1.5 && n3.valor === base.costo * 2, 's.valor = costo × (1 + 0.5 × (nivel − 1))');
ok(n3.armadura === base.armadura && n3.velocidad === base.velocidad && n3.cadencia === base.cadencia, 'armadura, velocidad y cadencia no cambian');
ok(BM.ensamblar('lobo', 'lobo', 'lobo', 9).nivel === 3 && BM.ensamblar('lobo', 'lobo', 'lobo', 0).nivel === 1, 'niveles fuera de rango se acotan');
ok(BM.claveDiseno({ cab: 'lobo', tor: 'rino', pat: 'rana', col: 1, prof: 2 }) === 'lobo-rino-rana', 'claveDiseno');

console.log('Costo de subir de nivel');
const costoLR = BM.ensamblar('lobo', 'rino', 'rana').costo; // 4+6+3 = 13
ok(BM.costoSubirNivel('lobo', 'rino', 'rana', 1) === 2 * costoLR, '1→2 = 2×costo (' + 2 * costoLR + ')');
ok(BM.costoSubirNivel('lobo', 'rino', 'rana', 2) === 4 * costoLR, '2→3 = 4×costo (' + 4 * costoLR + ')');
ok(BM.costoSubirNivel('lobo', 'rino', 'rana', 3) === null, 'nivel máximo → null');

console.log('Balance de ronda');
const lobo = (n, prof = 0, col0 = 0) => fila('lobo', 'lobo', 'lobo', n, prof, col0); // costo 11
const CL = BM.ensamblar('lobo', 'lobo', 'lobo').costo;
const KL = k('lobo', 'lobo', 'lobo');
let b = BM.balanceRonda([], {}, lobo(3), {});
igual([b.compras, b.reembolsos, b.mejoras, b.neto], [3 * CL, 0, 0, -3 * CL], 'comprar 3 lobos');
b = BM.balanceRonda(lobo(3), {}, lobo(3, 1), {});
igual([b.compras, b.reembolsos, b.mejoras, b.neto], [0, 0, 0, 0], 'mover bestias es gratis');
b = BM.balanceRonda(lobo(3), {}, lobo(1), {});
igual([b.compras, b.reembolsos, b.neto], [0, 2 * Math.floor(CL / 2), 2 * Math.floor(CL / 2)], 'reciclar 2 veteranas devuelve 50% (floor)');
b = BM.balanceRonda(lobo(3), {}, lobo(4), {});
igual([b.compras, b.reembolsos], [CL, 0], 'comprar 1 más');
// comprar 2 y reciclar 1 de las compradas esta ronda = reembolso completo (neto de copias)
b = BM.balanceRonda(lobo(3), {}, lobo(4), {});
igual(b.neto, -CL, 'comprar 2 y reciclar 1 de las nuevas = comprar sólo 1 (reembolso completo)');
// reciclar una veterana y comprar otra del mismo diseño = no hace nada
b = BM.balanceRonda(lobo(3), {}, lobo(3, 2), {});
igual(b.neto, 0, 'reciclar una veterana y recomprar el mismo diseño: neto 0');
// diseños distintos: reciclar veterana de lobo (50%) y comprar tortuga (100%)
const mezcla = [...lobo(2), ...fila('tortuga', 'tortuga', 'tortuga', 1, 2)];
b = BM.balanceRonda(lobo(3), {}, mezcla, {});
const CT = BM.ensamblar('tortuga', 'tortuga', 'tortuga').costo;
igual([b.compras, b.reembolsos, b.neto], [CT, Math.floor(CL / 2), Math.floor(CL / 2) - CT], 'reciclar un lobo veterano y comprar una tortuga');
// mejoras
b = BM.balanceRonda(lobo(3), {}, lobo(3), { [KL]: 3 });
igual([b.mejoras, b.neto, b.invalido], [6 * CL, -6 * CL, false], 'mejorar 1→3 cuesta 2×costo + 4×costo');
b = BM.balanceRonda(lobo(3), { [KL]: 2 }, lobo(3), { [KL]: 3 });
igual(b.mejoras, 4 * CL, 'mejorar 2→3 cuesta 4×costo');
b = BM.balanceRonda(lobo(3), { [KL]: 2 }, lobo(3), { [KL]: 2 });
igual(b.mejoras, 0, 'sin cambios de nivel no cuesta');
b = BM.balanceRonda(lobo(3), { [KL]: 2 }, lobo(3), {});
ok(b.invalido === true && b.mejoras === 0, 'los niveles no pueden bajar (inválido)');
// mejorar no depende de cuántas copias haya
b = BM.balanceRonda([], {}, lobo(10), { [KL]: 2 });
igual([b.compras, b.mejoras], [10 * CL, 2 * CL], 'mejorar cuesta lo mismo con 1 o 10 copias');

console.log('Ingreso y biomasa libre');
ok(BM.ingresoRonda(1) === 60 && BM.ingresoRonda(2) === 40 && BM.ingresoRonda(7) === 40, 'ingreso: 60 la ronda 1, 40 las demás');
ok(BM.biomasaLibre(0, 1, [], {}, lobo(3), {}) === 60 - 3 * CL, 'biomasaLibre ronda 1 = 60 − compras (' + (60 - 3 * CL) + ')');
ok(BM.biomasaLibre(27, 2, lobo(3), {}, lobo(3), {}) === 67, 'biomasaLibre ronda 2 arrastra lo no gastado (27 + 40)');
ok(BM.presupuesto(3) === 140 && BM.costoEjercito(lobo(3)) === 3 * CL, 'presupuesto() y costoEjercito() siguen funcionando');

console.log('Historial de biomasa');
let h = BM.historialBiomasa([
  { ej: lobo(3), niv: {} },                       // 60 − 33 = 27
  { ej: lobo(3), niv: {} },                       // 27 + 40 = 67 (no gasta)
  { ej: lobo(3), niv: { [KL]: 2 } }               // 67 + 40 − 22 = 85
]);
igual(h.libre, [27, 67, 85], 'arrastre de biomasa entre rondas');
ok(h.invalido === false && h.primeraInvalida === null, 'historial válido');
h = BM.historialBiomasa([
  { ej: lobo(5), niv: {} },                       // 60 − 55 = 5
  { ej: lobo(5), niv: { [KL]: 3 } }               // 5 + 40 − 66 = −21
]);
igual(h.libre, [5, -21], 'detecta biomasa negativa');
ok(h.invalido === true && h.primeraInvalida === 2, 'marca invalido y la ronda (2)');
h = BM.historialBiomasa([{ ej: lobo(6), niv: {} }]); // 60 − 66 = −6
ok(h.invalido && h.primeraInvalida === 1, 'gastar de más en la ronda 1 es inválido');
h = BM.historialBiomasa([{ ej: lobo(4), niv: {} }, { ej: lobo(1), niv: {} }]); // 16, 16+40+3*5=71
igual(h.libre, [16, 71], 'reciclar veteranas devuelve el 50% en el historial');
igual(BM.historialBiomasa([]).libre, [], 'historial vacío');

console.log('Veteranía y reembolso al reciclar');
const prev = lobo(3);
const act = lobo(5);   // 2 lobos comprados esta ronda
ok(BM.reembolsoAlReciclar(prev, act, act[0]) === CL, 'con copias nuevas, reciclar devuelve 100% (' + CL + ')');
ok(BM.esVeterana(prev, act, act[0]) === false, 'hay compras nuevas del diseño: no es veterana');
ok(BM.reembolsoAlReciclar(prev, prev, prev[0]) === Math.floor(CL / 2), 'sin copias nuevas, devuelve floor(50%) (' + Math.floor(CL / 2) + ')');
ok(BM.esVeterana(prev, prev, prev[0]) === true, 'esVeterana');
ok(BM.esVeterana([], lobo(1), lobo(1)[0]) === false, 'ronda 1: nada es veterana');

console.log('Codificación de rondas');
const ejR = [...lobo(3), ...fila('arana', 'tortuga', 'rana', 2, 3)];
const nivR = { [KL]: 2, [k('arana', 'tortuga', 'rana')]: 3, [k('rino', 'rino', 'rino')]: 1 };
const sR = BM.codificarRonda(ejR, nivR);
const dR = BM.decodificarRonda(sR);
igual(dR.ej, ejR, 'ejército ida y vuelta');
igual(dR.niv, { [k('arana', 'tortuga', 'rana')]: 3, [KL]: 2 }, 'niveles ida y vuelta (nivel 1 no se guarda)');
ok(sR.indexOf('~') === ejR.length * 5, 'formato: ejército + ~ + niveles (' + sR + ')');
ok(sR.length === ejR.length * 5 + 1 + 2 * 4, '4 caracteres por diseño con nivel ≥ 2');
ok(BM.codificarRonda(ejR, {}) === BM.codificarEjercito(ejR) && BM.codificarRonda(ejR) === BM.codificarEjercito(ejR), 'sin niveles no hay "~" (idéntico al formato viejo)');
const viejo = BM.codificarEjercito(ejR);
igual(BM.decodificarRonda(viejo), { ej: ejR, niv: {} }, 'formato viejo se decodifica con niv = {}');
igual(BM.decodificarRonda(''), { ej: [], niv: {} }, 'string vacío');
igual(BM.decodificarRonda('~0003'), { ej: [], niv: { 'lobo-lobo-lobo': 3 } }, 'sólo niveles (sin ejército)');
igual(BM.decodificarEjercito(sR), ejR, 'decodificarEjercito ignora la parte de niveles');

console.log('Duelo con niveles');
const d = BM.nuevoDuelo('Ana'); d.n[1] = 'Beto';
const nivA = { [KL]: 2 };
d.e[0].push(BM.codificarRonda(lobo(4), nivA));              // 60 − 44 − 22 = −6 → inválido en ronda 1
d.e[1].push(BM.codificarRonda(fila('tortuga', 'tortuga', 'tortuga', 4), {}));
const link = BM.codificarDuelo(d);
const d2 = BM.decodificarDuelo(link);
ok(d2 && d2.e[0][0].indexOf('~') > 0, 'la "~" sobrevive al link base64url');
igual(BM.ejercitoDuelo(d2, 0, 1), lobo(4), 'ejercitoDuelo devuelve sólo el ejército');
igual(BM.nivelesDuelo(d2, 0, 1), nivA, 'nivelesDuelo(A, ronda 1)');
igual(BM.nivelesDuelo(d2, 1, 1), {}, 'nivelesDuelo de un jugador sin niveles');
igual(BM.nivelesDuelo(d2, 0, 5), {}, 'nivelesDuelo de una ronda inexistente');
let est = BM.estadoDuelo(d2);
const esp = BM.resolverCombate(lobo(4), fila('tortuga', 'tortuga', 'tortuga', 4), BM.semillaRonda(d.s, 1), nivA, {});
ok(est.rondasResueltas === 1 && est.historial[0].dano[0] === esp.dano[0] && est.historial[0].dano[1] === esp.dano[1], 'estadoDuelo resuelve con los niveles de ambos');
const sinNiv = BM.resolverCombate(lobo(4), fila('tortuga', 'tortuga', 'tortuga', 4), BM.semillaRonda(d.s, 1));
ok(esp.huella !== sinNiv.huella, 'los niveles cambian el combate respecto de ignorarlos');
igual(est.invalido, [1, null], 'A gastó de más: est.invalido = [1, null]');
ok(est.hayInvalido === true, 'est.hayInvalido');
igual(est.biomasa, [[-6], [60 - 4 * CT]], 'est.biomasa por jugador');
igual(est.libre, [-6, 60 - 4 * CT], 'est.libre = biomasa al cerrar la última ronda enviada');
// duelo válido de 2 rondas con mejora en la 2
const dv = BM.nuevoDuelo('Ana'); dv.n[1] = 'Beto';
dv.e[0].push(BM.codificarRonda(lobo(5), {}));                              // 5
dv.e[0].push(BM.codificarRonda(lobo(5), { [KL]: 2 }));                     // 5+40−22 = 23
dv.e[1].push(BM.codificarRonda(fila('tortuga', 'tortuga', 'tortuga', 4), {}));
dv.e[1].push(BM.codificarRonda(fila('tortuga', 'tortuga', 'tortuga', 4), {}));
est = BM.estadoDuelo(BM.decodificarDuelo(BM.codificarDuelo(dv)));
igual(est.biomasa[0], [5, 23], 'biomasa de A con mejora en ronda 2');
ok(!est.hayInvalido && est.invalido[0] === null && est.rondasResueltas === 2, 'duelo válido de 2 rondas');
// duelo viejo (sin niveles)
const dOld = BM.nuevoDuelo('X'); dOld.e[0].push(BM.codificarEjercito(lobo(3))); dOld.e[1].push(BM.codificarEjercito(lobo(3)));
est = BM.estadoDuelo(dOld);
ok(est.rondasResueltas === 1 && !est.hayInvalido, 'link viejo sin niveles sigue funcionando');
// ronda de un solo jugador: igual se calcula su biomasa, sin resolver
const dMedio = BM.nuevoDuelo('X'); dMedio.e[0].push(BM.codificarRonda(lobo(7), {}));
est = BM.estadoDuelo(dMedio);
ok(est.rondasResueltas === 0 && est.invalido[0] === 1 && est.turno === 1, 'ronda pendiente: se marca inválida sin resolver ni lanzar error');

console.log('Un diseño nivel 3 vence al mismo diseño nivel 1');
{
  const pares = [['lobo', 'lobo', 'lobo', 5], ['rino', 'rino', 'rino', 3], ['arana', 'rana', 'arana', 5], ['elefante', 'tortuga', 'rino', 2]];
  for (const [c, t, p, n] of pares) {
    const niv = { [k(c, t, p)]: 3 };
    let ganaA = 0, ganaB = 0;
    for (let s = 1; s <= 4; s++) {
      if (BM.resolverCombate(fila(c, t, p, n), fila(c, t, p, n), s * 31, niv, {}).ganador === 0) ganaA++;
      if (BM.resolverCombate(fila(c, t, p, n), fila(c, t, p, n), s * 31, {}, niv).ganador === 1) ganaB++;
    }
    ok(ganaA === 4 && ganaB === 4, `${c}-${t}-${p} ×${n}: nivel 3 gana siempre, de cualquier lado`);
  }
  // los niveles son por diseño: otro diseño del mismo bando no se ve afectado
  const r1 = BM.resolverCombate(fila('lobo', 'lobo', 'lobo', 3), fila('tortuga', 'tortuga', 'tortuga', 2), 3);
  const r2 = BM.resolverCombate(fila('lobo', 'lobo', 'lobo', 3), fila('tortuga', 'tortuga', 'tortuga', 2), 3, { [k('rino', 'rino', 'rino')]: 3 }, {});
  ok(r1.huella === r2.huella, 'el nivel de un diseño que no está en mesa no cambia nada');
  // daño al jugador usa el valor
  const cA = BM.crearCombate(fila('lobo', 'lobo', 'lobo', 3), [], 1, { [KL]: 3 }, {});
  while (!cA.terminado) BM.pasoCombate(cA);
  const cB = BM.crearCombate(fila('lobo', 'lobo', 'lobo', 3), [], 1);
  while (!cB.terminado) BM.pasoCombate(cB);
  const dA = BM.calcularDanoJugadores(cA), dB = BM.calcularDanoJugadores(cB);
  ok(dB[1] === 8 + 3 * Math.ceil(CL / 4) && dA[1] === 8 + 3 * Math.ceil(2 * CL / 4), `daño al jugador por sobrevivientes usa el valor (${dB[1]} → ${dA[1]})`);
}

console.log('La IA actual respeta el presupuesto bajo el libro de cuentas');
{
  let prevIA = [], rondasIA = [];
  let respeta = true;
  for (let r = 1; r <= 8; r++) {
    const ej = BM.generarEjercitoIA(prevIA, [], r, 500 + r);
    rondasIA.push({ ej, niv: {} });
    prevIA = ej;
  }
  const hi = BM.historialBiomasa(rondasIA);
  for (let r = 0; r < hi.libre.length; r++) {
    if (hi.libre[r] < 0) respeta = false;
    if (hi.libre[r] !== BM.presupuesto(r + 1) - BM.costoEjercito(rondasIA[r].ej)) respeta = false;
  }
  ok(respeta && !hi.invalido, 'libre = presupuesto − costo del ejército, nunca negativo (' + hi.libre.join(', ') + ')');
}

console.log(fallas ? `\n${fallas} test(s) fallaron` : '\nTodo OK');
process.exit(fallas ? 1 : 0);
