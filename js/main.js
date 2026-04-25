/* =============================================
   Pilgrim on the Path — Main Script
   ============================================= */

(function () {
  'use strict';

  var currentAudio = null;
  var currentBtn = null;
  var koanReflections = [];
  var currentKoanIndex = -1;
  var koanCycling = false;

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

  function slugify(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // --- Hash scroll ---

  // The episodes list is rendered after an async fetch, so the browser's
  // native scroll-to-anchor on page load fires before the #ep-N targets
  // exist. Call this after renderJourney (and on hashchange) to land
  // listeners on the right seal when they arrive from plgr.im/epN etc.
  //
  // Accepts both the new title-slug form (#ep-5-discernment-is-key) and
  // the legacy bare-number form (#ep-5) so old feed.xml links and past
  // shares keep working.
  function handleHashScroll() {
    var hash = window.location.hash;
    if (!hash || hash.length < 2) return;
    var target;
    try {
      target = document.querySelector(hash);
    } catch (e) {
      target = null; // invalid selector (e.g. unescaped chars) — try fallback
    }
    if (!target) {
      var m = hash.match(/^#ep-(\d+)/);
      if (m) {
        var n = m[1];
        target = document.getElementById('ep-' + n)
              || document.querySelector('[id^="ep-' + n + '-"]');
      }
    }
    if (!target) return;
    requestAnimationFrame(function () {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // --- Whisper (guest's parting gift) ---

  // 8 hand-crafted SVG glyphs, one per whisper category. Each is a 32x32
  // viewBox single-color line drawing, fill/stroke uses currentColor so
  // the parent CSS class can color it via the --whisper-{category} vars.
  var WHISPER_GLYPHS = {
    presence: '<circle cx="16" cy="16" r="3" fill="currentColor"/>'
            + '<circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/>',
    lightness: '<circle cx="9" cy="22" r="1.8" fill="currentColor"/>'
             + '<circle cx="16" cy="16" r="1.5" fill="currentColor"/>'
             + '<circle cx="22" cy="9" r="1.2" fill="currentColor"/>',
    wonder: '<line x1="16" y1="6" x2="16" y2="26" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
          + '<line x1="6" y1="16" x2="26" y2="16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
          + '<line x1="9" y1="9" x2="23" y2="23" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>'
          + '<line x1="9" y1="23" x2="23" y2="9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
    gratitude: '<path d="M16 25 C9 19 6 14 9 11 C12 8 15 11 16 13 C17 11 20 8 23 11 C26 14 23 19 16 25 Z" '
             + 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>',
    compassion: '<circle cx="12" cy="16" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/>'
              + '<circle cx="20" cy="16" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/>',
    courage: '<path d="M16 6 C19 11 22 14 22 19 C22 22.5 19.3 25 16 25 C12.7 25 10 22.5 10 19 C10 14 13 11 16 6 Z" '
           + 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
    stillness: '<circle cx="16" cy="16" r="3.5" fill="none" stroke="currentColor" stroke-width="1.5"/>'
             + '<circle cx="16" cy="16" r="7" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.55"/>'
             + '<circle cx="16" cy="16" r="10.5" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.28"/>',
    play: '<path d="M7 18 Q11 8 15 14 T22 14 Q25 13 25 11" '
        + 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
  };

  // Parse the category from a whisper URL like:
  //   https://cdn.pilgrimapp.org/audio/whisper/whisper-presence-4.aac
  function parseWhisperCategory(url) {
    if (!url) return null;
    var m = url.match(/whisper-([a-z]+)-\d+\.[a-z0-9]+$/i);
    return m ? m[1].toLowerCase() : null;
  }

  var currentWhisperAudio = null;
  var currentWhisperBtn = null;

  function buildWhisper(ep) {
    var category = parseWhisperCategory(ep.whisper);
    if (!category || !WHISPER_GLYPHS[category]) return null;

    var btn = document.createElement('button');
    btn.className = 'whisper-btn whisper-' + category;
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Play a whisper of ' + category + ' from the guest');
    btn.title = 'a whisper of ' + category;

    // localStorage flag persists the "received" state across sessions so the
    // ring stays once a listener has heard the gift.
    var storageKey = 'whisper-received-' + ep.number;
    if (localStorage.getItem(storageKey) === '1') {
      btn.classList.add('received');
    }

    var iconWrap = document.createElement('span');
    iconWrap.className = 'whisper-icon';
    // Inline SVG glyph — own generated content, not user input
    iconWrap.innerHTML = '<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">' + WHISPER_GLYPHS[category] + '</svg>';
    btn.appendChild(iconWrap);

    btn.addEventListener('click', function (event) {
      event.stopPropagation();
      handleWhisperClick(btn, ep, category, storageKey);
    });

    return btn;
  }

  function handleWhisperClick(btn, ep, category, storageKey) {
    // If this whisper is already playing, pause and return
    if (currentWhisperBtn === btn && currentWhisperAudio && !currentWhisperAudio.paused) {
      currentWhisperAudio.pause();
      btn.classList.remove('playing');
      return;
    }

    // If a different whisper was playing, stop it
    if (currentWhisperAudio) {
      currentWhisperAudio.pause();
      if (currentWhisperBtn) currentWhisperBtn.classList.remove('playing');
      currentWhisperAudio = null;
      currentWhisperBtn = null;
    }

    // If the main episode audio is playing, pause it so the whisper has the floor
    if (currentAudio && !currentAudio.paused) {
      currentAudio.pause();
      if (currentBtn) {
        currentBtn.classList.remove('playing');
        var stop = currentBtn.closest('.episode-stop');
        if (stop) stop.classList.remove('seal-playing');
      }
    }

    var audio = new Audio(ep.whisper);
    currentWhisperAudio = audio;
    currentWhisperBtn = btn;
    btn.classList.add('playing');

    audio.addEventListener('ended', function () {
      btn.classList.remove('playing');
      btn.classList.add('received');
      try { localStorage.setItem(storageKey, '1'); } catch (e) {}
      if (currentWhisperAudio === audio) {
        currentWhisperAudio = null;
        currentWhisperBtn = null;
      }
    });

    audio.addEventListener('error', function () {
      btn.classList.remove('playing');
      if (currentWhisperAudio === audio) {
        currentWhisperAudio = null;
        currentWhisperBtn = null;
      }
    });

    audio.play().then(function () {
      track('whisper_played', { number: ep.number, title: ep.title, category: category });
    }).catch(function () {
      btn.classList.remove('playing');
      currentWhisperAudio = null;
      currentWhisperBtn = null;
    });
  }

  // --- Share copy ---

  // Click the episode title to copy plgr.im/ep<N> to the clipboard.
  // The title morphs to "Link copied" for ~1.4s then restores.
  // Stops event propagation so the seal doesn't expand on click.
  function attachShareCopy(titleEl, ep) {
    function trigger(event) {
      event.stopPropagation();
      if (titleEl.classList.contains('copied')) return; // debounce mid-cycle
      var shareUrl = 'https://p.plgr.im/#ep-' + ep.number + '-' + slugify(ep.title);
      copyToClipboard(shareUrl).then(function (ok) {
        if (!ok) return;
        track('share_copied', { number: ep.number, title: ep.title });
        morphTitleToCopied(titleEl);
      });
    }
    titleEl.addEventListener('click', trigger);
    titleEl.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        trigger(event);
      }
    });
  }

  function morphTitleToCopied(titleEl) {
    var original = titleEl.textContent;
    titleEl.classList.add('copying');         // CSS: opacity 0
    setTimeout(function () {
      titleEl.textContent = 'Link copied';
      titleEl.classList.remove('copying');
      titleEl.classList.add('copied');        // CSS: highlight color
      setTimeout(function () {
        titleEl.classList.add('copying');
        setTimeout(function () {
          titleEl.textContent = original;
          titleEl.classList.remove('copying', 'copied');
        }, 200);
      }, 1000);
    }, 200);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(
        function () { return true; },
        function () { return false; }
      );
    }
    // Fallback for older browsers / non-secure contexts.
    return new Promise(function (resolve) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      resolve(ok);
    });
  }

  // --- Analytics ---

  function track(event, props) {
    if (window.umami && typeof window.umami.track === 'function') {
      try { window.umami.track(event, props || {}); } catch (e) {}
    }
  }

  function epProps(btn) {
    return {
      number: parseInt(btn.getAttribute('data-episode-number'), 10) || 0,
      title: btn.getAttribute('data-episode-title') || '',
      guide: btn.getAttribute('data-episode-guide') || '',
    };
  }

  // --- Audio Player ---

  function handlePlay(btn) {
    var src = btn.getAttribute('data-src');

    if (currentBtn === btn && currentAudio && !currentAudio.paused) {
      currentAudio.pause();
      btn.classList.remove('playing');
      var stopEl = btn.closest('.episode-stop');
      if (stopEl) stopEl.classList.remove('seal-playing');
      track('episode_pause', epProps(btn));
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
      track('episode_resume', epProps(btn));
      return;
    }

    currentAudio = new Audio(src);
    currentBtn = btn;
    btn.classList.add('playing');
    var playingStop = btn.closest('.episode-stop');
    if (playingStop) playingStop.classList.add('seal-playing');

    var progressMarks = { 25: false, 50: false, 75: false };

    currentAudio.addEventListener('timeupdate', function () {
      if (!currentAudio.duration) return;
      var stop = btn.closest('.episode-stop');
      if (!stop) return;
      var fillEl = stop.querySelector('.progress-fill');
      var timeEl = stop.querySelector('.player-time');
      if (fillEl) fillEl.style.width = (currentAudio.currentTime / currentAudio.duration * 100) + '%';
      if (timeEl) timeEl.textContent = formatDuration(Math.floor(currentAudio.duration - currentAudio.currentTime));

      var pct = (currentAudio.currentTime / currentAudio.duration) * 100;
      [25, 50, 75].forEach(function (threshold) {
        if (!progressMarks[threshold] && pct >= threshold) {
          progressMarks[threshold] = true;
          var props = epProps(btn);
          props.percent = threshold;
          track('episode_progress', props);
        }
      });
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
      track('episode_ended', epProps(btn));
      currentAudio = null;
      currentBtn = null;
    });

    track('episode_play', epProps(btn));
    currentAudio.play().catch(function () {
      btn.classList.remove('playing');
      var failStop = btn.closest('.episode-stop');
      if (failStop) failStop.classList.remove('seal-playing');
      track('episode_play_failed', epProps(btn));
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
    koanReflections = sorted
      .map(function (ep) { return ep.reflection; })
      .filter(function (r) { return r; });
    if (koanReflections.length > 0) {
      currentKoanIndex = Math.floor(Math.random() * koanReflections.length);

      var koan = document.createElement('div');
      koan.className = 'journey-koan reveal';
      var koanP = document.createElement('p');
      koanP.className = 'journey-koan-text';
      koanP.textContent = koanReflections[currentKoanIndex];
      koan.appendChild(koanP);

      if (koanReflections.length > 1) {
        var koanBtn = document.createElement('button');
        koanBtn.className = 'journey-koan-cycle';
        koanBtn.setAttribute('aria-label', 'Show another reflection');
        koanBtn.textContent = '\u2766';
        koan.appendChild(koanBtn);
      }

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
      stop.id = 'ep-' + ep.number + '-' + slugify(ep.title);
      stop.setAttribute('data-episode', ep.number);
      if (localStorage.getItem('visited-ep-' + ep.number)) {
        stop.classList.add('seal-visited');
      }
      if (isWalkExpired(ep)) {
        stop.classList.add('seal-returned');
      }

      var sealWrap = document.createElement('div');
      sealWrap.className = 'seal-container';
      sealWrap.setAttribute('role', 'button');
      sealWrap.setAttribute('tabindex', '0');
      sealWrap.setAttribute('aria-label', 'Episode ' + ep.number + ': ' + ep.title);
      // PilgrimSeal.generate returns our own generated SVG string — not user content
      sealWrap.innerHTML = PilgrimSeal.generate(ep); // safe: own generated SVG

      // Randomize each seal's breathing cycle so they feel organic, not
      // synchronized. Duration between ~3.4s and ~5.2s, with a negative
      // phase delay up to -5s so seals are already mid-cycle at page load
      // rather than all starting at scale(1) simultaneously. The vars are
      // set on the .episode-stop parent so the whisper icon (a sibling of
      // the seal in the expanded card) inherits the same rhythm — seal +
      // whisper breathe in unison as one organism.
      var breatheDur = (3.4 + Math.random() * 1.8).toFixed(2);
      var breatheDelay = (-Math.random() * 5).toFixed(2);
      stop.style.setProperty('--seal-breathe-duration', breatheDur + 's');
      stop.style.setProperty('--seal-breathe-delay', breatheDelay + 's');

      stop.appendChild(sealWrap);

      var label = document.createElement('div');
      label.className = 'episode-label';

      var labelTitle = document.createElement('div');
      labelTitle.className = 'episode-label-title';
      labelTitle.textContent = ep.title;
      labelTitle.setAttribute('role', 'button');
      labelTitle.setAttribute('tabindex', '0');
      labelTitle.setAttribute('aria-label', 'Copy share link for ' + ep.title);
      labelTitle.setAttribute('aria-live', 'polite');
      labelTitle.title = 'Click to copy share link';
      attachShareCopy(labelTitle, ep);
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

  function setupAudioPreview(sealWrap, ep) {
    if (!window.matchMedia('(hover: hover)').matches) return;
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

  function isWalkExpired(ep) {
    return ep.walkPage && ep.walkPageExpires && new Date(ep.walkPageExpires + 'T00:00:00') < new Date();
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
    btn.setAttribute('data-episode-number', ep.number);
    btn.setAttribute('data-episode-title', ep.title);
    btn.setAttribute('data-episode-guide', ep.guide);
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
      if (isWalkExpired(ep)) {
        var seenKey = 'returned-ep-' + ep.number;
        var alreadySeen = false;
        try { alreadySeen = localStorage.getItem(seenKey); } catch (e) {}

        if (alreadySeen || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          var returned = document.createElement('div');
          returned.className = 'walk-returned';
          returned.textContent = 'This walk has returned to the trail.';
          wrapper.appendChild(returned);
          if (!alreadySeen) { try { localStorage.setItem(seenKey, '1'); } catch (e) {} }
        } else {
          var ghostLink = document.createElement('div');
          ghostLink.className = 'walk-returned-ghost';
          ghostLink.textContent = 'View the walk';
          ghostLink.setAttribute('aria-hidden', 'true');
          wrapper.appendChild(ghostLink);

          var returned = document.createElement('div');
          returned.className = 'walk-returned';
          returned.textContent = 'This walk has returned to the trail.';
          returned.style.display = 'none';
          wrapper.appendChild(returned);

          wrapper.setAttribute('data-ceremony-pending', ep.number);
        }
      } else {
        var walkLink = document.createElement('a');
        walkLink.className = 'episode-walk-link';
        // Use the plgr.im short URL instead of the raw walk page. plgrim
        // worker redirects /ep<N> to ep.walkPage via episodes.json lookup
        // and tracks the click via Umami, so this gives us visibility into
        // which episodes drive walk-page visits.
        walkLink.href = 'https://plgr.im/ep' + ep.number;
        walkLink.target = '_blank';
        walkLink.rel = 'noopener';
        walkLink.textContent = 'View the walk';
        wrapper.appendChild(walkLink);
      }
    }

    var whisperBtn = buildWhisper(ep);
    if (whisperBtn) wrapper.appendChild(whisperBtn);

    if (ep.transcript) {
      var transcriptToggle = document.createElement('button');
      transcriptToggle.className = 'transcript-toggle';
      transcriptToggle.textContent = 'Read transcript';
      transcriptToggle.addEventListener('click', function () {
        var content = this.nextElementSibling;
        var isOpen = content.classList.toggle('open');
        this.textContent = isOpen ? 'Hide transcript' : 'Read transcript';
        if (isOpen) {
          track('transcript_open', { number: ep.number, title: ep.title });
        }
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
      track('seal_click', { number: ep.number, title: ep.title, guide: ep.guide });

      var pending = card.getAttribute('data-ceremony-pending');
      if (pending) {
        card.removeAttribute('data-ceremony-pending');
        var ghost = card.querySelector('.walk-returned-ghost');
        var returned = card.querySelector('.walk-returned');
        if (ghost) {
          ghost.classList.add('walk-returned-ceremony-out');
          ghost.addEventListener('animationend', function () { ghost.style.display = 'none'; }, { once: true });
        }
        if (returned) {
          returned.style.display = '';
          returned.classList.add('walk-returned-ceremony-in');
        }
        try { localStorage.setItem('returned-ep-' + pending, '1'); } catch (e) {}
      }
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

  // --- Scroll Sound (Web Audio API) ---

  var scrollCtx = null;
  var scrollGain = null;
  var scrollSource = null;
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
      var scrollSoundStarted = false;

      function startOnGesture() {
        if (scrollSoundStarted) return;
        scrollSoundStarted = true;
        enableScrollSound();
        document.removeEventListener('click', startOnGesture);
        document.removeEventListener('touchstart', startOnGesture);
      }
      document.addEventListener('click', startOnGesture);
      document.addEventListener('touchstart', startOnGesture);
      return;
    }

    invite.addEventListener('click', function () {
      enableScrollSound();
      invite.classList.add('hidden');
      localStorage.setItem('scroll-sound', 'on');
    });
  }

  function enableScrollSound() {
    if (scrollCtx) return;
    scrollCtx = new (window.AudioContext || window.webkitAudioContext)();
    scrollGain = scrollCtx.createGain();
    scrollGain.gain.value = 0;
    scrollGain.connect(scrollCtx.destination);

    var season = document.documentElement.getAttribute('data-season') || 'spring';
    var p = scrollCtx.resume();
    if (p && typeof p.then === 'function') {
      p.then(function () { loadScrollAudio(season); }).catch(function () {});
    } else {
      loadScrollAudio(season);
    }
    scrollSoundEnabled = true;

    var mute = document.createElement('button');
    mute.className = 'scroll-sound-mute';
    mute.textContent = '\uD83D\uDD0A';
    mute.setAttribute('aria-label', 'Mute scroll sound');
    mute.addEventListener('click', function () {
      scrollSoundEnabled = !scrollSoundEnabled;
      mute.textContent = scrollSoundEnabled ? '\uD83D\uDD0A' : '\uD83D\uDD07';
      if (!scrollSoundEnabled && scrollGain) {
        scrollGain.gain.value = 0;
      }
      localStorage.setItem('scroll-sound', scrollSoundEnabled ? 'on' : 'off');
    });
    document.body.appendChild(mute);

    lastScrollY = window.scrollY;
    window.addEventListener('scroll', handleScrollSound, { passive: true });

    scrollDecay = setInterval(function () {
      scrollVelocity *= 0.75;
      if (scrollGain && scrollSoundEnabled) {
        scrollGain.gain.value = Math.min(scrollVelocity, maxScrollVolume);
      }
    }, 50);
  }

  function loadScrollAudio(season) {
    var url = SCROLL_SOUNDS[season];
    if (!url || !scrollCtx) return;
    if (scrollSource) {
      try { scrollSource.stop(); } catch (e) {}
      scrollSource.disconnect();
      scrollSource = null;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function () {
      if (xhr.status !== 200) return;
      scrollCtx.decodeAudioData(xhr.response, function (audioBuffer) {
        if (scrollSource) {
          try { scrollSource.stop(); } catch (e) {}
          scrollSource.disconnect();
          scrollSource = null;
        }
        scrollSource = scrollCtx.createBufferSource();
        scrollSource.buffer = audioBuffer;
        scrollSource.loop = true;
        scrollSource.connect(scrollGain);
        scrollSource.start();
      });
    };
    xhr.send();
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
        handleHashScroll();
      })
      .catch(function () {
        renderJourney([]);
      });

    window.addEventListener('hashchange', handleHashScroll);

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
        if (window.Universe) {
          if (document.body.classList.contains('constellation')) {
            window.Universe.activate();
          } else {
            window.Universe.deactivate();
          }
        }
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

      var koanCycleBtn = e.target.closest('.journey-koan-cycle');
      if (koanCycleBtn && !koanCycling && koanReflections.length > 1) {
        var textEl = document.querySelector('.journey-koan-text');
        if (textEl) {
          koanCycling = true;
          var nextIdx;
          do {
            nextIdx = Math.floor(Math.random() * koanReflections.length);
          } while (nextIdx === currentKoanIndex);
          currentKoanIndex = nextIdx;

          textEl.classList.add('fading');
          setTimeout(function () {
            textEl.textContent = koanReflections[nextIdx];
            textEl.classList.remove('fading');
            koanCycling = false;
          }, 400);
        }
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
