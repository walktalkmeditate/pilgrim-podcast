/* =============================================
   Pilgrim on the Path — Main Script
   ============================================= */

(function () {
  'use strict';

  var currentAudio = null;
  var currentBtn = null;

  // --- Theme ---

  function initTheme() {
    var saved = localStorage.getItem('pilgrim-theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    updateThemeIcon();
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme');
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('pilgrim-theme', next);
    updateThemeIcon();
  }

  function updateThemeIcon() {
    var toggle = document.querySelector('.theme-toggle');
    if (!toggle) return;
    while (toggle.firstChild) toggle.removeChild(toggle.firstChild);
    if (window.Moon) {
      window.Moon.renderMoon(toggle);
    }
  }

  // --- Audio Player ---

  function handlePlay(btn) {
    var src = btn.getAttribute('data-src');

    if (currentBtn === btn && currentAudio && !currentAudio.paused) {
      currentAudio.pause();
      btn.classList.remove('playing');
      var stopEl = btn.closest('.episode-stop');
      if (stopEl) stopEl.classList.remove('seal-playing');
      return;
    }

    if (currentAudio) {
      currentAudio.pause();
      if (currentBtn) {
        currentBtn.classList.remove('playing');
        var prevStop = currentBtn.closest('.episode-stop');
        if (prevStop) prevStop.classList.remove('seal-playing');
      }
    }

    if (currentBtn === btn && currentAudio) {
      currentAudio.play();
      btn.classList.add('playing');
      var resumeStop = btn.closest('.episode-stop');
      if (resumeStop) resumeStop.classList.add('seal-playing');
      return;
    }

    currentAudio = new Audio(src);
    currentBtn = btn;
    btn.classList.add('playing');
    var playingStop = btn.closest('.episode-stop');
    if (playingStop) playingStop.classList.add('seal-playing');

    currentAudio.addEventListener('timeupdate', function () {
      if (!currentAudio.duration) return;
      var stop = btn.closest('.episode-stop');
      if (!stop) return;
      var fillEl = stop.querySelector('.progress-fill');
      var timeEl = stop.querySelector('.player-time');
      if (fillEl) fillEl.style.width = (currentAudio.currentTime / currentAudio.duration * 100) + '%';
      if (timeEl) timeEl.textContent = formatDuration(Math.floor(currentAudio.duration - currentAudio.currentTime));
    });

    currentAudio.addEventListener('ended', function () {
      btn.classList.remove('playing');
      var stop = btn.closest('.episode-stop');
      if (stop) {
        stop.classList.remove('seal-playing');
        stop.classList.add('seal-visited');
        localStorage.setItem('visited-ep-' + stop.getAttribute('data-episode'), '1');
        var fillEl = stop.querySelector('.progress-fill');
        if (fillEl) fillEl.style.width = '0%';
      }
      currentAudio = null;
      currentBtn = null;
    });

    currentAudio.play().catch(function () {
      btn.classList.remove('playing');
      var failStop = btn.closest('.episode-stop');
      if (failStop) failStop.classList.remove('seal-playing');
    });
  }

  // --- Helpers ---

  function formatDuration(seconds) {
    var s = Math.floor(seconds);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    if (h > 0) return h + ':' + pad(m) + ':' + pad(sec);
    return m + ':' + pad(sec);
  }

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function formatDate(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  // --- Time of Day ---

  function applyTimeOfDay() {
    var hour = new Date().getHours();
    var time;
    if (hour >= 5 && hour <= 7) {
      time = 'dawn';
    } else if (hour >= 17 && hour <= 19) {
      time = 'dusk';
    } else if (hour >= 20 || hour < 5) {
      time = 'night';
    }
    if (time) {
      document.documentElement.setAttribute('data-time', time);
    }

    var month = new Date().getMonth();
    var season = (month >= 2 && month <= 4) ? 'spring'
      : (month >= 5 && month <= 7) ? 'summer'
      : (month >= 8 && month <= 10) ? 'autumn'
      : 'winter';
    document.documentElement.setAttribute('data-season', season);

    var seasonIcons = { spring: '\uD83C\uDF31', summer: '\uD83D\uDD25', autumn: '\uD83C\uDF42', winter: '\u2744\uFE0F' };
    var cycleBtn = document.querySelector('.season-cycle');
    if (cycleBtn) cycleBtn.textContent = seasonIcons[season] || '\uD83C\uDF31';
  }

  // --- Caption Helpers ---

  function splitTranscript(text) {
    var sections = text.split(/\n\n+/);
    var result = [];
    sections.forEach(function (section) {
      var trimmed = section.trim();
      if (!trimmed) return;
      var sentences = trimmed.match(/[^.!?]*[.!?]+[\s]*/g) || [trimmed];
      var chunk = [];
      for (var i = 0; i < sentences.length; i++) {
        chunk.push(sentences[i].trim());
        if (chunk.length >= 4) {
          result.push(chunk.join(' '));
          chunk = [];
        }
      }
      if (chunk.length > 0) {
        result.push(chunk.join(' '));
      }
    });
    return result;
  }

  function capitalize(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function getSeason(month) {
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  function generateCaption(date1, date2) {
    var d1 = new Date(date1 + 'T00:00:00');
    var d2 = new Date(date2 + 'T00:00:00');
    var diffMs = d2 - d1;
    var days = Math.round(diffMs / (1000 * 60 * 60 * 24));

    var caption;
    if (days === 0) {
      caption = 'the same day';
    } else if (days === 1) {
      caption = 'a day passed';
    } else if (days <= 6) {
      caption = days + ' days passed';
    } else if (days <= 13) {
      caption = 'a week passed';
    } else if (days <= 29) {
      caption = Math.floor(days / 7) + ' weeks passed';
    } else if (days <= 59) {
      caption = 'a month passed';
    } else {
      caption = Math.floor(days / 30) + ' months passed';
    }

    var season1 = getSeason(d1.getMonth());
    var season2 = getSeason(d2.getMonth());
    if (season1 !== season2) {
      caption += '...and ' + season2 + ' arrived';
    }

    return caption;
  }

  // --- Journey Renderer ---

  function renderJourney(episodes) {
    var container = document.getElementById('journey-stops');
    if (!container) return;
    container.textContent = '';

    if (!episodes || episodes.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'journey-empty';
      var p = document.createElement('p');
      p.textContent = 'The first walk is being recorded.';
      empty.appendChild(p);
      container.appendChild(empty);
      return;
    }

    var sorted = episodes.slice().sort(function (a, b) { return a.number - b.number; });

    // Koan — random reflection from an episode
    var reflections = sorted.filter(function (ep) { return ep.reflection; });
    if (reflections.length > 0) {
      var koan = document.createElement('div');
      koan.className = 'journey-koan reveal';
      var koanP = document.createElement('p');
      koanP.textContent = reflections[Math.floor(Math.random() * reflections.length)].reflection;
      koan.appendChild(koanP);
      container.appendChild(koan);
    }

    sorted.forEach(function (ep, i) {
      if (i > 0) {
        var captionEl = document.createElement('div');
        captionEl.className = 'journey-caption reveal';
        var captionP = document.createElement('p');
        captionP.textContent = generateCaption(sorted[i - 1].date, ep.date);
        captionEl.appendChild(captionP);
        container.appendChild(captionEl);
      }

      var stop = document.createElement('div');
      stop.className = 'episode-stop reveal';
      stop.setAttribute('data-episode', ep.number);
      if (localStorage.getItem('visited-ep-' + ep.number)) {
        stop.classList.add('seal-visited');
      }

      var sealWrap = document.createElement('div');
      sealWrap.className = 'seal-container';
      sealWrap.setAttribute('role', 'button');
      sealWrap.setAttribute('tabindex', '0');
      sealWrap.setAttribute('aria-label', 'Episode ' + ep.number + ': ' + ep.title);
      // PilgrimSeal.generate returns our own generated SVG string — not user content
      sealWrap.innerHTML = PilgrimSeal.generate(ep); // safe: own generated SVG
      stop.appendChild(sealWrap);

      var label = document.createElement('div');
      label.className = 'episode-label';

      var labelTitle = document.createElement('div');
      labelTitle.className = 'episode-label-title';
      labelTitle.textContent = ep.title;
      label.appendChild(labelTitle);

      var labelMeta = document.createElement('div');
      labelMeta.className = 'episode-label-meta';
      labelMeta.textContent = formatDuration(ep.duration) + ' \u00B7 ' + capitalize(ep.guide) + ' \u00B7 ' + formatDate(ep.date);
      label.appendChild(labelMeta);

      stop.appendChild(label);

      var card = buildExpandedCard(ep);
      stop.appendChild(card);

      sealWrap.addEventListener('click', function () {
        toggleExpand(stop, card, ep);
      });
      sealWrap.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleExpand(stop, card, ep);
        }
      });

      // Seal hover animation + audio preview
      setupSealHover(sealWrap);
      setupAudioPreview(sealWrap, ep);

      container.appendChild(stop);
    });

    // Cumulative stats
    var totalKm = 0, totalTalk = 0;
    sorted.forEach(function (ep) {
      totalKm += ep.distance_km || 0;
      totalTalk += ep.duration || 0;
    });
    var cumulative = document.createElement('div');
    cumulative.className = 'journey-cumulative reveal';
    var cumulP = document.createElement('p');
    cumulP.textContent = 'Together, pilgrims have walked ' + totalKm.toFixed(1) + ' km and talked for ' + formatDuration(totalTalk);
    cumulative.appendChild(cumulP);
    container.appendChild(cumulative);

    initScrollReveal();
    requestAnimationFrame(function () {
      drawWindingPath();
      requestAnimationFrame(initMarkerPulse);
    });
  }

  function drawWindingPath() {
    var pathContainer = document.querySelector('.journey-path');
    if (!pathContainer) return;

    var journey = document.querySelector('.journey');
    var stops = document.querySelectorAll('.episode-stop');
    if (stops.length === 0) return;

    var journeyRect = journey.getBoundingClientRect();
    var totalHeight = journey.scrollHeight;
    var centerX = journeyRect.width / 2;

    var points = [];
    points.push({ x: centerX, y: 0 });

    stops.forEach(function (stop) {
      var seal = stop.querySelector('.seal-container');
      if (seal) {
        var sealRect = seal.getBoundingClientRect();
        var y = sealRect.top - journeyRect.top + sealRect.height / 2;
        points.push({ x: centerX, y: y });
      }
    });

    points.push({ x: centerX, y: totalHeight });

    var episodeCount = stops.length;
    var baseAmplitude = 15 + Math.min(episodeCount * 5, 65);
    var d = 'M ' + points[0].x + ' ' + points[0].y;

    for (var i = 1; i < points.length; i++) {
      var prev = points[i - 1];
      var curr = points[i];
      var segProgress = i / points.length;
      var amplitude = baseAmplitude * (0.6 + segProgress * 0.6);
      var direction = (i % 2 === 0) ? 1 : -1;
      var cp1x = centerX + amplitude * direction;
      var cp1y = prev.y + (curr.y - prev.y) * 0.3;
      var cp2x = centerX - amplitude * direction;
      var cp2y = prev.y + (curr.y - prev.y) * 0.7;
      d += ' C ' + cp1x + ' ' + cp1y + ' ' + cp2x + ' ' + cp2y + ' ' + curr.x + ' ' + curr.y;
    }

    var svg = '<svg viewBox="0 0 ' + journeyRect.width + ' ' + totalHeight + '" preserveAspectRatio="none">';
    svg += '<path class="winding-path" d="' + d + '"/>';

    // Trail markers — small dots along the path
    var markerSpacing = 60;
    for (var y = markerSpacing; y < totalHeight - 20; y += markerSpacing) {
      var t = y / totalHeight;
      var segIdx = Math.min(Math.floor(t * (points.length - 1)), points.length - 2);
      var segT = (t * (points.length - 1)) - segIdx;
      var p0 = points[segIdx];
      var p1 = points[segIdx + 1];
      var segProgress = (segIdx + 1) / points.length;
      var segAmp = baseAmplitude * (0.6 + segProgress * 0.6);
      var dir = ((segIdx + 1) % 2 === 0) ? 1 : -1;
      var mcp1x = centerX + segAmp * dir;
      var mcp2x = centerX - segAmp * dir;
      var bx = Math.pow(1 - segT, 3) * p0.x + 3 * Math.pow(1 - segT, 2) * segT * mcp1x + 3 * (1 - segT) * segT * segT * mcp2x + Math.pow(segT, 3) * p1.x;
      svg += '<circle class="trail-marker" cx="' + bx.toFixed(1) + '" cy="' + y + '" r="1.5"/>';
    }

    svg += '</svg>';
    pathContainer.innerHTML = svg;
  }

  // --- Seal Hover Animation ---

  function setupSealHover(sealWrap) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var svg = sealWrap.querySelector('.seal-svg');
    if (!svg) return;

    var rings = svg.querySelectorAll('circle[stroke]');
    rings.forEach(function (ring, i) {
      var cx = ring.getAttribute('cx');
      var cy = ring.getAttribute('cy');
      ring.style.transformOrigin = cx + 'px ' + cy + 'px';
      ring.style.transition = 'transform 0.6s ease';
    });

    sealWrap.addEventListener('mouseenter', function () {
      rings.forEach(function (ring, i) {
        var dir = i % 2 === 0 ? 1 : -1;
        var speed = 12 + i * 4;
        ring.style.animation = 'ring-rotate-' + (dir > 0 ? 'cw' : 'ccw') + ' ' + speed + 's linear infinite';
      });
    });

    sealWrap.addEventListener('mouseleave', function () {
      rings.forEach(function (ring) {
        ring.style.animation = 'none';
      });
    });
  }

  // --- Trail Marker Animation ---

  function initMarkerPulse() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var markers = document.querySelectorAll('.trail-marker');
    if (markers.length === 0) return;

    var season = document.documentElement.getAttribute('data-season') || 'spring';

    function checkMarkers() {
      var scrollBottom = window.scrollY + window.innerHeight;

      markers.forEach(function (marker, i) {
        if (marker.classList.contains('alive')) return;

        var cy = parseFloat(marker.getAttribute('cy'));
        var journey = document.querySelector('.journey');
        if (!journey) return;
        var journeyTop = journey.getBoundingClientRect().top + window.scrollY;
        var markerY = journeyTop + cy;

        if (scrollBottom > markerY) {
          if (season === 'summer') {
            marker.style.animationDelay = (Math.random() * 2).toFixed(1) + 's';
          } else if (season === 'autumn') {
            marker.style.animationDelay = (Math.random() * 1.5).toFixed(1) + 's';
            if (i % 2 === 0) marker.classList.add('drift-left');
          } else {
            marker.style.animationDelay = (i * 0.08).toFixed(2) + 's';
          }
          marker.classList.add('alive');
        }
      });
    }

    window.addEventListener('scroll', checkMarkers, { passive: true });
    checkMarkers();
  }

  // --- Audio Preview on Hover ---

  var previewAudio = null;
  var previewTimer = null;
  var previewFadeTimer = null;
  var previewFadeInterval = null;
  var userHasInteracted = false;

  document.addEventListener('click', function () { userHasInteracted = true; }, { once: true });
  document.addEventListener('keydown', function () { userHasInteracted = true; }, { once: true });
  document.addEventListener('touchstart', function () { userHasInteracted = true; }, { once: true });

  function setupAudioPreview(sealWrap, ep) {
    var indicator = document.createElement('div');
    indicator.className = 'preview-indicator';
    sealWrap.appendChild(indicator);

    sealWrap.addEventListener('mouseenter', function () {
      if (!userHasInteracted) return;
      previewTimer = setTimeout(function () {
        if (previewAudio) {
          previewAudio.pause();
          previewAudio = null;
        }
        previewAudio = new Audio(ep.audioUrl);
        previewAudio.volume = 0.15;
        previewAudio.addEventListener('loadedmetadata', function () {
          if (previewAudio === this) {
            previewAudio.currentTime = Math.floor(ep.duration / 3);
          }
        });
        previewAudio.play().catch(function () {});
        previewFadeTimer = setTimeout(function () {
          if (previewAudio) {
            previewFadeInterval = setInterval(function () {
              if (previewAudio && previewAudio.volume > 0.02) {
                previewAudio.volume = Math.max(0, previewAudio.volume - 0.02);
              } else {
                clearInterval(previewFadeInterval);
                previewFadeInterval = null;
                if (previewAudio) {
                  previewAudio.pause();
                  previewAudio = null;
                }
              }
            }, 100);
          }
        }, 5000);
      }, 2000);
    });

    sealWrap.addEventListener('mouseleave', function () {
      clearTimeout(previewTimer);
      clearTimeout(previewFadeTimer);
      if (previewFadeInterval) { clearInterval(previewFadeInterval); previewFadeInterval = null; }
      if (previewAudio) {
        previewAudio.pause();
        previewAudio = null;
      }
    });
  }

  function buildExpandedCard(ep) {
    var ns = 'http://www.w3.org/2000/svg';

    var wrapper = document.createElement('div');
    wrapper.className = 'episode-expanded';

    var badge = document.createElement('div');
    badge.className = 'episode-number-badge';
    badge.textContent = 'Episode ' + ep.number;
    wrapper.appendChild(badge);

    var title = document.createElement('div');
    title.className = 'episode-expanded-title';
    title.textContent = ep.title;
    wrapper.appendChild(title);

    var meta = document.createElement('div');
    meta.className = 'episode-expanded-meta';

    var durSpan = document.createElement('span');
    durSpan.textContent = formatDuration(ep.duration);
    meta.appendChild(durSpan);

    var sep2 = document.createElement('span');
    sep2.className = 'sep';
    sep2.textContent = '\u00B7';
    meta.appendChild(sep2);

    var guideSpan = document.createElement('span');
    guideSpan.className = 'guide';
    guideSpan.textContent = 'guided by ' + capitalize(ep.guide);
    meta.appendChild(guideSpan);

    var sep3 = document.createElement('span');
    sep3.className = 'sep';
    sep3.textContent = '\u00B7';
    meta.appendChild(sep3);

    var dateSpan = document.createElement('span');
    dateSpan.textContent = formatDate(ep.date);
    meta.appendChild(dateSpan);

    wrapper.appendChild(meta);

    var summary = document.createElement('p');
    summary.className = 'episode-summary';
    summary.textContent = ep.summary;
    wrapper.appendChild(summary);

    var player = document.createElement('div');
    player.className = 'episode-player';

    var btn = document.createElement('button');
    btn.className = 'play-btn';
    btn.setAttribute('data-src', ep.audioUrl);
    btn.setAttribute('aria-label', 'Play episode');

    var playSvg = document.createElementNS(ns, 'svg');
    playSvg.setAttribute('class', 'icon-play');
    playSvg.setAttribute('viewBox', '0 0 24 24');
    var playPoly = document.createElementNS(ns, 'polygon');
    playPoly.setAttribute('points', '6,3 20,12 6,21');
    playSvg.appendChild(playPoly);
    btn.appendChild(playSvg);

    var pauseSvg = document.createElementNS(ns, 'svg');
    pauseSvg.setAttribute('class', 'icon-pause');
    pauseSvg.setAttribute('viewBox', '0 0 24 24');
    var r1 = document.createElementNS(ns, 'rect');
    r1.setAttribute('x', '5'); r1.setAttribute('y', '3');
    r1.setAttribute('width', '4'); r1.setAttribute('height', '18');
    pauseSvg.appendChild(r1);
    var r2 = document.createElementNS(ns, 'rect');
    r2.setAttribute('x', '15'); r2.setAttribute('y', '3');
    r2.setAttribute('width', '4'); r2.setAttribute('height', '18');
    pauseSvg.appendChild(r2);
    btn.appendChild(pauseSvg);

    player.appendChild(btn);

    var bar = document.createElement('div');
    bar.className = 'progress-bar';
    var fill = document.createElement('div');
    fill.className = 'progress-fill';
    bar.appendChild(fill);
    player.appendChild(bar);

    var time = document.createElement('span');
    time.className = 'player-time';
    time.textContent = formatDuration(ep.duration);
    player.appendChild(time);

    var speed = document.createElement('button');
    speed.className = 'speed-btn';
    speed.textContent = '1x';
    speed.addEventListener('click', function () {
      var speeds = [1, 1.25, 1.5, 1.75, 2];
      var current = parseFloat(speed.textContent);
      var idx = speeds.indexOf(current);
      var next = speeds[(idx + 1) % speeds.length];
      speed.textContent = next + 'x';
      if (currentAudio) currentAudio.playbackRate = next;
    });
    player.appendChild(speed);

    wrapper.appendChild(player);

    if (ep.walkPage) {
      var walkLink = document.createElement('a');
      walkLink.className = 'episode-walk-link';
      walkLink.href = ep.walkPage;
      walkLink.target = '_blank';
      walkLink.rel = 'noopener';
      walkLink.textContent = 'View the walk';
      wrapper.appendChild(walkLink);
    }

    if (ep.transcript) {
      var transcriptToggle = document.createElement('button');
      transcriptToggle.className = 'transcript-toggle';
      transcriptToggle.textContent = 'Read transcript';
      transcriptToggle.addEventListener('click', function () {
        var content = this.nextElementSibling;
        var isOpen = content.classList.toggle('open');
        this.textContent = isOpen ? 'Hide transcript' : 'Read transcript';
      });
      wrapper.appendChild(transcriptToggle);

      var transcriptContent = document.createElement('div');
      transcriptContent.className = 'transcript-content';
      splitTranscript(ep.transcript).forEach(function (para) {
        var p = document.createElement('p');
        p.textContent = para;
        transcriptContent.appendChild(p);
      });
      wrapper.appendChild(transcriptContent);
    }

    return wrapper;
  }

  // --- Expand / Bell ---

  function toggleExpand(stop, card, ep) {
    var alreadyOpen = card.classList.contains('open');

    document.querySelectorAll('.episode-expanded.open').forEach(function (openCard) {
      openCard.classList.remove('open');
    });

    if (!alreadyOpen) {
      card.classList.add('open');
      stop.classList.add('seal-visited');
      localStorage.setItem('visited-ep-' + ep.number, '1');
    }
  }

  // --- Scroll Reveal ---

  function initScrollReveal() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.reveal').forEach(function (el) {
        el.classList.add('visible');
        var svg = el.querySelector('.seal-svg');
        if (svg) {
          var reveal = PilgrimSeal.animate(svg);
          if (reveal) reveal();
        }
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          var svg = entry.target.querySelector('.seal-svg');
          if (svg) {
            var reveal = PilgrimSeal.animate(svg);
            if (reveal) reveal();
          }
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });

    document.querySelectorAll('.reveal:not(.visible)').forEach(function (el) {
      observer.observe(el);
    });
  }

  // --- Scroll Sound ---

  var scrollAudio = null;
  var scrollSoundEnabled = false;
  var lastScrollY = 0;
  var scrollVelocity = 0;
  var scrollDecay = null;
  var maxScrollVolume = 0.08;

  var SCROLL_SOUNDS = {
    spring: 'https://cdn.pilgrimapp.org/audio/scroll/spring.aac',
    summer: 'https://cdn.pilgrimapp.org/audio/scroll/summer.aac',
    autumn: 'https://cdn.pilgrimapp.org/audio/scroll/autumn.aac',
    winter: 'https://cdn.pilgrimapp.org/audio/scroll/winter.aac'
  };

  function initScrollSound() {
    var invite = document.getElementById('scroll-sound-invite');
    if (!invite) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    if (localStorage.getItem('scroll-sound') === 'on') {
      invite.classList.add('hidden');
      var scrollSoundReady = false;
      var scrollSoundStarted = false;

      function markReady() { scrollSoundReady = true; }
      document.addEventListener('click', markReady);
      document.addEventListener('touchstart', markReady);

      function tryStartScrollSound() {
        if (scrollSoundStarted || !scrollSoundReady) return;
        scrollSoundStarted = true;
        enableScrollSound();
        document.removeEventListener('click', markReady);
        document.removeEventListener('touchstart', markReady);
        window.removeEventListener('scroll', tryStartScrollSound);
      }
      window.addEventListener('scroll', tryStartScrollSound, { passive: true });
      return;
    }

    invite.addEventListener('click', function () {
      enableScrollSound();
      invite.classList.add('hidden');
      localStorage.setItem('scroll-sound', 'on');
    });
  }

  function enableScrollSound() {
    var season = document.documentElement.getAttribute('data-season') || 'spring';
    loadScrollAudio(season);
    scrollSoundEnabled = true;

    var mute = document.createElement('button');
    mute.className = 'scroll-sound-mute';
    mute.textContent = '\uD83D\uDD0A';
    mute.setAttribute('aria-label', 'Mute scroll sound');
    mute.addEventListener('click', function () {
      scrollSoundEnabled = !scrollSoundEnabled;
      mute.textContent = scrollSoundEnabled ? '\uD83D\uDD0A' : '\uD83D\uDD07';
      if (!scrollSoundEnabled && scrollAudio) {
        scrollAudio.volume = 0;
      }
      localStorage.setItem('scroll-sound', scrollSoundEnabled ? 'on' : 'off');
    });
    document.body.appendChild(mute);

    lastScrollY = window.scrollY;
    window.addEventListener('scroll', handleScrollSound, { passive: true });

    scrollDecay = setInterval(function () {
      scrollVelocity *= 0.75;
      if (scrollAudio && scrollSoundEnabled) {
        scrollAudio.volume = Math.min(scrollVelocity, maxScrollVolume);
      }
    }, 50);
  }

  function loadScrollAudio(season) {
    var url = SCROLL_SOUNDS[season];
    if (!url) return;
    if (scrollAudio) { scrollAudio.pause(); }
    scrollAudio = new Audio(url);
    scrollAudio.loop = true;
    scrollAudio.volume = 0;
    scrollAudio.play().catch(function () {});
  }

  function handleScrollSound() {
    var currentY = window.scrollY;
    var delta = Math.abs(currentY - lastScrollY);
    lastScrollY = currentY;
    scrollVelocity = Math.min(scrollVelocity + delta * 0.0008, maxScrollVolume);
  }

  // --- Init ---

  function init() {
    applyTimeOfDay();
    initTheme();
    initScrollSound();

    fetch('episodes/episodes.json')
      .then(function (res) { return res.json(); })
      .then(function (episodes) {
        renderJourney(episodes);
      })
      .catch(function () {
        renderJourney([]);
      });

    var toggle = document.querySelector('.theme-toggle');
    if (toggle) toggle.addEventListener('click', toggleTheme);

    var clickCount = 0;
    var clickTimer = null;
    if (toggle) toggle.addEventListener('click', function () {
      clickCount++;
      clearTimeout(clickTimer);
      clickTimer = setTimeout(function () { clickCount = 0; }, 600);
      if (clickCount >= 3) {
        clickCount = 0;
        document.body.classList.toggle('constellation');
      }
    });

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.play-btn');
      if (btn) {
        handlePlay(btn);
        return;
      }

      var bar = e.target.closest('.progress-bar');
      if (bar && currentAudio && isFinite(currentAudio.duration)) {
        var rect = bar.getBoundingClientRect();
        var ratio = (e.clientX - rect.left) / rect.width;
        currentAudio.currentTime = ratio * currentAudio.duration;
      }

      var cycleBtn = e.target.closest('.season-cycle');
      if (cycleBtn) {
        var seasons = ['spring', 'summer', 'autumn', 'winter'];
        var icons = { spring: '\uD83C\uDF31', summer: '\uD83D\uDD25', autumn: '\uD83C\uDF42', winter: '\u2744\uFE0F' };
        var current = document.documentElement.getAttribute('data-season');
        var idx = seasons.indexOf(current);
        var next = seasons[(idx + 1) % seasons.length];

        document.documentElement.setAttribute('data-season', next);
        cycleBtn.textContent = icons[next];
        if (scrollSoundEnabled) loadScrollAudio(next);

        document.querySelectorAll('.trail-marker').forEach(function (m) {
          m.classList.remove('alive', 'drift-left');
          m.style.animation = 'none';
          m.offsetHeight;
          m.style.animation = '';
        });
        setTimeout(function () {
          document.querySelectorAll('.trail-marker').forEach(function (m, i) {
            if (next === 'summer') {
              m.style.animationDelay = (Math.random() * 2).toFixed(1) + 's';
            } else if (next === 'autumn') {
              m.style.animationDelay = (Math.random() * 1.5).toFixed(1) + 's';
              if (i % 2 === 0) m.classList.add('drift-left');
            } else {
              m.style.animationDelay = (i * 0.08).toFixed(2) + 's';
            }
            m.classList.add('alive');
          });
        }, 50);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
