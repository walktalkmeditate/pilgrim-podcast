/* =============================================
   Pilgrim on the Path — Main Script
   ============================================= */

(function () {
  'use strict';

  var currentAudio = null;
  var currentBtn = null;
  var currentBellAudio = null;

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
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var toggle = document.querySelector('.theme-toggle');
    if (!toggle) return;
    toggle.textContent = '';
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    if (isDark) {
      var circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('cx', '12');
      circle.setAttribute('cy', '12');
      circle.setAttribute('r', '5');
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', 'currentColor');
      circle.setAttribute('stroke-width', '1.5');
      svg.appendChild(circle);
      var path = document.createElementNS(ns, 'path');
      path.setAttribute('d', 'M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('stroke-linecap', 'round');
      svg.appendChild(path);
    } else {
      var moonPath = document.createElementNS(ns, 'path');
      moonPath.setAttribute('d', 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z');
      moonPath.setAttribute('fill', 'none');
      moonPath.setAttribute('stroke', 'currentColor');
      moonPath.setAttribute('stroke-width', '1.5');
      moonPath.setAttribute('stroke-linecap', 'round');
      moonPath.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(moonPath);
    }
    toggle.appendChild(svg);
  }

  // --- Audio Player ---

  function handlePlay(btn) {
    var src = btn.getAttribute('data-src');

    if (currentBtn === btn && currentAudio && !currentAudio.paused) {
      currentAudio.pause();
      btn.classList.remove('playing');
      return;
    }

    if (currentAudio) {
      currentAudio.pause();
      if (currentBtn) currentBtn.classList.remove('playing');
    }

    if (currentBtn === btn && currentAudio) {
      currentAudio.play();
      btn.classList.add('playing');
      return;
    }

    currentAudio = new Audio(src);
    currentBtn = btn;
    btn.classList.add('playing');

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
        var fillEl = stop.querySelector('.progress-fill');
        if (fillEl) fillEl.style.width = '0%';
      }
      currentAudio = null;
      currentBtn = null;
    });

    currentAudio.play().catch(function () {
      btn.classList.remove('playing');
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

    sorted.forEach(function (ep, i) {
      if (i > 0) {
        var captionEl = document.createElement('div');
        captionEl.className = 'journey-caption reveal';
        captionEl.textContent = generateCaption(sorted[i - 1].date, ep.date);
        container.appendChild(captionEl);
      }

      var stop = document.createElement('div');
      stop.className = 'episode-stop reveal';
      stop.setAttribute('data-episode', ep.number);

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

      container.appendChild(stop);
    });

    initScrollReveal();
    requestAnimationFrame(function () { drawWindingPath(); });
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

    var amplitude = 40;
    var d = 'M ' + points[0].x + ' ' + points[0].y;

    for (var i = 1; i < points.length; i++) {
      var prev = points[i - 1];
      var curr = points[i];
      var midY = (prev.y + curr.y) / 2;
      var direction = (i % 2 === 0) ? 1 : -1;
      var cp1x = centerX + amplitude * direction;
      var cp1y = prev.y + (curr.y - prev.y) * 0.3;
      var cp2x = centerX - amplitude * direction;
      var cp2y = prev.y + (curr.y - prev.y) * 0.7;
      d += ' C ' + cp1x + ' ' + cp1y + ' ' + cp2x + ' ' + cp2y + ' ' + curr.x + ' ' + curr.y;
    }

    var svg = '<svg viewBox="0 0 ' + journeyRect.width + ' ' + totalHeight + '" preserveAspectRatio="none">';
    svg += '<path class="winding-path" d="' + d + '"/>';
    svg += '</svg>';
    pathContainer.innerHTML = svg;
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
    }
  }

  function playBell(guideId) {
    if (currentBellAudio) {
      currentBellAudio.pause();
      currentBellAudio = null;
    }
    var bell = new Audio(PilgrimSeal.bellUrl(guideId));
    bell.volume = 0.3;
    bell.play().catch(function () {});
    currentBellAudio = bell;
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

  // --- Init ---

  function init() {
    applyTimeOfDay();
    initTheme();

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

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.play-btn');
      if (btn) {
        handlePlay(btn);
        return;
      }

      var bar = e.target.closest('.progress-bar');
      if (bar && currentAudio) {
        var rect = bar.getBoundingClientRect();
        var ratio = (e.clientX - rect.left) / rect.width;
        currentAudio.currentTime = ratio * currentAudio.duration;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
