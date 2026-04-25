(function () {
  'use strict';

  var canvas = null;
  var ctx = null;
  var rafId = null;
  var listeners = [];
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var lastFrameTime = 0;

  var mouseRatioX = 0;
  var mouseRatioY = 0;
  var scrollY = 0;

  var stars = [];
  var sprites = {};

  var LAYERS = [
    { name: 'far',  count: 150, rMin: 0.5, rMax: 1.0, depth: 0.2 },
    { name: 'mid',  count: 80,  rMin: 1.0, rMax: 1.5, depth: 0.5 },
    { name: 'near', count: 30,  rMin: 1.5, rMax: 2.5, depth: 1.0 }
  ];

  var TINT_COOL = [232, 224, 255];
  var TINT_WARM = [255, 232, 220];

  function makeStarSprite(maxRadius, rgb) {
    var size = Math.ceil(maxRadius * 4);
    var c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    var sctx = c.getContext('2d');
    var center = size / 2;
    var grad = sctx.createRadialGradient(center, center, 0, center, center, maxRadius * 2);
    var rgbStr = rgb[0] + ',' + rgb[1] + ',' + rgb[2];
    grad.addColorStop(0, 'rgba(' + rgbStr + ',1)');
    grad.addColorStop(0.3, 'rgba(' + rgbStr + ',0.6)');
    grad.addColorStop(1, 'rgba(' + rgbStr + ',0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, size, size);
    return c;
  }

  function buildSprites() {
    sprites = {};
    for (var i = 0; i < LAYERS.length; i++) {
      var L = LAYERS[i];
      sprites[L.name + '_cool'] = makeStarSprite(L.rMax, TINT_COOL);
      sprites[L.name + '_warm'] = makeStarSprite(L.rMax, TINT_WARM);
    }
  }

  function buildStars() {
    stars = [];
    for (var i = 0; i < LAYERS.length; i++) {
      var L = LAYERS[i];
      for (var j = 0; j < L.count; j++) {
        stars.push({
          layer: L.name,
          depth: L.depth,
          xNorm: Math.random(),
          yNorm: Math.random(),
          baseAlpha: 0.4 + Math.random() * 0.5,
          warm: Math.random() < 0.1,
          phase: Math.random() * Math.PI * 2,
          period: 3000 + Math.random() * 4000
        });
      }
    }
  }

  function onMouseMoveParallax(e) {
    var w = window.innerWidth;
    var h = window.innerHeight;
    mouseRatioX = (e.clientX - w / 2) / (w / 2);
    mouseRatioY = (e.clientY - h / 2) / (h / 2);
  }

  function onScrollParallax() {
    scrollY = window.scrollY || window.pageYOffset || 0;
  }

  function drawStars() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var t = lastFrameTime;
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var sprite = sprites[s.layer + (s.warm ? '_warm' : '_cool')];
      var breath = 0.8 + 0.2 * Math.sin((t / s.period) * Math.PI * 2 + s.phase);
      var offsetX = mouseRatioX * s.depth * 12;
      var offsetY = mouseRatioY * s.depth * 12 + scrollY * s.depth * 0.05;
      var x = s.xNorm * w - sprite.width / 2 + offsetX;
      var y = s.yNorm * h - sprite.height / 2 + offsetY;
      ctx.globalAlpha = s.baseAlpha * breath;
      ctx.drawImage(sprite, x, y);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'universe-canvas';
    document.body.insertBefore(canvas, document.body.firstChild);
    ctx = canvas.getContext('2d');
    sizeCanvas();
  }

  function sizeCanvas() {
    if (!canvas) return;
    var w = window.innerWidth;
    var h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function on(target, ev, fn, opts) {
    target.addEventListener(ev, fn, opts);
    listeners.push({ target: target, ev: ev, fn: fn, opts: opts });
  }

  function offAll() {
    for (var i = 0; i < listeners.length; i++) {
      var l = listeners[i];
      l.target.removeEventListener(l.ev, l.fn, l.opts);
    }
    listeners = [];
  }

  function loop(t) {
    rafId = requestAnimationFrame(loop);
    lastFrameTime = t;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    drawStars();
  }

  function onVisibility() {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    } else if (!rafId) {
      rafId = requestAnimationFrame(loop);
    }
  }

  function activate() {
    ensureCanvas();
    canvas.style.display = 'block';
    if (!stars.length) buildStars();
    if (!sprites.far_cool) buildSprites();
    on(window, 'resize', sizeCanvas);
    on(document, 'visibilitychange', onVisibility);
    on(window, 'mousemove', onMouseMoveParallax);
    on(window, 'scroll', onScrollParallax, { passive: true });
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  function deactivate() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    offAll();
    if (canvas) {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      canvas.style.display = 'none';
    }
  }

  window.Universe = {
    activate: activate,
    deactivate: deactivate
  };
})();
