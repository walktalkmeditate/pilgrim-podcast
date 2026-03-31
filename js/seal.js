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

  var R2_BASE = 'https://pub-c72c34fbaa6c1041a47d15961d16f398.r2.dev';

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

    var filterScale = weather === 'rain' ? 2.5 : weather === 'cloudy' ? 1.8 : 1.2;
    var baseOpacity = weather === 'rain' ? 0.5 : weather === 'cloudy' ? 0.55 : weather === 'snow' ? 0.6 : 0.7;

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
      var sw = i === 0 ? 1.5 : 0.8 + (bytes[i] % 3) * 0.3;
      var op = baseOpacity - i * 0.06;
      elements.push(
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r.toFixed(1) +
        '" fill="none" stroke="' + color + '" stroke-width="' + sw.toFixed(1) +
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
      var sw = 0.5 + (bytes[i] % 3) * 0.3;
      var op = (baseOpacity - 0.3) + (bytes[i + 12] / 255) * 0.2;
      elements.push(
        '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) +
        '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) +
        '" stroke="' + color + '" stroke-width="' + sw.toFixed(1) +
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
        '" r="' + dr + '" fill="' + color +
        '" opacity="' + (baseOpacity - 0.35).toFixed(2) + '"/>'
      );
    }

    // Assemble SVG
    var filterId = 'seal-rough-' + ep.number;
    var svg = '<svg class="seal-svg" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">';
    svg += '<defs><filter id="' + filterId + '">';
    svg += '<feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="3" seed="' + bytes[31] + '"/>';
    svg += '<feDisplacementMap in="SourceGraphic" scale="' + filterScale.toFixed(1) + '"/>';
    svg += '</filter></defs>';
    svg += '<g transform="rotate(' + rotation.toFixed(1) + ' ' + cx + ' ' + cy + ')" filter="url(#' + filterId + ')">';
    svg += elements.join('\n');
    svg += '</g>';

    // Center text — episode number
    svg += '<text x="' + cx + '" y="' + (cy - size * 0.02) + '" text-anchor="middle"';
    svg += ' font-family="Cormorant Garamond, serif" font-size="' + (size * 0.22) + '"';
    svg += ' font-weight="300" fill="' + color + '" opacity="0.8">' + ep.number + '</text>';

    // "EPISODE" label
    svg += '<text x="' + cx + '" y="' + (cy + size * 0.12) + '" text-anchor="middle"';
    svg += ' font-family="Lato, sans-serif" font-size="' + (size * 0.055) + '"';
    svg += ' fill="' + color + '" letter-spacing="2" opacity="0.5" style="text-transform:uppercase">episode</text>';

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
