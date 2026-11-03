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

    // Mapa de fondo (arte de assets/mapas). Si no carga, queda el plano azul.
    var mapa = null;
    var infoMapa = BM.SPRITES && BM.SPRITES.mapas && BM.SPRITES.mapas.isla;
    if (infoMapa && typeof Image !== 'undefined') {
      var im = new Image();
      im.onload = function () { mapa = im; };
      im.src = infoMapa.src;
    }

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

    // Cámara: centro (x, y) y zoom z. En pantallas chicas sigue la pelea durante el combate.
    var cam = { x: W / 2, y: H / 2, z: 1 };
    var ZOOM_MAX = 2.1;

    function objetivoCamara(escena) {
      var chica = canvas.clientWidth > 0 && canvas.clientWidth < 560;
      if (!escena.camaraAuto || !chica) return { x: W / 2, y: H / 2, z: 1 };
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, n = 0;
      (escena.unidades || []).forEach(function (u) {
        if (u.o && u.o.muerta) return;
        n++;
        if (u.x < x0) x0 = u.x; if (u.x > x1) x1 = u.x;
        if (u.y < y0) y0 = u.y; if (u.y > y1) y1 = u.y;
      });
      if (!n) return { x: cam.x, y: cam.y, z: cam.z };
      var margen = 70;
      var z = Math.min(W / (x1 - x0 + margen * 2), H / (y1 - y0 + margen * 2));
      z = Math.max(1, Math.min(ZOOM_MAX, z));
      return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: z };
    }

    function moverCamara(escena) {
      var obj = objetivoCamara(escena);
      var k = escena.camaraAuto ? 0.06 : 0.25;
      cam.z += (obj.z - cam.z) * k;
      cam.x += (obj.x - cam.x) * k;
      cam.y += (obj.y - cam.y) * k;
      if (Math.abs(cam.z - 1) < 0.002 && !escena.camaraAuto) { cam.z = 1; cam.x = W / 2; cam.y = H / 2; }
      // que la vista no se salga del mapa
      var mx = W / (2 * cam.z), my = H / (2 * cam.z);
      cam.x = Math.max(mx, Math.min(W - mx, cam.x));
      cam.y = Math.max(my, Math.min(H - my, cam.y));
    }

    // Pantalla → coordenadas del mundo (respeta la vista girada del jugador B y la cámara)
    function aMundo(clientX, clientY, girar) {
      var rect = canvas.getBoundingClientRect();
      var x = (clientX - rect.left) / rect.width * W;
      var y = (clientY - rect.top) / rect.height * H;
      if (girar) { x = W - x; y = H - y; }
      return { x: (x - W / 2) / cam.z + cam.x, y: (y - H / 2) / cam.z + cam.y };
    }

    function aPantalla(x, y, girar) {
      var sx = (x - cam.x) * cam.z + W / 2, sy = (y - cam.y) * cam.z + H / 2;
      return girar ? { x: W - sx, y: H - sy } : { x: sx, y: sy };
    }

    function transformarMundo(girar) {
      var b = dpr * escala, z = cam.z;
      if (girar) ctx.setTransform(-b * z, 0, 0, -b * z, b * (W / 2 + cam.x * z), b * (H / 2 + cam.y * z));
      else ctx.setTransform(b * z, 0, 0, b * z, b * (W / 2 - cam.x * z), b * (H / 2 - cam.y * z));
    }

    function dibujarFondo(escena) {
      if (!mapa) return dibujarFondoPlano(escena);
      var c = R.celda, zona = R.filasZona * c, neutral = R.filasNeutras * c;
      ctx.drawImage(mapa, 0, 0, W, H);
      var abajo = escena.girar ? COLOR.rival : COLOR.yo;
      var arriba = escena.girar ? COLOR.yo : COLOR.rival;
      // grilla sutil, sólo mientras se despliega
      if (escena.grilla) {
        ctx.strokeStyle = 'rgba(20,30,10,0.16)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (var x = c; x < W; x += c) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, zona); ctx.moveTo(x + 0.5, zona + neutral); ctx.lineTo(x + 0.5, H); }
        for (var y = c; y <= zona; y += c) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
        for (y = zona + neutral; y < H; y += c) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
        ctx.stroke();
      }
      // límite de cada zona en el color de su dueño
      ctx.lineWidth = 3; ctx.setLineDash([10, 7]); ctx.globalAlpha = 0.85;
      ctx.strokeStyle = arriba;
      ctx.beginPath(); ctx.moveTo(0, zona - 1.5); ctx.lineTo(W, zona - 1.5); ctx.stroke();
      ctx.strokeStyle = abajo;
      ctx.beginPath(); ctx.moveTo(0, zona + neutral + 1.5); ctx.lineTo(W, zona + neutral + 1.5); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }

    function dibujarFondoPlano(escena) {
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
      var e = BM.spritesListos && BM.spritesListos() ? 1.15 : ESCALA_VISUAL;
      ctx.save(); ctx.translate(x, y); ctx.scale(e, e);
      BM.dibujarBestia(ctx, 0, 0, b, o);
      ctx.restore();
    }

    function dibujar(escena) {
      moverCamara(escena);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#132c4f'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      transformarMundo(escena.girar);
      dibujarFondo(escena);

      var i, u;
      // celda resaltada (destino de arrastre / hover)
      if (escena.celda) {
        var cc = escena.celda;
        ctx.fillStyle = cc.valida ? 'rgba(244,178,62,0.22)' : 'rgba(226,72,106,0.25)';
        ctx.fillRect(cc.x - R.celda / 2, cc.y - R.celda / 2, R.celda, R.celda);
      }

      // zona propia teñida mientras hay una bestia lista para desplegar
      if (escena.colocar !== undefined) {
        var zy = R.filasZona * R.celda, ny = R.filasNeutras * R.celda;
        ctx.fillStyle = 'rgba(244,178,62,0.07)';
        ctx.fillRect(0, escena.colocar === 0 ? zy + ny : 0, W, zy);
      }
      // destello de la casilla donde se acaba de poner una bestia
      if (escena.destello) {
        var dd = escena.destello;
        ctx.fillStyle = 'rgba(244,178,62,' + (0.55 * dd.a).toFixed(3) + ')';
        ctx.fillRect(dd.x - R.celda / 2, dd.y - R.celda / 2, R.celda, R.celda);
        ctx.strokeStyle = 'rgba(255,236,190,' + dd.a.toFixed(3) + ')'; ctx.lineWidth = 2;
        ctx.strokeRect(dd.x - R.celda / 2 + 1, dd.y - R.celda / 2 + 1, R.celda - 2, R.celda - 2);
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
        var ev = BM.spritesListos && BM.spritesListos() ? 1.15 : ESCALA_VISUAL;
        var ancho = Math.max(18, u.b.radio * 2.2) * Math.sqrt(cam.z), yb = p.y - u.b.radio * 1.38 * ev * cam.z - 6;
        ctx.fillStyle = 'rgba(8,20,40,0.75)'; ctx.fillRect(p.x - ancho / 2 - 1, yb - 1, ancho + 2, 5);
        ctx.fillStyle = u.o.equipo; ctx.fillRect(p.x - ancho / 2, yb, ancho * Math.max(0, u.vida / u.b.vida), 3);
        if (u.veneno) {
          ctx.fillStyle = COLOR.veneno;
          for (var k = 0; k < u.veneno; k++) { ctx.beginPath(); ctx.arc(p.x - ancho / 2 + 3 + k * 5, yb - 5, 1.8, 0, Math.PI * 2); ctx.fill(); }
        }
        ctx.restore();
      }

      // pips de nivel bajo cada bestia (sólo nivel 2 y 3: el 1 es lo normal y ensucia el mapa)
      for (i = 0; i < lista.length; i++) {
        u = lista[i];
        if (!(u.nivel >= 2) || (u.o && u.o.muerta)) continue;
        var q = aPantalla(u.x, u.y, escena.girar);
        var evn = BM.spritesListos && BM.spritesListos() ? 1.15 : ESCALA_VISUAL;
        var py0 = q.y + u.b.radio * 1.38 * evn * cam.z + 4;
        var rp = 2.3, sep = 6.2, x0p = q.x - (u.nivel - 1) * sep / 2;
        ctx.save();
        ctx.setTransform(dpr * escala, 0, 0, dpr * escala, 0, 0);
        if (u.o && u.o.alfa !== undefined) ctx.globalAlpha = Math.max(0.6, u.o.alfa);
        ctx.fillStyle = 'rgba(8,20,40,0.78)';
        var ancho2 = (u.nivel - 1) * sep + rp * 2 + 4;
        ctx.fillRect(x0p - rp - 2, py0 - rp - 1.5, ancho2, rp * 2 + 3);
        ctx.fillStyle = (u.o && u.o.equipo) || COLOR.papel;
        for (var n = 0; n < u.nivel; n++) { ctx.beginPath(); ctx.arc(x0p + n * sep, py0, rp, 0, Math.PI * 2); ctx.fill(); }
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

      if (escena.grilla || !mapa) dibujarCotas(escena);
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
        ctx.font = '700 ' + Math.round(11 * Math.sqrt(cam.z)) + 'px "Atkinson Hyperlegible", system-ui, sans-serif';
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
