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

  // --- Episodes ---

  function loadEpisodes() {
    fetch('episodes/episodes.json')
      .then(function (res) { return res.json(); })
      .then(function (episodes) {
        renderEpisodes(episodes);
        updateCount(episodes.length);
      })
      .catch(function () {
        renderEmpty();
      });
  }

  function renderEpisodes(episodes) {
    var container = document.getElementById('episodes-list');
    if (!container) return;

    if (episodes.length === 0) {
      renderEmpty();
      return;
    }

    container.textContent = '';
    episodes.forEach(function (ep, i) {
      container.appendChild(buildEpisodeCard(ep, i));
    });

    initReveal();
  }

  function buildEpisodeCard(ep, index) {
    var duration = formatDuration(ep.duration);
    var date = formatDate(ep.date);
    var guideName = ep.guide.charAt(0).toUpperCase() + ep.guide.slice(1);

    var card = document.createElement('article');
    card.className = 'episode-card reveal';
    card.setAttribute('data-index', index);

    var seal = document.createElement('div');
    seal.className = 'episode-seal';
    seal.id = 'seal-' + index;
    card.appendChild(seal);

    var body = document.createElement('div');
    body.className = 'episode-body';

    var num = document.createElement('div');
    num.className = 'episode-number';
    num.textContent = 'Episode ' + ep.number;
    body.appendChild(num);

    var title = document.createElement('h2');
    title.className = 'episode-title';
    title.textContent = ep.title;
    body.appendChild(title);

    var meta = document.createElement('div');
    meta.className = 'episode-meta';
    appendMeta(meta, 'location', ep.location);
    appendSep(meta);
    appendMeta(meta, '', duration);
    appendSep(meta);
    appendMeta(meta, 'guide', 'guided by ' + guideName);
    appendSep(meta);
    appendMeta(meta, '', date);
    body.appendChild(meta);

    var summary = document.createElement('p');
    summary.className = 'episode-summary';
    summary.textContent = ep.summary;
    body.appendChild(summary);

    if (ep.walkPage) {
      var walkLink = document.createElement('a');
      walkLink.className = 'episode-walk-link';
      walkLink.href = ep.walkPage;
      walkLink.target = '_blank';
      walkLink.rel = 'noopener';
      walkLink.textContent = 'View the walk';
      body.appendChild(walkLink);
    }

    var player = buildPlayer(ep.audioUrl, index, duration);
    body.appendChild(player);

    if (ep.transcript) {
      var transcriptToggle = document.createElement('button');
      transcriptToggle.className = 'transcript-toggle';
      transcriptToggle.textContent = 'Read transcript';
      transcriptToggle.addEventListener('click', function () {
        var content = this.nextElementSibling;
        var isOpen = content.classList.toggle('open');
        this.textContent = isOpen ? 'Hide transcript' : 'Read transcript';
      });
      body.appendChild(transcriptToggle);

      var transcriptContent = document.createElement('div');
      transcriptContent.className = 'transcript-content';
      var transcriptText = document.createElement('p');
      transcriptText.textContent = ep.transcript;
      transcriptContent.appendChild(transcriptText);
      body.appendChild(transcriptContent);
    }

    card.appendChild(body);
    return card;
  }

  function appendMeta(parent, cls, text) {
    var span = document.createElement('span');
    if (cls) span.className = cls;
    span.textContent = text;
    parent.appendChild(span);
  }

  function appendSep(parent) {
    var span = document.createElement('span');
    span.className = 'separator';
    span.textContent = '\u00B7';
    parent.appendChild(span);
  }

  function buildPlayer(audioUrl, index, duration) {
    var wrapper = document.createElement('div');
    wrapper.className = 'episode-player';

    var btn = document.createElement('button');
    btn.className = 'play-btn';
    btn.setAttribute('data-src', audioUrl);
    btn.setAttribute('aria-label', 'Play episode');

    var ns = 'http://www.w3.org/2000/svg';

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

    wrapper.appendChild(btn);

    var bar = document.createElement('div');
    bar.className = 'progress-bar';
    bar.setAttribute('data-index', index);
    var fill = document.createElement('div');
    fill.className = 'progress-fill';
    bar.appendChild(fill);
    wrapper.appendChild(bar);

    var time = document.createElement('span');
    time.className = 'player-time';
    time.textContent = duration;
    wrapper.appendChild(time);

    return wrapper;
  }

  function renderEmpty() {
    var container = document.getElementById('episodes-list');
    if (!container) return;
    container.textContent = '';
    var div = document.createElement('div');
    div.className = 'episodes-empty reveal';
    var p = document.createElement('p');
    p.textContent = 'The first episode is being recorded. Stay tuned.';
    div.appendChild(p);
    container.appendChild(div);
    initReveal();
  }

  function updateCount(count) {
    var el = document.getElementById('episode-count');
    if (el && count > 0) {
      el.textContent = count + (count === 1 ? ' episode' : ' episodes');
    }
  }

  // --- Audio Player ---

  function initPlayer() {
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
      var card = btn.closest('.episode-card');
      if (!card) return;
      var fillEl = card.querySelector('.progress-fill');
      var timeEl = card.querySelector('.player-time');
      if (fillEl) fillEl.style.width = (currentAudio.currentTime / currentAudio.duration * 100) + '%';
      if (timeEl) timeEl.textContent = formatDuration(Math.floor(currentAudio.duration - currentAudio.currentTime));
    });

    currentAudio.addEventListener('ended', function () {
      btn.classList.remove('playing');
      var card = btn.closest('.episode-card');
      if (card) {
        var fillEl = card.querySelector('.progress-fill');
        if (fillEl) fillEl.style.width = '0%';
      }
      currentAudio = null;
      currentBtn = null;
    });

    currentAudio.play().catch(function () {
      btn.classList.remove('playing');
    });
  }

  // --- Scroll Reveal ---

  function initReveal() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.reveal').forEach(function (el) {
        el.classList.add('visible');
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal:not(.visible)').forEach(function (el) {
      observer.observe(el);
    });
  }

  // --- Arrival Bell ---

  function playArrivalBell() {
    if (sessionStorage.getItem('pilgrim-bell-played')) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    sessionStorage.setItem('pilgrim-bell-played', '1');

    document.addEventListener('click', function bellOnInteraction() {
      var bell = new Audio('assets/bell.mp3');
      bell.volume = 0.3;
      bell.play().catch(function () {});
      document.removeEventListener('click', bellOnInteraction);
    }, { once: true });
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

  // --- Init ---

  function init() {
    initTheme();
    loadEpisodes();
    initPlayer();
    initReveal();
    playArrivalBell();

    var toggle = document.querySelector('.theme-toggle');
    if (toggle) toggle.addEventListener('click', toggleTheme);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
