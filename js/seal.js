(function (exports) {
  'use strict';

  var GUIDE_COLORS = {
    breeze: '#1B3A4B',
    drift: '#C2A68C',
    dusk: '#A8B8C0',
    ember: '#C8A050',
    river: '#A8D8D0',
    sage: '#C8B888',
    stone: '#B8956A'
  };

  var GUIDE_BELLS = {
    breeze: 'echo-chime',
    drift: 'gentle-harp',
    dusk: 'temple-bell',
    ember: 'warm-guitar',
    river: 'burma-bell',
    sage: 'yoga-chime',
    stone: 'clear-ring'
  };

  var R2_BASE = 'https://cdn.pilgrimapp.org';

  function bellUrl(guideId) {
    var bell = GUIDE_BELLS[guideId] || 'gentle-harp';
    return R2_BASE + '/audio/bell/' + bell + '.aac';
  }

  function guideColor(id) {
    return GUIDE_COLORS[id] || '#B8AFA2';
  }

  function hashBytes(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    var bytes = new Uint8Array(32);
    for (var i = 0; i < 32; i++) {
      h = ((h << 5) - h + i * 7) | 0;
      bytes[i] = Math.abs(h) % 256;
    }
    return bytes;
  }

  function parseWeather(weatherStr) {
    if (!weatherStr) return 'clear';
    var lower = weatherStr.toLowerCase();
    if (lower.indexOf('rain') >= 0 || lower.indexOf('drizzle') >= 0) return 'rain';
    if (lower.indexOf('snow') >= 0 || lower.indexOf('sleet') >= 0) return 'snow';
    if (lower.indexOf('cloud') >= 0 || lower.indexOf('overcast') >= 0) return 'cloudy';
    return 'clear';
  }

  function shiftCool(hex) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    r = Math.max(0, r - 30);
    g = Math.max(0, g - 10);
    b = Math.min(255, b + 40);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function clamp(min, max, val) {
    return Math.max(min, Math.min(max, val));
  }

  function generate(ep, size) {
    size = size || 120;
    var cx = size / 2;
    var cy = size / 2;
    var outerR = size * 0.44;
    var color = GUIDE_COLORS[ep.guide] || '#B8AFA2';
    var hashKey = ep.number + ':' + ep.title + ':' + ep.date + ':' + ep.guide;
    var bytes = hashBytes(hashKey);
    var rotation = (bytes[0] / 255) * 360;
    var weather = parseWeather(ep.weather);

    var filterScale, baseOpacity, strokeMult, colorUsed;
    colorUsed = color;
    if (weather === 'rain') {
      filterScale = 5; baseOpacity = 0.4; strokeMult = 1.2;
    } else if (weather === 'cloudy') {
      filterScale = 3; baseOpacity = 0.3; strokeMult = 0.6;
    } else if (weather === 'snow') {
      filterScale = 1.5; baseOpacity = 0.55; strokeMult = 0.7;
      colorUsed = shiftCool(color);
    } else {
      filterScale = 1.2; baseOpacity = 0.7; strokeMult = 1.0;
    }

    var elements = [];

    // Rings — driven by duration
    var ringCount = clamp(3, 6, Math.floor(ep.duration / 300));
    for (var i = 0; i < ringCount; i++) {
      var radOff = (bytes[2 + (i % 6)] / 255) * 0.08;
      var r = outerR - i * (size * (0.04 + radOff * 0.02));
      if (r < size * 0.15) break;
      var db = bytes[6 + (i % 6)];
      var dl = 2 + (db % 8);
      var gl = 1 + ((db >> 4) % 6);
      var da = i === 0 ? '' : ' stroke-dasharray="' + dl + ' ' + gl + '"';
      var sw = (i === 0 ? 1.5 : 0.8 + (bytes[i] % 3) * 0.3) * strokeMult;
      var op = baseOpacity - i * 0.06;
      elements.push(
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r.toFixed(1) +
        '" fill="none" stroke="' + colorUsed + '" stroke-width="' + sw.toFixed(1) +
        '" opacity="' + op.toFixed(2) + '"' + da + '/>'
      );
    }

    // Lines — driven by recording count
    var recordingCount = ep.recordingCount || 2;
    var lineCount = clamp(2, 6, recordingCount + (bytes[8] % 3));
    for (var i = 0; i < lineCount; i++) {
      var angle = ((bytes[8 + (i % 8)] / 255) * 360 + i * (360 / lineCount)) % 360;
      var rad = angle * Math.PI / 180;
      var inner = 0.25 + (bytes[16 + (i % 4)] / 255) * 0.15;
      var outer = 0.85 + (bytes[20 + (i % 4)] / 255) * 0.15;
      var x1 = cx + Math.cos(rad) * outerR * inner;
      var y1 = cy + Math.sin(rad) * outerR * inner;
      var x2 = cx + Math.cos(rad) * outerR * outer;
      var y2 = cy + Math.sin(rad) * outerR * outer;
      var sw = (0.5 + (bytes[i] % 3) * 0.3) * strokeMult;
      var op = (baseOpacity - 0.3) + (bytes[i + 12] / 255) * 0.2;
      elements.push(
        '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) +
        '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) +
        '" stroke="' + colorUsed + '" stroke-width="' + sw.toFixed(1) +
        '" opacity="' + op.toFixed(2) + '" stroke-linecap="round"/>'
      );
    }

    // Dots — hash-driven placement
    var dotCount = 3 + (bytes[28] % 4);
    for (var i = 0; i < dotCount; i++) {
      var angle = (bytes[28 + (i % 4)] / 255) * 360 + i * 47;
      var rad = angle * Math.PI / 180;
      var dist = outerR * (0.3 + (bytes[29 + (i % 3)] / 255) * 0.5);
      var x = cx + Math.cos(rad) * dist;
      var y = cy + Math.sin(rad) * dist;
      var dr = 1 + (bytes[i] % 2);
      elements.push(
        '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) +
        '" r="' + dr + '" fill="' + colorUsed +
        '" opacity="' + (baseOpacity - 0.35).toFixed(2) + '"/>'
      );
    }

    // Weather-specific extra elements
    if (weather === 'rain') {
      for (var i = 0; i < 8; i++) {
        var dx = (bytes[i] / 255 - 0.5) * outerR * 1.6;
        var dy1 = outerR * 0.3 + (bytes[i + 4] / 255) * outerR * 0.4;
        var dy2 = dy1 + outerR * 0.15 + (bytes[i + 8] / 255) * outerR * 0.2;
        elements.push(
          '<line x1="' + (cx + dx).toFixed(1) + '" y1="' + (cy + dy1).toFixed(1) +
          '" x2="' + (cx + dx + (bytes[i] % 5 - 2)).toFixed(1) + '" y2="' + (cy + dy2).toFixed(1) +
          '" stroke="' + colorUsed + '" stroke-width="0.4" opacity="0.2" stroke-linecap="round"/>'
        );
      }
    }
    if (weather === 'snow') {
      for (var i = 0; i < 12; i++) {
        var angle = (bytes[i] / 255) * Math.PI * 2;
        var dist = outerR * (0.15 + (bytes[i + 3] / 255) * 0.9);
        var sx = cx + Math.cos(angle) * dist;
        var sy = cy + Math.sin(angle) * dist;
        var sr = 0.8 + (bytes[i + 6] % 3) * 0.4;
        elements.push(
          '<circle cx="' + sx.toFixed(1) + '" cy="' + sy.toFixed(1) +
          '" r="' + sr.toFixed(1) + '" fill="none" stroke="' + colorUsed +
          '" stroke-width="0.4" opacity="0.2"/>'
        );
      }
    }

    // Assemble SVG
    var filterId = 'seal-rough-' + ep.number;
    var svg = '<svg class="seal-svg" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">';
    svg += '<defs><filter id="' + filterId + '">';
    svg += '<feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="3" seed="' + bytes[31] + '" result="noise"/>';
    svg += '<feDisplacementMap in="SourceGraphic" in2="noise" scale="' + filterScale.toFixed(1) + '"' + (weather === 'rain' ? ' result="displaced"/><feGaussianBlur in="displaced" stdDeviation="0.8"' : '') + '/>';
    svg += '</filter></defs>';
    svg += '<g transform="rotate(' + rotation.toFixed(1) + ' ' + cx + ' ' + cy + ')" filter="url(#' + filterId + ')">';
    svg += elements.join('\n');
    svg += '</g>';

    // Center text — episode number
    svg += '<text x="' + cx + '" y="' + (cy - size * 0.02) + '" text-anchor="middle"';
    svg += ' font-family="Lato, sans-serif" font-size="' + (size * 0.2) + '"';
    svg += ' font-weight="300" fill="' + colorUsed + '" opacity="0.8">' + ep.number + '</text>';

    // "EPISODE" label
    svg += '<text x="' + cx + '" y="' + (cy + size * 0.12) + '" text-anchor="middle"';
    svg += ' font-family="Lato, sans-serif" font-size="' + (size * 0.055) + '"';
    svg += ' fill="' + colorUsed + '" letter-spacing="2" opacity="0.5" style="text-transform:uppercase">episode</text>';

    svg += '</svg>';
    return svg;
  }

  function animate(svgEl) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return function () {};
    }

    var strokes = svgEl.querySelectorAll('circle[stroke], line');
    var dots = svgEl.querySelectorAll('circle[fill]:not([stroke])');
    var texts = svgEl.querySelectorAll('text');

    strokes.forEach(function (el, i) {
      var len;
      if (el.tagName === 'circle') {
        len = 2 * Math.PI * parseFloat(el.getAttribute('r'));
      } else {
        len = Math.hypot(
          parseFloat(el.getAttribute('x2')) - parseFloat(el.getAttribute('x1')),
          parseFloat(el.getAttribute('y2')) - parseFloat(el.getAttribute('y1'))
        );
      }
      el.style.strokeDasharray = len;
      el.style.strokeDashoffset = len;
      el.style.transition = 'stroke-dashoffset ' + (1.0 + i * 0.12) + 's ease ' + (i * 0.15) + 's';
    });

    dots.forEach(function (el, i) {
      var origOpacity = el.getAttribute('opacity') || '0.35';
      el.setAttribute('data-opacity', origOpacity);
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.6s ease ' + (strokes.length * 0.15 + i * 0.1) + 's';
    });

    texts.forEach(function (el) {
      var origOpacity = el.getAttribute('opacity') || '0.8';
      el.setAttribute('data-opacity', origOpacity);
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.8s ease ' + (strokes.length * 0.15 + dots.length * 0.1 + 0.3) + 's';
    });

    return function reveal() {
      strokes.forEach(function (el) { el.style.strokeDashoffset = '0'; });
      dots.forEach(function (el) { el.style.opacity = el.getAttribute('data-opacity') || '0.35'; });
      texts.forEach(function (el) { el.style.opacity = el.getAttribute('data-opacity') || '0.8'; });
    };
  }

  exports.PilgrimSeal = {
    generate: generate,
    animate: animate,
    guideColor: guideColor,
    bellUrl: bellUrl
  };

})(window);
