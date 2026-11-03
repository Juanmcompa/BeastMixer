/*
 * BeastMixer — GameManager + interfaz.
 *
 * Fases (como el GameManager.gd del PDF): inicio → draft → combate → resultado → draft ...
 * La lógica vive en src/core; acá sólo se arma la interfaz, se leen gestos y se
 * le pasa una "escena" al render.
 */
(function (BM) {
  'use strict';

  var R = BM.REGLAS;
  var $ = function (id) { return document.getElementById(id); };
  var PARTES = [
    { id: 'cabeza', clave: 'cab', titulo: 'Cabeza', ayuda: 'cómo ataca' },
    { id: 'torso', clave: 'tor', titulo: 'Torso', ayuda: 'cuánto aguanta' },
    { id: 'patas', clave: 'pat', titulo: 'Patas', ayuda: 'qué tan rápido va' }
  ];

  var J = {
    modo: null, fase: 'inicio', ronda: 1, miBando: 0,
    vida: [R.vidaJugador, R.vidaJugador], nombres: ['Vos', 'IA'],
    ejercito: [], rivalVisto: [],
    ia: null, duelo: null,
    diseno: { cab: 'lobo', tor: 'lobo', pat: 'lobo' },
    sel: null, hover: null, arrastre: null,
    combate: null, vel: 1, efectos: [], fases: {}
  };

  var render, ultimoT = 0;

  // ── utilidades ───────────────────────────────────────────────────────────
  function copiarEj(ej) { return ej.map(function (u) { return { cab: u.cab, tor: u.tor, pat: u.pat, col: u.col, prof: u.prof }; }); }
  function biomasaLibre() { return BM.presupuesto(J.ronda) - BM.costoEjercito(J.ejercito); }
  function mostrar(id, si) { $(id).hidden = !si; }
  function pantalla(id) {
    ['pInicio', 'pNombre', 'pResultado', 'pCompartir', 'pAyuda'].forEach(function (p) { mostrar(p, p === id); });
  }
  // Cómo nombrar al rival dentro de una oración.
  function rivalTexto(mayus) {
    var n = J.modo === 'ia' ? 'la IA' : (J.nombres[1 - J.miBando] || 'tu rival');
    return mayus ? n.charAt(0).toUpperCase() + n.slice(1) : n;
  }
  function nombreCelda(col, prof) { return 'ABCDEFGHIJKL'[col] + (prof + 1); }

  function celdaDesdeMundo(bando, x, y) {
    var c = R.celda;
    var col, prof;
    if (bando === 0) { col = Math.floor(x / c); prof = Math.floor(y / c) - (R.filasZona + R.filasNeutras); }
    else { col = R.columnas - 1 - Math.floor(x / c); prof = R.filasZona - 1 - Math.floor(y / c); }
    var valida = col >= 0 && col < R.columnas && prof >= 0 && prof < R.filasZona;
    return { col: col, prof: prof, valida: valida };
  }

  function guardarLocal(clave, valor) { try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { /* sin almacenamiento */ } }
  function leerLocal(clave, defecto) {
    try { var v = localStorage.getItem(clave); return v ? JSON.parse(v) : defecto; } catch (e) { return defecto; }
  }

  // ── Laboratorio ──────────────────────────────────────────────────────────
  // Íconos de partes: canvas (no imágenes) para que funcione también abriendo el archivo local.
  function icono(parte, id) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = 96;
    cv.className = 'icono';
    cv.dataset.parte = parte; cv.dataset.animal = id;
    pintarIcono(cv);
    return cv;
  }
  function pintarIcono(cv) {
    var cx = cv.getContext('2d');
    cx.setTransform(2, 0, 0, 2, 0, 0);
    cx.clearRect(0, 0, 48, 48);
    BM.dibujarParte(cx, cv.dataset.parte, cv.dataset.animal, 48);
  }
  function repintarIconos() {
    Array.prototype.forEach.call(document.querySelectorAll('canvas.icono'), pintarIcono);
  }

  function construirPartes() {
    var cont = $('partes');
    cont.innerHTML = '';
    PARTES.forEach(function (p) {
      var fs = document.createElement('fieldset');
      fs.className = 'parte';
      var lg = document.createElement('legend');
      lg.innerHTML = '<b>' + p.titulo + '</b> <span>' + p.ayuda + '</span>';
      fs.appendChild(lg);
      var fila = document.createElement('div');
      fila.className = 'parte-opciones';
      BM.ANIMALES.forEach(function (a) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'opcion';
        b.dataset.parte = p.clave;
        b.dataset.animal = a.id;
        b.title = p.titulo + ' de ' + a.nombre;
        b.appendChild(icono(p.id, a.id));
        var nom = document.createElement('span');
        nom.textContent = a.nombre;
        b.appendChild(nom);
        b.addEventListener('click', function () {
          J.diseno[p.clave] = a.id;
          J.sel = null;
          actualizarLab();
        });
        fila.appendChild(b);
      });
      fs.appendChild(fila);
      cont.appendChild(fs);
    });
  }

  function barra(valor, max) {
    var pct = Math.max(4, Math.min(100, valor / max * 100));
    return '<span class="medidor"><i style="width:' + pct + '%"></i></span>';
  }

  function dibujarLamina(ctx, W, H, dpr, d, opciones) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(220,232,243,0.09)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = 0; x < W; x += 16) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
    for (var y = 0; y < H; y += 16) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
    ctx.stroke();

    var s = BM.ensamblar(d.cab, d.tor, d.pat);
    var caja = BM.cajaBestia(s);
    var anchoCaja = opciones && opciones.sinCotas ? W - 30 : W - 150;
    var esc = Math.min(4, anchoCaja / (caja.x1 - caja.x0), (H - 34) / (caja.y1 - caja.y0));
    var cx = W / 2, cy = H / 2 + 6 - (caja.y0 + caja.y1) / 2 * esc;
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(esc, esc);
    BM.dibujarBestia(ctx, 0, 0, s, { fase: (opciones && opciones.fase) || 0.6, sinSombra: true });
    ctx.restore();

    if (opciones && opciones.sinCotas) return;
    // Cotas tipo lámina técnica
    var pt = BM.puntosBestia(s);
    var cotas = [
      { px: cx + pt.cabeza.x * esc, py: cy + pt.cabeza.y * esc, tx: 14, ty: 22, txt: 'Cabeza: ' + BM.animalPorId(d.cab).nombre, al: 'left' },
      { px: cx + pt.torso.x * esc, py: cy + pt.torso.y * esc, tx: W - 14, ty: H / 2 - 18, txt: 'Torso: ' + BM.animalPorId(d.tor).nombre, al: 'right' },
      { px: cx + pt.patas.x * esc, py: cy + pt.patas.y * esc, tx: 14, ty: H - 14, txt: 'Patas: ' + BM.animalPorId(d.pat).nombre, al: 'left' }
    ];
    ctx.font = '700 12px "Atkinson Hyperlegible", system-ui, sans-serif';
    cotas.forEach(function (c) {
      var ancho = ctx.measureText(c.txt).width;
      var codoX = c.al === 'left' ? c.tx + ancho + 6 : c.tx - ancho - 6;
      ctx.strokeStyle = 'rgba(220,232,243,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(c.px, c.py); ctx.lineTo(codoX, c.ty - 4);
      ctx.lineTo(c.al === 'left' ? c.tx : c.tx, c.ty - 4); ctx.stroke();
      ctx.fillStyle = '#dce8f3';
      ctx.beginPath(); ctx.arc(c.px, c.py, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.textAlign = c.al;
      ctx.fillText(c.txt, c.tx, c.ty - 8);
    });
  }

  function actualizarLab() {
    var d = J.sel ? J.sel : J.diseno;
    var s = BM.ensamblar(d.cab, d.tor, d.pat);
    var cvL = $('lamina');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cvL.width !== 320 * dpr) { cvL.width = 320 * dpr; cvL.height = 230 * dpr; }
    var compacto = window.matchMedia && window.matchMedia('(max-width: 860px)').matches;
    dibujarLamina(cvL.getContext('2d'), 320, 230, dpr, d, { sinCotas: compacto });

    $('especie').textContent = s.nombre;
    var libre = biomasaLibre();
    $('costo').innerHTML = '<b>' + s.costo + '</b> de biomasa' + (!J.sel && J.fase === 'draft' && s.costo > libre ? ' <em>te faltan ' + (s.costo - libre) + '</em>' : '');

    $('ficha').innerHTML =
      '<div><dt>Vida</dt><dd>' + barra(s.vida, 380) + '<b>' + s.vida + '</b></dd></div>' +
      '<div><dt>Armadura</dt><dd>' + barra(s.armadura, 6) + '<b>' + s.armadura + '</b></dd></div>' +
      '<div><dt>Daño por segundo</dt><dd>' + barra(s.dps, 18) + '<b>' + s.dps.toFixed(1) + '</b></dd></div>' +
      '<div><dt>Alcance</dt><dd>' + barra(s.alcance, 150) + '<b>' + (s.distancia ? s.alcance : 'cuerpo a cuerpo') + '</b></dd></div>' +
      '<div><dt>Velocidad</dt><dd>' + barra(s.velocidad, 115) + '<b>' + s.velocidad + '</b></dd></div>';

    $('habilidades').innerHTML = s.habilidades.length
      ? s.habilidades.map(function (h) { var x = BM.HABILIDADES[h]; return '<li><b>' + x.nombre + '.</b> ' + x.texto + '</li>'; }).join('')
      : '<li class="sin">Sin habilidades especiales.</li>';

    // botones de partes
    var botones = document.querySelectorAll('.opcion');
    for (var i = 0; i < botones.length; i++) {
      var b = botones[i];
      b.setAttribute('aria-pressed', d[b.dataset.parte] === b.dataset.animal ? 'true' : 'false');
      b.disabled = !!J.sel;
    }

    if (J.sel) {
      mostrar('seleccion', true);
      $('seleccionTexto').textContent = s.nombre + ' en ' + nombreCelda(J.sel.col, J.sel.prof) + '. Arrastrala para moverla.';
      $('btnReciclar').textContent = 'Reciclar (+' + s.costo + ')';
      $('btnReciclar').disabled = J.fase !== 'draft';
      mostrar('pista', false);
    } else {
      mostrar('seleccion', false);
      mostrar('pista', J.fase === 'draft');
    }
    actualizarBarra();
  }

  function actualizarBarra() {
    $('ronda').textContent = J.ronda;
    var total = BM.presupuesto(J.ronda);
    $('biomasa').innerHTML = biomasaLibre() + '<small> / ' + total + '</small>';
    var yo = J.vida[J.miBando], rival = J.vida[1 - J.miBando];
    $('vidaYo').style.width = (yo / R.vidaJugador * 100) + '%';
    $('vidaRival').style.width = (rival / R.vidaJugador * 100) + '%';
    $('vidaYoNum').textContent = yo;
    $('vidaRivalNum').textContent = rival;
    $('nombreYo').textContent = J.nombres[J.miBando] || 'Vos';
    $('nombreRival').textContent = J.nombres[1 - J.miBando] || 'Rival';
    var btn = $('btnCombatir');
    btn.textContent = J.modo === 'duelo' ? 'Enviar ejército' : 'Combatir';
    btn.disabled = J.fase !== 'draft' || J.ejercito.length === 0;
  }

  // ── Fases ────────────────────────────────────────────────────────────────
  function entrarJuego() {
    pantalla(null);
    mostrar('marcador', true); mostrar('btnCombatir', true); mostrar('mesa', true);
    requestAnimationFrame(function () { render.ajustar(); });
  }

  function iniciarDraft() {
    J.fase = 'draft';
    J.sel = null; J.efectos = []; J.combate = null;
    $('velocidades').classList.add('oculto');
    document.body.classList.remove('en-combate');
    var aviso = J.rivalVisto.length
      ? 'Ronda ' + J.ronda + '. Arriba, en tenue, está lo que ' + rivalTexto() + ' desplegó la ronda pasada. Puede sumar más.'
      : 'Ronda ' + J.ronda + '. El rival todavía no mostró su ejército. Desplegá en tu zona, abajo.';
    $('aviso').textContent = aviso;
    actualizarLab();
  }

  function iniciarCombate(ejA, ejB, semilla, alTerminar) {
    J.fase = 'combate';
    J.sel = null; J.arrastre = null; J.efectos = []; J.fases = {};
    J.combate = { c: BM.crearCombate(ejA, ejB, semilla), acum: 0, fin: null, alTerminar: alTerminar };
    document.body.classList.add('en-combate');
    $('velocidades').classList.remove('oculto');
    $('aviso').textContent = 'Combate de la ronda ' + J.ronda + '.';
    actualizarLab();
  }

  function procesarEventos(evs) {
    var c = J.combate.c;
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i];
      if (e.t === 'golpe') {
        var de = c.unidades[e.de];
        if (e.tipo === 'escupitajo' && de) J.efectos.push({ tipo: 'proyectil', x: de.x, y: de.y, x2: e.x, y2: e.y, t: 0.2, dur: 0.2, color: BM.COLOR.veneno });
        if (e.tipo === 'lengua' && de) J.efectos.push({ tipo: 'lengua', x: de.x, y: de.y, x2: e.x, y2: e.y, t: 0.15, dur: 0.15 });
        if (e.dano >= 2) {
          J.efectos.push({ tipo: 'texto', x: e.x + ((e.a * 7) % 11) - 5, y: e.y - 10, t: 0.6, dur: 0.6,
            texto: Math.round(e.dano), color: e.tipo === 'carga' ? '#ffd166' : (e.tipo === 'espinas' ? '#e9c9a0' : '#dce8f3') });
        }
      } else if (e.t === 'area') {
        J.efectos.push({ tipo: 'area', x: e.x, y: e.y, t: 0.3, dur: 0.3 });
      } else if (e.t === 'muere') {
        var u = c.unidades[e.id];
        J.efectos.push({ tipo: 'muerte', x: e.x, y: e.y, t: 0.45, dur: 0.45, color: u.bando === J.miBando ? BM.COLOR.yo : BM.COLOR.rival });
      }
    }
  }

  function avanzarCombate(dtReal) {
    var cb = J.combate;
    if (!cb) return;
    var paso = R.pasoSimulacion;
    if (!cb.c.terminado) {
      cb.acum += Math.min(0.1, dtReal) * J.vel;
      var n = 0;
      while (cb.acum >= paso && !cb.c.terminado && n < 16) {
        for (var i = 0; i < cb.c.unidades.length; i++) { var u = cb.c.unidades[i]; u.px = u.x; u.py = u.y; }
        BM.pasoCombate(cb.c);
        procesarEventos(cb.c.eventos);
        cb.acum -= paso; n++;
      }
    } else if (cb.fin === null) {
      cb.fin = 1.0;
    } else {
      cb.fin -= dtReal;
      if (cb.fin <= 0 && J.fase === 'combate') {
        J.fase = 'post';
        $('velocidades').classList.add('oculto');
        cb.alTerminar(BM.calcularDanoJugadores(cb.c), cb.c.ganador);
      }
    }
  }

  function saltarCombate() {
    var cb = J.combate;
    if (!cb || J.fase !== 'combate') return;
    while (!cb.c.terminado) BM.pasoCombate(cb.c);
    J.efectos = [];
    cb.fin = 0.01;
  }

  function textoResultado(dano, ganador) {
    var yo = J.miBando, rival = 1 - J.miBando;
    var nombreRival = rivalTexto();
    if (ganador === yo) return { titulo: 'Ganaste la ronda', texto: rivalTexto(true) + ' pierde ' + dano[rival] + ' de vida (' + R.danoBaseDerrota + ' por perder la ronda y el resto por tus bestias en pie).' };
    if (ganador === rival) return { titulo: 'Perdiste la ronda', texto: 'Perdés ' + dano[yo] + ' de vida (' + R.danoBaseDerrota + ' por perder la ronda y el resto por las bestias rivales en pie). Mirá qué te ganó y contrarrestalo.' };
    if (dano[0] === 0 && dano[1] === 0) return { titulo: 'Empate', texto: 'No quedó nadie en pie. Nadie pierde vida.' };
    return { titulo: 'Empate por tiempo', texto: 'Se acabó el tiempo. Perdés ' + dano[yo] + ' y ' + nombreRival + ' pierde ' + dano[rival] + ' por las bestias que quedaron.' };
  }

  function mostrarResultado(titulo, texto, acciones) {
    $('resTitulo').textContent = titulo;
    $('resTexto').textContent = texto;
    var cont = $('resAcciones');
    cont.innerHTML = '';
    acciones.forEach(function (a, i) {
      var b = document.createElement('button');
      b.className = 'btn' + (i === 0 ? ' btn-principal' : '');
      b.textContent = a.texto;
      b.addEventListener('click', a.fn);
      cont.appendChild(b);
    });
    pantalla('pResultado');
    var primero = cont.querySelector('button');
    if (primero) primero.focus();
  }

  // ── Modo contra la IA ────────────────────────────────────────────────────
  function iniciarIA() {
    J.modo = 'ia'; J.miBando = 0; J.ronda = 1;
    J.vida = [R.vidaJugador, R.vidaJugador];
    J.nombres = ['Vos', 'IA'];
    J.ejercito = []; J.rivalVisto = [];
    J.ia = { ej: [], visto: [], semilla: (Math.random() * 1e9) >>> 0 };
    entrarJuego();
    iniciarDraft();
  }

  function combatirIA() {
    var ia = J.ia;
    var nuevo = BM.generarEjercitoIA(ia.ej, ia.visto, J.ronda, ia.semilla + J.ronda * 31);
    var mio = copiarEj(J.ejercito);
    iniciarCombate(mio, nuevo, ia.semilla + J.ronda, function (dano, ganador) {
      J.vida = [Math.max(0, J.vida[0] - dano[0]), Math.max(0, J.vida[1] - dano[1])];
      actualizarBarra();
      ia.ej = nuevo; ia.visto = mio;
      var r = textoResultado(dano, ganador);
      if (J.vida[0] <= 0 || J.vida[1] <= 0) {
        var gane = J.vida[1] <= 0 && J.vida[0] > 0;
        mostrarResultado(gane ? 'Ganaste la partida' : (J.vida[0] <= 0 && J.vida[1] <= 0 ? 'Empate final' : 'La IA ganó la partida'),
          r.texto + ' Llegaste a la ronda ' + J.ronda + '.',
          [{ texto: 'Jugar otra vez', fn: iniciarIA }, { texto: 'Volver al inicio', fn: volverInicio }]);
        return;
      }
      mostrarResultado(r.titulo, r.texto, [{ texto: 'Desplegar ronda ' + (J.ronda + 1), fn: function () {
        pantalla(null);
        J.ronda++;
        J.rivalVisto = nuevo;
        iniciarDraft();
      } }]);
    });
  }

  // ── Duelo por link ───────────────────────────────────────────────────────
  function linkDuelo() {
    return location.href.split('#')[0] + '#d=' + BM.codificarDuelo(J.duelo);
  }

  function guardarLado() {
    var lados = leerLocal('bm-duelos', {});
    lados[J.duelo.s] = J.miBando;
    guardarLocal('bm-duelos', lados);
  }

  function compartir(titulo, texto) {
    var link = linkDuelo();
    try { history.replaceState(null, '', '#d=' + BM.codificarDuelo(J.duelo)); } catch (e) { /* iframe */ }
    $('compTitulo').textContent = titulo;
    $('compTexto').textContent = texto;
    $('compLink').value = link;
    var yo = J.nombres[J.miBando] || 'Tu rival';
    var msg = yo + ' te reta a BeastMixer. Tocá el link para jugar tu turno: ' + link;
    $('compWhatsapp').href = 'https://wa.me/?text=' + encodeURIComponent(msg);
    pantalla('pCompartir');
  }

  function nuevoDuelo(nombre) {
    J.modo = 'duelo';
    J.duelo = BM.nuevoDuelo(nombre);
    J.miBando = 0;
    guardarLado();
    J.nombres = [nombre, ''];
    draftDuelo(1);
    entrarJuego();
  }

  function draftDuelo(ronda) {
    var d = J.duelo, yo = J.miBando, otro = 1 - yo;
    var est = BM.estadoDuelo(d);
    J.ronda = ronda;
    J.vida = est.vida.slice();
    J.nombres = [d.n[0] || 'Jugador A', d.n[1] || 'Jugador B'];
    J.ejercito = ronda > 1 ? BM.ejercitoDuelo(d, yo, ronda - 1) : [];
    J.rivalVisto = ronda > 1 ? BM.ejercitoDuelo(d, otro, ronda - 1) : [];
    iniciarDraft();
  }

  function verCombateDuelo(ronda, despues) {
    var d = J.duelo;
    var est = BM.estadoDuelo(d);
    var antes = ronda > 1 && est.historial[ronda - 2] ? est.historial[ronda - 2].vida : [R.vidaJugador, R.vidaJugador];
    J.ronda = ronda;
    J.vida = antes.slice();
    J.nombres = [d.n[0] || 'Jugador A', d.n[1] || 'Jugador B'];
    J.ejercito = BM.ejercitoDuelo(d, J.miBando, ronda);
    J.rivalVisto = BM.ejercitoDuelo(d, 1 - J.miBando, ronda);
    actualizarBarra();
    iniciarCombate(BM.ejercitoDuelo(d, 0, ronda), BM.ejercitoDuelo(d, 1, ronda), BM.semillaRonda(d.s, ronda), function (dano, ganador) {
      var h = est.historial[ronda - 1];
      J.vida = h.vida.slice();
      actualizarBarra();
      despues(textoResultado(dano, ganador), BM.estadoDuelo(d));
    });
  }

  function trasCombateDuelo(r, est) {
    var d = J.duelo, yo = J.miBando;
    if (est.terminado) {
      var gane = est.ganadorPartida === yo;
      var titulo = est.ganadorPartida === -1 ? 'Empate final' : (gane ? 'Ganaste el duelo' : (J.nombres[1 - yo] + ' ganó el duelo'));
      mostrarResultado(titulo, r.texto, [
        { texto: 'Avisarle a ' + (J.nombres[1 - yo] || 'tu rival'), fn: function () { compartir(titulo, 'Mandale el link para que vea el último combate.'); } },
        { texto: 'Volver al inicio', fn: volverInicio }
      ]);
      return;
    }
    var siguiente = d.e[yo].length + 1;
    mostrarResultado(r.titulo, r.texto, [{ texto: 'Desplegar ronda ' + siguiente, fn: function () { pantalla(null); draftDuelo(siguiente); } }]);
  }

  function enviarEjercitoDuelo() {
    var d = J.duelo, yo = J.miBando, otro = 1 - yo;
    d.e[yo][J.ronda - 1] = BM.codificarEjercito(J.ejercito);
    d.e[yo].length = J.ronda;
    if (d.e[otro].length >= J.ronda) {
      verCombateDuelo(J.ronda, trasCombateDuelo);
    } else {
      J.fase = 'esperando';
      actualizarBarra();
      compartir('Ejército enviado', 'Mandale este link a ' + (J.nombres[otro] || 'tu rival') + '. Cuando despliegue su ronda ' + J.ronda + ', te vuelve un link con el combate.');
    }
  }

  function abrirDuelo(d) {
    J.modo = 'duelo';
    J.duelo = d;
    var est = BM.estadoDuelo(d);
    var lados = leerLocal('bm-duelos', {});
    var mio = lados[d.s];
    J.nombres = [d.n[0] || 'Jugador A', d.n[1] || 'Jugador B'];

    if (est.terminado) {
      J.miBando = mio === undefined ? 0 : mio;
      entrarJuego();
      var ultima = est.rondasResueltas;
      verCombateDuelo(ultima, trasCombateDuelo);
      return;
    }
    if (mio !== undefined && mio !== est.turno) {
      J.miBando = mio;
      J.vida = est.vida.slice();
      J.ronda = d.e[mio].length;
      entrarJuego();
      J.ejercito = BM.ejercitoDuelo(d, mio, J.ronda);
      J.rivalVisto = [];
      J.fase = 'esperando';
      $('aviso').textContent = 'Le toca a ' + (J.nombres[1 - mio] || 'tu rival') + '.';
      actualizarLab();
      compartir('Le toca a ' + (J.nombres[1 - mio] || 'tu rival'), 'Este link es tuyo: ya jugaste tu ronda. Mandáselo a tu rival si todavía no lo hiciste.');
      return;
    }
    J.miBando = est.turno;
    if (J.miBando === 1 && !d.n[1]) {
      pedirNombre('Te retó ' + (d.n[0] || 'alguien'), 'Escribí tu nombre para aceptar el duelo.', function (nombre) {
        d.n[1] = nombre;
        continuarDuelo();
      });
      return;
    }
    continuarDuelo();
  }

  function continuarDuelo() {
    var d = J.duelo, yo = J.miBando, otro = 1 - yo;
    guardarLado();
    entrarJuego();
    var k = d.e[yo].length;
    if (k >= 1 && d.e[otro].length >= k) {
      verCombateDuelo(k, trasCombateDuelo);
    } else {
      draftDuelo(k + 1);
    }
  }

  // ── Nombre ───────────────────────────────────────────────────────────────
  var alNombre = null;
  function pedirNombre(titulo, texto, fn) {
    $('nombreTitulo').textContent = titulo;
    $('nombreTexto').textContent = texto;
    $('inputNombre').value = leerLocal('bm-nombre', '') || '';
    alNombre = fn;
    pantalla('pNombre');
    $('inputNombre').focus();
  }

  function volverInicio() {
    J.fase = 'inicio'; J.combate = null;
    try { history.replaceState(null, '', location.href.split('#')[0]); } catch (e) { /* iframe */ }
    mostrar('marcador', false); mostrar('btnCombatir', false); mostrar('mesa', false);
    document.body.classList.remove('en-combate');
    pantalla('pInicio');
  }

  // ── Gestos en el campo ───────────────────────────────────────────────────
  function puntero(e) {
    var w = render.aMundo(e.clientX, e.clientY, J.miBando === 1);
    var c = celdaDesdeMundo(J.miBando, w.x, w.y);
    return { w: w, c: c };
  }

  function desplegar(col, prof) {
    var s = BM.ensamblar(J.diseno.cab, J.diseno.tor, J.diseno.pat);
    var libre = biomasaLibre();
    if (s.costo > libre) {
      $('aviso').textContent = 'Te falta biomasa: ' + s.nombre + ' cuesta ' + s.costo + ' y te quedan ' + libre + '. Reciclá algo o elegí partes más baratas.';
      return;
    }
    J.ejercito.push({ cab: J.diseno.cab, tor: J.diseno.tor, pat: J.diseno.pat, col: col, prof: prof });
    actualizarLab();
  }

  function alPresionar(e) {
    if (J.fase !== 'draft') return;
    var p = puntero(e);
    if (!p.c.valida) { J.sel = null; actualizarLab(); return; }
    var u = BM.celdaOcupada(J.ejercito, p.c.col, p.c.prof);
    if (u) {
      J.sel = u;
      J.arrastre = { u: u, w: p.w, movido: false };
      try { e.target.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
      actualizarLab();
    } else {
      if (J.sel) { J.sel = null; actualizarLab(); return; }
      desplegar(p.c.col, p.c.prof);
    }
  }

  function alMover(e) {
    var p = puntero(e);
    J.hover = p;
    if (J.arrastre) { J.arrastre.w = p.w; J.arrastre.movido = true; }
  }

  function alSoltar(e) {
    if (!J.arrastre) return;
    var p = puntero(e);
    var u = J.arrastre.u;
    if (J.arrastre.movido && p.c.valida && (p.c.col !== u.col || p.c.prof !== u.prof)) {
      var otro = BM.celdaOcupada(J.ejercito, p.c.col, p.c.prof, u);
      if (otro) { otro.col = u.col; otro.prof = u.prof; }
      u.col = p.c.col; u.prof = p.c.prof;
    }
    J.arrastre = null;
    actualizarLab();
  }

  function reciclar() {
    if (!J.sel || J.fase !== 'draft') return;
    J.ejercito = J.ejercito.filter(function (u) { return u !== J.sel; });
    J.sel = null;
    actualizarLab();
  }

  // ── Bucle de dibujo ──────────────────────────────────────────────────────
  function escenaDraft(t) {
    var yo = J.miBando, otro = 1 - yo;
    var unidades = [];
    J.rivalVisto.forEach(function (u) {
      var p = BM.posicionCelda(otro, u.col, u.prof);
      unidades.push({ x: p.x, y: p.y, b: BM.ensamblar(u.cab, u.tor, u.pat), o: { equipo: BM.COLOR.rival, alfa: 0.5, ang: otro === 0 ? 0 : Math.PI } });
    });
    J.ejercito.forEach(function (u, i) {
      var p = BM.posicionCelda(yo, u.col, u.prof);
      if (J.arrastre && J.arrastre.u === u && J.arrastre.movido) p = J.arrastre.w;
      unidades.push({ x: p.x, y: p.y, b: BM.ensamblar(u.cab, u.tor, u.pat),
        o: { equipo: BM.COLOR.yo, ang: yo === 0 ? 0 : Math.PI, fase: Math.sin(t * 1.5 + i) * 0.4 } });
    });
    var esc = { girar: yo === 1, unidades: unidades, grilla: J.fase === 'draft' };
    if (J.sel) {
      var ps = J.arrastre && J.arrastre.movido ? J.arrastre.w : BM.posicionCelda(yo, J.sel.col, J.sel.prof);
      esc.seleccion = { x: ps.x, y: ps.y, r: BM.ensamblar(J.sel.cab, J.sel.tor, J.sel.pat).radio };
    }
    var h = J.hover;
    if (h && h.c.valida && J.fase === 'draft') {
      var pc = BM.posicionCelda(yo, h.c.col, h.c.prof);
      var ocupada = BM.celdaOcupada(J.ejercito, h.c.col, h.c.prof, J.arrastre ? J.arrastre.u : null);
      if (J.arrastre) {
        esc.celda = { x: pc.x, y: pc.y, valida: true };
      } else if (!ocupada && !J.sel) {
        var s = BM.ensamblar(J.diseno.cab, J.diseno.tor, J.diseno.pat);
        esc.fantasma = { x: pc.x, y: pc.y, b: s, valido: s.costo <= biomasaLibre() };
      }
    }
    return esc;
  }

  function escenaCombate(dt) {
    var c = J.combate.c;
    var alfa = Math.min(1, J.combate.acum / R.pasoSimulacion);
    var unidades = c.unidades.map(function (u) {
      var x = u.px === undefined ? u.x : u.px + (u.x - u.px) * alfa;
      var y = u.py === undefined ? u.y : u.py + (u.y - u.py) * alfa;
      if (u.moviendo) J.fases[u.id] = (J.fases[u.id] || 0) + dt * J.vel * (4 + u.s.velocidad / 25);
      return {
        x: x, y: y, b: u.s, vida: u.vida, veneno: u.veneno.length,
        o: { equipo: u.bando === J.miBando ? BM.COLOR.yo : BM.COLOR.rival, ang: Math.atan2(u.dirX, -u.dirY),
          fase: J.fases[u.id] || 0, golpeado: u.golpeado > 0, atacando: u.atacando > 0, muerta: !u.viva }
      };
    });
    for (var i = J.efectos.length - 1; i >= 0; i--) {
      J.efectos[i].t -= dt * J.vel;
      if (J.efectos[i].t <= 0) J.efectos.splice(i, 1);
    }
    return { girar: J.miBando === 1, unidades: unidades, efectos: J.efectos };
  }

  function cuadro(ts) {
    var t = ts / 1000;
    var dt = ultimoT ? Math.min(0.1, t - ultimoT) : 0;
    ultimoT = t;
    if (!$('mesa').hidden) {
      if (J.combate && (J.fase === 'combate' || J.fase === 'post')) {
        avanzarCombate(dt);
        render.dibujar(escenaCombate(dt));
      } else {
        render.dibujar(escenaDraft(t));
      }
    }
    requestAnimationFrame(cuadro);
  }

  // ── Portada ──────────────────────────────────────────────────────────────
  function dibujarPortada() {
    var cv = $('portada');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = 560 * dpr; cv.height = 220 * dpr;
    var ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = 'rgba(220,232,243,0.1)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = 0; x < 560; x += 20) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, 220); }
    for (var y = 0; y < 220; y += 20) { ctx.moveTo(0, y + 0.5); ctx.lineTo(560, y + 0.5); }
    ctx.stroke();
    var bestias = [['rino', 'puercoespin', 'lobo'], ['arana', 'tortuga', 'rana'], ['elefante', 'escorpion', 'arana']];
    bestias.forEach(function (b, i) {
      var s = BM.ensamblar(b[0], b[1], b[2]);
      var caja = BM.cajaBestia(s);
      var esc = Math.min(3, 160 / (caja.x1 - caja.x0), 172 / (caja.y1 - caja.y0));
      var cx = 100 + i * 180, cy = 98 - (caja.y0 + caja.y1) / 2 * esc;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(esc, esc);
      BM.dibujarBestia(ctx, 0, 0, s, { fase: 0.4 + i, sinSombra: true });
      ctx.restore();
      ctx.fillStyle = '#dce8f3';
      ctx.font = '700 13px "Atkinson Hyperlegible", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.nombre, 100 + i * 180, 207);
    });
  }

  // ── Arranque ─────────────────────────────────────────────────────────────
  function iniciar() {
    render = BM.crearRenderCampo($('campo'));
    construirPartes();
    actualizarLab();
    dibujarPortada();
    BM.cargarSprites(function () { repintarIconos(); dibujarPortada(); actualizarLab(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { dibujarPortada(); actualizarLab(); });

    $('btnIA').addEventListener('click', iniciarIA);
    $('btnDuelo').addEventListener('click', function () {
      pedirNombre('¿Cómo te llamás?', 'Tu rival va a ver este nombre.', nuevoDuelo);
    });
    $('btnAyuda').addEventListener('click', function () { pantalla('pAyuda'); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-volver]'), function (b) {
      b.addEventListener('click', function () {
        if (J.fase === 'inicio' || J.fase === 'esperando' || J.duelo) volverInicio(); else pantalla(null);
      });
    });
    $('formNombre').addEventListener('submit', function (e) {
      e.preventDefault();
      var n = $('inputNombre').value.trim().slice(0, 16);
      if (!n) return;
      guardarLocal('bm-nombre', n);
      var fn = alNombre; alNombre = null;
      if (fn) fn(n);
    });
    $('btnCombatir').addEventListener('click', function () {
      if (J.fase !== 'draft' || !J.ejercito.length) return;
      if (J.modo === 'ia') combatirIA(); else enviarEjercitoDuelo();
    });
    $('btnReciclar').addEventListener('click', reciclar);
    $('btnCopiar').addEventListener('click', function () {
      if (!J.sel) return;
      J.diseno = { cab: J.sel.cab, tor: J.sel.tor, pat: J.sel.pat };
      J.sel = null;
      actualizarLab();
    });
    $('compCopiar').addEventListener('click', function () {
      var inp = $('compLink');
      inp.select();
      var hecho = function () { $('compCopiar').textContent = 'Link copiado'; };
      if (navigator.clipboard) navigator.clipboard.writeText(inp.value).then(hecho, function () { document.execCommand('copy'); hecho(); });
      else { document.execCommand('copy'); hecho(); }
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-vel]'), function (b) {
      b.addEventListener('click', function () {
        J.vel = +b.dataset.vel;
        Array.prototype.forEach.call(document.querySelectorAll('[data-vel]'), function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
      });
    });
    $('btnSaltar').addEventListener('click', saltarCombate);

    var cv = $('campo');
    cv.addEventListener('pointerdown', alPresionar);
    cv.addEventListener('pointermove', alMover);
    cv.addEventListener('pointerup', alSoltar);
    cv.addEventListener('pointercancel', function () { J.arrastre = null; });
    cv.addEventListener('pointerleave', function () { if (!J.arrastre) J.hover = null; });
    document.addEventListener('keydown', function (e) {
      if (e.target && e.target.tagName === 'INPUT') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && J.sel) { e.preventDefault(); reciclar(); }
      if (e.key === 'Escape' && J.sel) { J.sel = null; actualizarLab(); }
    });
    window.addEventListener('resize', function () { if (!$('mesa').hidden) render.ajustar(); actualizarLab(); });

    // ¿Llegó un link de duelo?
    var m = location.hash.match(/#d=([A-Za-z0-9_-]+)/);
    if (m) {
      var d = BM.decodificarDuelo(m[1]);
      if (d) abrirDuelo(d);
      else pantalla('pInicio');
    } else {
      pantalla('pInicio');
    }
    requestAnimationFrame(cuadro);
  }

  BM.J = J; // para depurar desde la consola
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})(window.BM = window.BM || {});
