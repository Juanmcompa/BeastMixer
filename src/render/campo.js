/*
 * BeastMixer — Render del campo de batalla (canvas 2D).
 * Sólo dibuja lo que le pasan en "escena"; no conoce reglas ni estado de juego.
 */
(function (BM) {
  'use strict';

  var R = BM.REGLAS;
  var COLOR = {
    fondo: '#1f4a80', fondoOscuro: '#183d6c', linea: 'rgba(220,232,243,0.11)',
    lineaFuerte: 'rgba(220,232,243,0.32)', papel: '#dce8f3',
    yo: '#f4b23e', rival: '#e2486a', veneno: '#9be36b'
  };
  BM.COLOR = COLOR;

  function crearRenderCampo(canvas) {
    var ctx = canvas.getContext('2d');
    var W = BM.CAMPO.ancho, H = BM.CAMPO.alto;
    var escala = 1, dpr = 1;

    function ajustar() {
      var cont = canvas.parentElement;
      var maxW = cont.clientWidth, maxH = cont.clientHeight;
      escala = Math.min(maxW / W, maxH / H);
      if (!isFinite(escala) || escala <= 0) escala = 1;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.style.width = Math.floor(W * escala) + 'px';
      canvas.style.height = Math.floor(H * escala) + 'px';
      canvas.width = Math.floor(W * escala * dpr);
      canvas.height = Math.floor(H * escala * dpr);
    }

    // Pantalla → coordenadas del mundo (respeta la vista girada del jugador B)
    function aMundo(clientX, clientY, girar) {
      var rect = canvas.getBoundingClientRect();
      var x = (clientX - rect.left) / rect.width * W;
      var y = (clientY - rect.top) / rect.height * H;
      if (girar) { x = W - x; y = H - y; }
      return { x: x, y: y };
    }

    function aPantalla(x, y, girar) { return girar ? { x: W - x, y: H - y } : { x: x, y: y }; }

    function dibujarFondo(escena) {
      var c = R.celda, zona = R.filasZona * c, neutral = R.filasNeutras * c;
      ctx.fillStyle = COLOR.fondo; ctx.fillRect(0, 0, W, H);
      // zona neutral algo más oscura
      ctx.fillStyle = COLOR.fondoOscuro; ctx.fillRect(0, zona, W, neutral);

      // tinte de cada zona (en coordenadas de mundo: bando 0 abajo)
      var abajo = escena.girar ? COLOR.rival : COLOR.yo;
      var arriba = escena.girar ? COLOR.yo : COLOR.rival;
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = arriba; ctx.fillRect(0, 0, W, zona);
      ctx.fillStyle = abajo; ctx.fillRect(0, zona + neutral, W, zona);
      ctx.globalAlpha = 1;

      // grilla
      ctx.strokeStyle = COLOR.linea; ctx.lineWidth = 1;
      ctx.beginPath();
      for (var x = c; x < W; x += c) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
      for (var y = c; y < H; y += c) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
      ctx.stroke();

      // bordes de zona
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = arriba; ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.moveTo(0, zona); ctx.lineTo(W, zona); ctx.stroke();
      ctx.strokeStyle = abajo;
      ctx.beginPath(); ctx.moveTo(0, zona + neutral); ctx.lineTo(W, zona + neutral); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      // eje central del plano
      ctx.strokeStyle = COLOR.lineaFuerte; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 34, 0, Math.PI * 2); ctx.stroke();
    }

    function dibujarCotas(escena) {
      // marcas de plano en los bordes (letras de columna en tu lado)
      ctx.save();
      ctx.setTransform(dpr * escala, 0, 0, dpr * escala, 0, 0);
      ctx.fillStyle = 'rgba(220,232,243,0.45)';
      ctx.font = '600 9px "Atkinson Hyperlegible", system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (var i = 0; i < R.columnas; i++) {
        ctx.fillText('ABCDEFGHIJKL'[i], (i + 0.5) * R.celda, H - 4);
      }
      ctx.restore();
    }

    // Las bestias se dibujan más grandes que su radio de colisión, para que se lean.
    var ESCALA_VISUAL = 1.4;
    function bestiaGrande(x, y, b, o) {
      ctx.save(); ctx.translate(x, y); ctx.scale(ESCALA_VISUAL, ESCALA_VISUAL);
      BM.dibujarBestia(ctx, 0, 0, b, o);
      ctx.restore();
    }

    function dibujar(escena) {
      ctx.setTransform(dpr * escala, 0, 0, dpr * escala, 0, 0);
      if (escena.girar) ctx.setTransform(-dpr * escala, 0, 0, -dpr * escala, W * dpr * escala, H * dpr * escala);
      dibujarFondo(escena);

      var i, u;
      // celda resaltada (destino de arrastre / hover)
      if (escena.celda) {
        var cc = escena.celda;
        ctx.fillStyle = cc.valida ? 'rgba(244,178,62,0.22)' : 'rgba(226,72,106,0.25)';
        ctx.fillRect(cc.x - R.celda / 2, cc.y - R.celda / 2, R.celda, R.celda);
      }

      // muertos primero (quedan debajo)
      var lista = escena.unidades || [];
      for (i = 0; i < lista.length; i++) { u = lista[i]; if (u.o && u.o.muerta) bestiaGrande(u.x, u.y, u.b, u.o); }
      for (i = 0; i < lista.length; i++) { u = lista[i]; if (!(u.o && u.o.muerta)) bestiaGrande(u.x, u.y, u.b, u.o); }

      // barras de vida y veneno
      for (i = 0; i < lista.length; i++) {
        u = lista[i];
        if (u.vida === undefined || (u.o && u.o.muerta)) continue;
        var p = aPantalla(u.x, u.y, escena.girar);
        ctx.save();
        ctx.setTransform(dpr * escala, 0, 0, dpr * escala, 0, 0);
        var ancho = Math.max(18, u.b.radio * 2.2), yb = p.y - u.b.radio * 1.38 * ESCALA_VISUAL - 6;
        ctx.fillStyle = 'rgba(8,20,40,0.75)'; ctx.fillRect(p.x - ancho / 2 - 1, yb - 1, ancho + 2, 5);
        ctx.fillStyle = u.o.equipo; ctx.fillRect(p.x - ancho / 2, yb, ancho * Math.max(0, u.vida / u.b.vida), 3);
        if (u.veneno) {
          ctx.fillStyle = COLOR.veneno;
          for (var k = 0; k < u.veneno; k++) { ctx.beginPath(); ctx.arc(p.x - ancho / 2 + 3 + k * 5, yb - 5, 1.8, 0, Math.PI * 2); ctx.fill(); }
        }
        ctx.restore();
      }

      // selección
      if (escena.seleccion) {
        var s = escena.seleccion;
        ctx.strokeStyle = COLOR.papel; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 1.38 * ESCALA_VISUAL + 5, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }

      // fantasma (diseño por desplegar)
      if (escena.fantasma) {
        var f = escena.fantasma;
        bestiaGrande(f.x, f.y, f.b, { alfa: f.valido ? 0.6 : 0.25, equipo: f.valido ? COLOR.yo : COLOR.rival, ang: escena.girar ? Math.PI : 0, sinSombra: true });
      }

      // efectos
      var ef = escena.efectos || [];
      for (i = 0; i < ef.length; i++) dibujarEfecto(ef[i], escena.girar);

      dibujarCotas(escena);
    }

    function dibujarEfecto(e, girar) {
      var a = Math.max(0, e.t / e.dur);
      if (e.tipo === 'proyectil') {
        var k = 1 - a;
        var px = e.x + (e.x2 - e.x) * k, py = e.y + (e.y2 - e.y) * k;
        ctx.fillStyle = e.color; ctx.globalAlpha = 0.95;
        ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (e.tipo === 'lengua') {
        ctx.strokeStyle = '#ff8fb1'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.globalAlpha = a;
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x2, e.y2); ctx.stroke(); ctx.globalAlpha = 1;
      } else if (e.tipo === 'area') {
        ctx.strokeStyle = COLOR.papel; ctx.lineWidth = 2; ctx.globalAlpha = a;
        ctx.beginPath(); ctx.arc(e.x, e.y, 50 * (1.2 - a * 0.5), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      } else if (e.tipo === 'muerte') {
        ctx.strokeStyle = e.color; ctx.lineWidth = 2; ctx.globalAlpha = a;
        for (var i = 0; i < 6; i++) {
          var ang = i * Math.PI / 3, r1 = 10 + (1 - a) * 18, r2 = r1 + 6;
          ctx.beginPath(); ctx.moveTo(e.x + Math.cos(ang) * r1, e.y + Math.sin(ang) * r1);
          ctx.lineTo(e.x + Math.cos(ang) * r2, e.y + Math.sin(ang) * r2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (e.tipo === 'texto') {
        var p = aPantalla(e.x, e.y, girar);
        ctx.save();
        ctx.setTransform(dpr * escala, 0, 0, dpr * escala, 0, 0);
        ctx.globalAlpha = Math.min(1, a * 1.5);
        ctx.font = '700 11px "Atkinson Hyperlegible", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = e.color;
        ctx.fillText(e.texto, p.x, p.y - (1 - a) * 18);
        ctx.restore();
      }
    }

    return { ajustar: ajustar, dibujar: dibujar, aMundo: aMundo };
  }

  BM.crearRenderCampo = crearRenderCampo;
})(typeof window !== 'undefined' ? (window.BM = window.BM || {}) : (globalThis.BM = globalThis.BM || {}));
