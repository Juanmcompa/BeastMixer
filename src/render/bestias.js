/*
 * BeastMixer — Dibujo procedural de bestias (vista cenital, mirando hacia arriba).
 *
 * Cada parte se dibuja con la paleta de SU animal: así una "Aratuga saltarín"
 * se ve con cabeza de araña, caparazón de tortuga y patas de rana.
 * No hay sprites: todo es canvas 2D, para iterar rápido el diseño.
 * Unidad de medida: r = radio del torso.
 */
(function (BM) {
  'use strict';

  function col(id) { return BM.animalPorId(id).color; }

  function elipse(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2);
  }

  function relleno(ctx, color, borde, ancho) {
    ctx.fillStyle = color; ctx.fill();
    if (borde) { ctx.strokeStyle = borde; ctx.lineWidth = ancho || 1; ctx.stroke(); }
  }

  // ── PATAS ────────────────────────────────────────────────────────────────
  function pataRecta(ctx, x, y, ang, largo, ancho, color, borde) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(-ancho / 2, 0); ctx.lineTo(-ancho * 0.4, -largo); ctx.lineTo(ancho * 0.4, -largo); ctx.lineTo(ancho / 2, 0);
    ctx.closePath(); relleno(ctx, color, borde, 1);
    elipse(ctx, 0, -largo, ancho * 0.55, ancho * 0.45); relleno(ctx, borde);
    ctx.restore();
  }

  function pataArticulada(ctx, x, y, ang, largo, ancho, color, doblez) {
    var a1 = ang, a2 = ang + doblez;
    var mx = x + Math.sin(a1) * largo * 0.55, my = y - Math.cos(a1) * largo * 0.55;
    var fx = mx + Math.sin(a2) * largo * 0.6, fy = my - Math.cos(a2) * largo * 0.6;
    ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = ancho;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(mx, my); ctx.lineTo(fx, fy); ctx.stroke();
  }

  function dibujarPatas(ctx, id, r, fase) {
    var c = col(id);
    var sw = Math.sin(fase) * 0.35, sw2 = Math.sin(fase + Math.PI) * 0.35;
    var i, lado;
    switch (id) {
      case 'lobo':
        for (lado = -1; lado <= 1; lado += 2) {
          pataRecta(ctx, lado * 0.45 * r, -0.45 * r, lado * (1.1 + sw), 0.75 * r, 0.24 * r, c.base, c.oscuro);
          pataRecta(ctx, lado * 0.45 * r, 0.5 * r, lado * (2.0 + sw2), 0.75 * r, 0.24 * r, c.base, c.oscuro);
        }
        break;
      case 'tortuga':
        for (lado = -1; lado <= 1; lado += 2) {
          pataRecta(ctx, lado * 0.6 * r, -0.5 * r, lado * (0.9 + sw * 0.5), 0.45 * r, 0.36 * r, c.base, c.oscuro);
          pataRecta(ctx, lado * 0.6 * r, 0.55 * r, lado * (2.2 + sw2 * 0.5), 0.42 * r, 0.36 * r, c.base, c.oscuro);
        }
        break;
      case 'arana':
        for (lado = -1; lado <= 1; lado += 2) {
          for (i = 0; i < 4; i++) {
            var osc = (i % 2 ? sw : sw2) * 0.6;
            pataArticulada(ctx, lado * 0.3 * r, (-0.35 + i * 0.25) * r, lado * (0.55 + i * 0.55 + osc), 1.35 * r, Math.max(1, 0.1 * r), c.oscuro, lado * 0.7);
          }
        }
        break;
      case 'rino':
        for (lado = -1; lado <= 1; lado += 2) {
          pataRecta(ctx, lado * 0.5 * r, -0.45 * r, lado * (1.2 + sw * 0.6), 0.55 * r, 0.36 * r, c.base, c.oscuro);
          pataRecta(ctx, lado * 0.5 * r, 0.5 * r, lado * (1.9 + sw2 * 0.6), 0.55 * r, 0.36 * r, c.base, c.oscuro);
        }
        break;
      case 'escorpion':
        for (lado = -1; lado <= 1; lado += 2) {
          for (i = 0; i < 3; i++) {
            pataArticulada(ctx, lado * 0.35 * r, (-0.2 + i * 0.3) * r, lado * (1.0 + i * 0.5 + (i % 2 ? sw : sw2) * 0.5), 1.0 * r, Math.max(1, 0.12 * r), c.oscuro, lado * 0.6);
          }
        }
        break;
      case 'puercoespin':
        for (lado = -1; lado <= 1; lado += 2) {
          pataRecta(ctx, lado * 0.5 * r, -0.4 * r, lado * (1.2 + sw), 0.45 * r, 0.26 * r, c.oscuro, '#1d140c');
          pataRecta(ctx, lado * 0.5 * r, 0.45 * r, lado * (2.0 + sw2), 0.45 * r, 0.26 * r, c.oscuro, '#1d140c');
        }
        break;
      case 'elefante':
        for (lado = -1; lado <= 1; lado += 2) {
          pataRecta(ctx, lado * 0.55 * r, -0.4 * r, lado * (1.3 + sw * 0.4), 0.48 * r, 0.46 * r, c.base, c.oscuro);
          pataRecta(ctx, lado * 0.55 * r, 0.45 * r, lado * (1.85 + sw2 * 0.4), 0.48 * r, 0.46 * r, c.base, c.oscuro);
        }
        break;
      case 'rana':
        for (lado = -1; lado <= 1; lado += 2) {
          pataRecta(ctx, lado * 0.45 * r, -0.45 * r, lado * (0.8 + sw * 0.4), 0.45 * r, 0.18 * r, c.base, c.oscuro);
          // pata trasera plegada en Z, enorme
          pataArticulada(ctx, lado * 0.45 * r, 0.45 * r, lado * (2.3 + sw2 * 0.4), 1.15 * r, 0.3 * r, c.base, lado * -1.6);
          pataArticulada(ctx, lado * 0.45 * r, 0.45 * r, lado * (2.3 + sw2 * 0.4), 1.15 * r, 0.12 * r, c.oscuro, lado * -1.6);
        }
        break;
    }
  }

  // ── TORSO ────────────────────────────────────────────────────────────────
  function dibujarTorso(ctx, id, r) {
    var c = col(id), i, a;
    switch (id) {
      case 'lobo':
        // cola
        ctx.beginPath(); ctx.moveTo(-0.2 * r, 0.8 * r); ctx.quadraticCurveTo(0.35 * r, 1.4 * r, 0.05 * r, 1.75 * r);
        ctx.quadraticCurveTo(-0.3 * r, 1.4 * r, -0.2 * r, 0.8 * r); relleno(ctx, c.base, c.oscuro);
        elipse(ctx, 0.05 * r, 1.62 * r, 0.12 * r, 0.16 * r); relleno(ctx, c.acento);
        elipse(ctx, 0, 0, 0.72 * r, r); relleno(ctx, c.base, c.oscuro, 1.2);
        elipse(ctx, 0, 0.05 * r, 0.32 * r, 0.75 * r); relleno(ctx, c.oscuro);
        break;
      case 'tortuga':
        elipse(ctx, 0, 0, 0.98 * r, 1.04 * r); relleno(ctx, c.oscuro, '#24361a', 1.5);
        ctx.strokeStyle = c.acento; ctx.lineWidth = Math.max(1, 0.06 * r);
        ctx.fillStyle = c.base;
        // placa central + anillo de seis
        hexagono(ctx, 0, 0, 0.36 * r); ctx.fill(); ctx.stroke();
        for (i = 0; i < 6; i++) {
          a = i * Math.PI / 3 + Math.PI / 6;
          hexagono(ctx, Math.cos(a) * 0.62 * r, Math.sin(a) * 0.64 * r, 0.27 * r); ctx.fill(); ctx.stroke();
        }
        break;
      case 'arana':
        elipse(ctx, 0, 0.25 * r, 0.82 * r, 0.95 * r); relleno(ctx, c.base, c.oscuro, 1.2);
        elipse(ctx, 0, -0.55 * r, 0.42 * r, 0.4 * r); relleno(ctx, c.oscuro);
        // reloj de arena
        ctx.beginPath();
        ctx.moveTo(-0.2 * r, 0.0); ctx.lineTo(0.2 * r, 0.0); ctx.lineTo(0, 0.28 * r);
        ctx.lineTo(0.2 * r, 0.56 * r); ctx.lineTo(-0.2 * r, 0.56 * r); ctx.lineTo(0, 0.28 * r); ctx.closePath();
        relleno(ctx, c.acento);
        break;
      case 'rino':
        elipse(ctx, 0, 0, 0.8 * r, r); relleno(ctx, c.base, c.oscuro, 1.4);
        ctx.strokeStyle = c.oscuro; ctx.lineWidth = Math.max(1, 0.07 * r);
        for (i = -1; i <= 1; i++) {
          ctx.beginPath(); ctx.arc(0, i * 0.4 * r, 0.62 * r, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(0, 0.95 * r); ctx.lineTo(0, 1.25 * r); ctx.stroke();
        break;
      case 'escorpion':
        // cola segmentada que se curva hacia adelante, con aguijón
        var segs = [[0, 0.95], [0.12, 1.3], [0.32, 1.55], [0.55, 1.6], [0.72, 1.4]];
        for (i = 0; i < segs.length; i++) {
          elipse(ctx, segs[i][0] * r, segs[i][1] * r, 0.22 * r, 0.2 * r); relleno(ctx, c.base, c.oscuro, 1);
        }
        ctx.beginPath(); ctx.moveTo(0.72 * r, 1.25 * r); ctx.lineTo(0.62 * r, 0.95 * r); ctx.lineTo(0.9 * r, 1.22 * r);
        ctx.closePath(); relleno(ctx, c.acento);
        for (i = 0; i < 4; i++) {
          elipse(ctx, 0, (-0.45 + i * 0.36) * r, (0.62 - i * 0.07) * r, 0.26 * r); relleno(ctx, c.base, c.oscuro, 1.2);
        }
        break;
      case 'puercoespin':
        elipse(ctx, 0, 0.05 * r, 0.82 * r, 0.98 * r); relleno(ctx, c.oscuro);
        ctx.lineCap = 'round';
        for (i = 0; i < 26; i++) {
          a = (i / 26) * Math.PI * 2;
          var largo = (i % 2 ? 1.35 : 1.15) * r;
          if (Math.sin(a) < -0.75) largo *= 0.75; // menos púas hacia la cabeza
          ctx.strokeStyle = c.acento; ctx.lineWidth = Math.max(1, 0.09 * r);
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * 0.4 * r, Math.sin(a) * 0.45 * r + 0.05 * r);
          ctx.lineTo(Math.cos(a) * largo, Math.sin(a) * largo + 0.05 * r); ctx.stroke();
        }
        elipse(ctx, 0, 0.05 * r, 0.5 * r, 0.62 * r); relleno(ctx, c.base);
        break;
      case 'elefante':
        ctx.strokeStyle = c.oscuro; ctx.lineWidth = Math.max(1, 0.06 * r);
        ctx.beginPath(); ctx.moveTo(0, 0.95 * r); ctx.quadraticCurveTo(0.15 * r, 1.2 * r, 0.05 * r, 1.35 * r); ctx.stroke();
        elipse(ctx, 0, 0, 0.86 * r, r); relleno(ctx, c.base, c.oscuro, 1.4);
        ctx.strokeStyle = c.oscuro; ctx.lineWidth = Math.max(0.8, 0.04 * r);
        for (i = 0; i < 4; i++) {
          ctx.beginPath(); ctx.arc(0, (-0.3 + i * 0.3) * r, 0.5 * r, Math.PI * 0.2, Math.PI * 0.45); ctx.stroke();
          ctx.beginPath(); ctx.arc(0, (-0.3 + i * 0.3) * r, 0.5 * r, Math.PI * 0.55, Math.PI * 0.8); ctx.stroke();
        }
        break;
      case 'rana':
        elipse(ctx, 0, 0.05 * r, 0.8 * r, 0.95 * r); relleno(ctx, c.base, c.oscuro, 1.2);
        var manchas = [[-0.35, -0.2, 0.16], [0.3, 0.1, 0.2], [-0.15, 0.45, 0.14], [0.25, -0.45, 0.11], [-0.4, 0.3, 0.09]];
        for (i = 0; i < manchas.length; i++) {
          elipse(ctx, manchas[i][0] * r, manchas[i][1] * r, manchas[i][2] * r, manchas[i][2] * r * 0.85); relleno(ctx, c.oscuro);
        }
        break;
    }
  }

  function hexagono(ctx, x, y, rr) {
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3;
      var px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  // ── CABEZA ───────────────────────────────────────────────────────────────
  // (dibujada con su centro en 0,0; el frente es -y)
  function dibujarCabeza(ctx, id, h, fase) {
    var c = col(id), i, lado;
    switch (id) {
      case 'lobo':
        for (lado = -1; lado <= 1; lado += 2) {
          ctx.beginPath(); ctx.moveTo(lado * 0.25 * h, -0.2 * h); ctx.lineTo(lado * 0.75 * h, 0.05 * h); ctx.lineTo(lado * 0.6 * h, -0.65 * h);
          ctx.closePath(); relleno(ctx, c.oscuro);
        }
        elipse(ctx, 0, 0.1 * h, 0.6 * h, 0.62 * h); relleno(ctx, c.base, c.oscuro, 1);
        ctx.beginPath(); ctx.moveTo(-0.32 * h, -0.2 * h); ctx.lineTo(0, -1.05 * h); ctx.lineTo(0.32 * h, -0.2 * h); ctx.closePath();
        relleno(ctx, c.acento, c.oscuro, 1);
        elipse(ctx, 0, -0.98 * h, 0.13 * h, 0.1 * h); relleno(ctx, '#1b1b1f');
        ojos(ctx, 0.25 * h, -0.15 * h, 0.09 * h, '#f2c14e');
        break;
      case 'tortuga':
        elipse(ctx, 0, -0.1 * h, 0.45 * h, 0.7 * h); relleno(ctx, c.base, c.oscuro, 1);
        ctx.beginPath(); ctx.moveTo(-0.2 * h, -0.65 * h); ctx.lineTo(0, -0.88 * h); ctx.lineTo(0.2 * h, -0.65 * h); ctx.closePath();
        relleno(ctx, c.oscuro);
        ojos(ctx, 0.26 * h, -0.3 * h, 0.08 * h, '#111');
        break;
      case 'arana':
        ctx.strokeStyle = c.acento; ctx.lineWidth = Math.max(1, 0.12 * h); ctx.lineCap = 'round';
        for (lado = -1; lado <= 1; lado += 2) {
          ctx.beginPath(); ctx.moveTo(lado * 0.2 * h, -0.4 * h); ctx.quadraticCurveTo(lado * 0.35 * h, -0.85 * h, lado * 0.08 * h, -0.95 * h); ctx.stroke();
        }
        elipse(ctx, 0, 0, 0.5 * h, 0.5 * h); relleno(ctx, c.base, c.oscuro, 1);
        var ojosA = [[-0.18, -0.25, 0.1], [0.18, -0.25, 0.1], [-0.32, -0.08, 0.07], [0.32, -0.08, 0.07],
          [-0.08, -0.08, 0.06], [0.08, -0.08, 0.06], [-0.22, 0.1, 0.05], [0.22, 0.1, 0.05]];
        for (i = 0; i < ojosA.length; i++) {
          elipse(ctx, ojosA[i][0] * h, ojosA[i][1] * h, ojosA[i][2] * h, ojosA[i][2] * h); relleno(ctx, c.acento);
        }
        break;
      case 'rino':
        for (lado = -1; lado <= 1; lado += 2) {
          elipse(ctx, lado * 0.42 * h, 0.35 * h, 0.14 * h, 0.24 * h, lado * 0.5); relleno(ctx, c.oscuro);
        }
        elipse(ctx, 0, 0, 0.48 * h, 0.85 * h); relleno(ctx, c.base, c.oscuro, 1.2);
        ctx.beginPath(); ctx.moveTo(-0.2 * h, -0.55 * h); ctx.quadraticCurveTo(0.05 * h, -1.2 * h, 0.08 * h, -1.45 * h);
        ctx.quadraticCurveTo(0.2 * h, -0.9 * h, 0.2 * h, -0.55 * h); ctx.closePath(); relleno(ctx, c.acento, c.oscuro, 1);
        ctx.beginPath(); ctx.moveTo(-0.12 * h, -0.2 * h); ctx.lineTo(0, -0.55 * h); ctx.lineTo(0.12 * h, -0.2 * h); ctx.closePath();
        relleno(ctx, c.acento);
        ojos(ctx, 0.36 * h, 0.05 * h, 0.07 * h, '#111');
        break;
      case 'escorpion':
        for (lado = -1; lado <= 1; lado += 2) {
          var abre = Math.sin(fase * 2) * 0.12;
          ctx.strokeStyle = c.base; ctx.lineWidth = Math.max(1.5, 0.22 * h); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(lado * 0.3 * h, -0.1 * h); ctx.lineTo(lado * 0.85 * h, -0.55 * h); ctx.lineTo(lado * 0.7 * h, -1.05 * h); ctx.stroke();
          // pinza
          ctx.save(); ctx.translate(lado * 0.7 * h, -1.15 * h);
          elipse(ctx, 0, 0, 0.28 * h, 0.38 * h); relleno(ctx, c.base, c.oscuro, 1);
          ctx.beginPath(); ctx.moveTo(-lado * 0.05 * h, -0.2 * h); ctx.lineTo(-lado * (0.15 + abre) * h, -0.6 * h); ctx.lineTo(lado * 0.12 * h, -0.25 * h); ctx.closePath();
          relleno(ctx, c.oscuro);
          ctx.restore();
        }
        elipse(ctx, 0, 0, 0.45 * h, 0.42 * h); relleno(ctx, c.base, c.oscuro, 1);
        ojos(ctx, 0.12 * h, -0.2 * h, 0.07 * h, '#111');
        break;
      case 'puercoespin':
        ctx.beginPath(); ctx.moveTo(-0.45 * h, 0.2 * h); ctx.quadraticCurveTo(-0.35 * h, -0.6 * h, 0, -0.95 * h);
        ctx.quadraticCurveTo(0.35 * h, -0.6 * h, 0.45 * h, 0.2 * h); ctx.closePath(); relleno(ctx, c.base, c.oscuro, 1);
        elipse(ctx, 0, -0.9 * h, 0.12 * h, 0.1 * h); relleno(ctx, '#1b1209');
        ojos(ctx, 0.2 * h, -0.25 * h, 0.07 * h, '#111');
        break;
      case 'elefante':
        for (lado = -1; lado <= 1; lado += 2) {
          elipse(ctx, lado * 0.62 * h, 0.15 * h, 0.5 * h, 0.62 * h, lado * 0.25); relleno(ctx, c.oscuro, '#3c424c', 1);
        }
        // trompa
        var bal = Math.sin(fase * 1.3) * 0.25 * h;
        ctx.strokeStyle = c.base; ctx.lineWidth = Math.max(2, 0.3 * h); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, -0.4 * h); ctx.quadraticCurveTo(bal, -0.95 * h, -bal * 0.6, -1.35 * h); ctx.stroke();
        ctx.strokeStyle = c.oscuro; ctx.lineWidth = Math.max(0.8, 0.06 * h);
        ctx.beginPath(); ctx.moveTo(0, -0.4 * h); ctx.quadraticCurveTo(bal, -0.95 * h, -bal * 0.6, -1.35 * h); ctx.stroke();
        for (lado = -1; lado <= 1; lado += 2) {
          ctx.beginPath(); ctx.moveTo(lado * 0.2 * h, -0.35 * h); ctx.quadraticCurveTo(lado * 0.38 * h, -0.75 * h, lado * 0.22 * h, -0.95 * h);
          ctx.strokeStyle = c.acento; ctx.lineWidth = Math.max(1.2, 0.12 * h); ctx.stroke();
        }
        elipse(ctx, 0, 0, 0.5 * h, 0.55 * h); relleno(ctx, c.base, c.oscuro, 1.2);
        ojos(ctx, 0.3 * h, -0.12 * h, 0.07 * h, '#111');
        break;
      case 'rana':
        elipse(ctx, 0, 0, 0.75 * h, 0.5 * h); relleno(ctx, c.base, c.oscuro, 1);
        ctx.strokeStyle = c.oscuro; ctx.lineWidth = Math.max(1, 0.06 * h);
        ctx.beginPath(); ctx.arc(0, -0.05 * h, 0.55 * h, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        for (lado = -1; lado <= 1; lado += 2) {
          elipse(ctx, lado * 0.42 * h, 0.05 * h, 0.24 * h, 0.24 * h); relleno(ctx, c.acento, c.oscuro, 1);
          elipse(ctx, lado * 0.42 * h, 0.02 * h, 0.08 * h, 0.13 * h); relleno(ctx, '#111');
        }
        break;
    }
  }

  function ojos(ctx, sep, y, rr, color) {
    elipse(ctx, -sep, y, rr, rr); relleno(ctx, color);
    elipse(ctx, sep, y, rr, rr); relleno(ctx, color);
  }

  // Desplazamiento de la cabeza respecto del centro del torso.
  function anclajeCabeza(tor, r) {
    var off = { lobo: 0.95, tortuga: 1.0, arana: 0.85, rino: 0.98, escorpion: 0.65, puercoespin: 0.9, elefante: 0.95, rana: 0.85 };
    return -(off[tor] || 0.95) * r;
  }

  /*
   * Dibuja una bestia completa.
   * b: { cab, tor, pat, radio, tamCabeza }  (sirve el resultado de BM.ensamblar)
   * o: { ang, fase, equipo, golpeado, veneno, muerta, atacando, alfa, sinSombra }
   */
  function dibujarBestia(ctx, x, y, b, o) {
    o = o || {};
    var r = b.radio, h = r * 0.78 * (b.tamCabeza || 1);
    ctx.save();
    ctx.translate(x, y);
    if (o.alfa !== undefined) ctx.globalAlpha = o.alfa;
    if (o.muerta) ctx.globalAlpha *= 0.32;

    if (!o.sinSombra) {
      elipse(ctx, 0, r * 0.25, r * 1.25, r * 1.1); ctx.fillStyle = 'rgba(5,15,35,0.35)'; ctx.fill();
    }
    if (o.equipo) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = o.equipo;
      elipse(ctx, 0, 0, r * 1.38, r * 1.38); ctx.stroke();
    }

    ctx.rotate(o.ang || 0);
    var fase = o.fase || 0;
    dibujarPatas(ctx, b.pat, r, fase);
    dibujarTorso(ctx, b.tor, r);
    ctx.save();
    ctx.translate(0, anclajeCabeza(b.tor, r) - h * 0.35 - (o.atacando ? r * 0.25 : 0));
    dibujarCabeza(ctx, b.cab, h, fase);
    ctx.restore();

    ctx.restore();

    if (o.golpeado && !o.muerta) {
      ctx.save(); ctx.translate(x, y);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
      elipse(ctx, 0, 0, r * 1.05, r * 1.05); ctx.stroke();
      ctx.restore();
    }
  }

  // Ícono de UNA parte (para los selectores del laboratorio).
  function dibujarParte(ctx, parte, id, tam) {
    var r = tam * 0.34;
    ctx.save();
    ctx.translate(tam / 2, tam / 2);
    if (parte === 'cabeza') {
      var a = BM.animalPorId(id);
      var normal = { lobo: 0.4, tortuga: 0.44, arana: 0.46, rino: 0.32, escorpion: 0.33, puercoespin: 0.42, elefante: 0.3, rana: 0.5 };
      var h = tam * (normal[id] || 0.4);
      ctx.translate(0, h * 0.3);
      dibujarCabeza(ctx, id, h, 0.6);
    } else if (parte === 'torso') {
      var ajuste = { lobo: 0.72, escorpion: 0.68, puercoespin: 0.78, arana: 0.85, elefante: 0.9 };
      ctx.scale(ajuste[id] || 0.95, ajuste[id] || 0.95);
      ctx.translate(0, id === 'lobo' || id === 'escorpion' ? -r * 0.4 : -r * 0.05);
      dibujarTorso(ctx, id, r);
    } else {
      // patas sobre una silueta neutra
      dibujarPatas(ctx, id, r, 0.6);
      elipse(ctx, 0, 0, 0.72 * r, 0.95 * r);
      ctx.fillStyle = 'rgba(216,230,242,0.18)'; ctx.fill();
      ctx.setLineDash([2, 2]); ctx.strokeStyle = 'rgba(216,230,242,0.6)'; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
  }

  BM.dibujarBestia = dibujarBestia;
  BM.dibujarParte = dibujarParte;
  BM.anclajeCabeza = anclajeCabeza;
})(typeof window !== 'undefined' ? (window.BM = window.BM || {}) : (globalThis.BM = globalThis.BM || {}));
