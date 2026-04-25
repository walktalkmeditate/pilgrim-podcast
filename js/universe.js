(function () {
  'use strict';

  var canvas = null;
  var ctx = null;
  var rafId = null;
  var listeners = [];
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var lastFrameTime = 0;

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
    // layers added in later tasks
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
    on(window, 'resize', sizeCanvas);
    on(document, 'visibilitychange', onVisibility);
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
