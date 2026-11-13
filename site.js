/* Shared site behaviour: line-by-line title highlight + page transition into case studies */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;


  /* ---------- 0. sticky nav: sizing, shadow, phone compaction ---------- */
  var navEl = document.querySelector('.navbar');
  var root = document.documentElement;
  var phoneMQ = window.matchMedia('(max-width: 640px)');
  var NAV_HIDE = 56;                      // logo row that slides away on phones (16px pad + 26px logo + 14px gap)
  function layoutNav() {
    if (!navEl) return;
    var w = root.clientWidth;
    root.style.setProperty('--nk', (w >= 1100 ? Math.max(1, Math.min(w / 1440, 1.25)) : 1).toFixed(4));
    var H = navEl.getBoundingClientRect().height;
    root.style.setProperty('--header-h', H + 'px');
    root.style.setProperty('--nav-vis', (phoneMQ.matches ? H - NAV_HIDE : H) + 'px');
  }
  function navScrollState() {
    if (!navEl) return;
    var y = window.pageYOffset;
    navEl.classList.toggle('is-stuck', y > 4);
    navEl.classList.toggle('is-compact', phoneMQ.matches && y > 60);
  }
  var navTick = false;
  window.addEventListener('scroll', function () {
    if (navTick) return; navTick = true;
    requestAnimationFrame(function () { navTick = false; navScrollState(); });
  }, { passive: true });

  /* ---------- hero: scale to exactly fill the first screen (home page, desktop) ---------- */
  var heroEl = document.querySelector('.hero');
  function fitHero() {
    if (!heroEl || !navEl) return;
    var hh = navEl.getBoundingClientRect().height, w = root.clientWidth, availH = window.innerHeight - hh;
    // text block grows with the screen up to 1.25x; the reel takes everything that is left (limited by the available height)
    var kc = Math.max(0.5, Math.min(w / 1440, availH / 758, 1.25));
    var gap = 64 * kc;                                   // space between the text block and the reel
    var remaining = w - 126 - 566 * kc - gap - 15 - 10;  // 15px gap to the sparkles, 10px = sparkle width minus its overhang
    var reelW = Math.max(320, Math.min(remaining, (availH - 52) * 708 / 384));
    heroEl.style.setProperty('--copy-extra', Math.max(0, (gap - 15) / kc).toFixed(1) + 'px');
    heroEl.style.setProperty('--kc', kc.toFixed(4));
    heroEl.style.setProperty('--reel-w', reelW.toFixed(1) + 'px');
  }
  function layoutAll() { layoutNav(); fitHero(); navScrollState(); }
  layoutAll();
  window.addEventListener('resize', layoutAll);
  window.addEventListener('orientationchange', layoutAll);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutAll);


  /* ---------- hero reel: silent, looping, only plays while it is on screen ---------- */
  (function () {
    var v = document.getElementById('reel');
    if (!v) return;
    var lock = function () { v.muted = true; v.defaultMuted = true; v.volume = 0; v.loop = true; v.playsInline = true; v.controls = false; };
    lock();
    v.addEventListener('volumechange', lock);          // if anything un-mutes it, mute it again
    v.addEventListener('loadedmetadata', lock);
    if (reduce) { v.removeAttribute('autoplay'); v.pause(); v.controls = true; return; }
    var onScreen = true;
    function play() { lock(); var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
    function sync() { if (onScreen && !document.hidden) play(); else v.pause(); }
    v.addEventListener('ended', function () { v.currentTime = 0; sync(); });
    document.addEventListener('visibilitychange', sync);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { onScreen = es[es.length - 1].isIntersecting; sync(); }, { threshold: 0 }).observe(v);
    }
    // belt and braces: also check position on scroll (some browsers are lax with observers on transformed elements)
    window.addEventListener('scroll', function () {
      var r = v.getBoundingClientRect(), vis = r.bottom > 0 && r.top < window.innerHeight;
      if (vis !== onScreen) { onScreen = vis; sync(); }
    }, { passive: true });
    sync();
  })();


  /* ---------- hero name: hover a letter to flip its weight; it reverts 3 seconds after the pointer leaves it ---------- */
  (function () {
    var wrap = document.getElementById('name-letters');
    if (!wrap) return;
    var chars = [].slice.call(wrap.querySelectorAll('.ch'));
    var REVERT_MS = 3000;

    // each letter carries a second, absolutely-positioned layer in the other weight (::after), so the resting
    // width never changes and the two weights crossfade. Spacing stays exactly as designed.
    chars.forEach(function (c) { c.setAttribute('data-c', c.textContent); });

    chars.forEach(function (c) {
      var timer = 0, last = 0;
      function pop() { c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
      function enter() {
        clearTimeout(timer);
        var now = Date.now();
        if (now - last < 160) return;          // ignore jitter while the pointer skims the edge
        last = now;
        c.classList.toggle('alt'); pop();      // hover again to flip it back; hover once more to flip it again
      }
      function leave() {
        clearTimeout(timer);
        timer = setTimeout(function () { if (c.classList.contains('alt')) { c.classList.remove('alt'); pop(); } }, REVERT_MS);
      }
      c.addEventListener('pointerenter', enter);
      c.addEventListener('pointerleave', leave);
      c._enter = enter;
    });

    // touch: dragging a finger across the name flips the letters it passes over (once per letter per pass)
    var touched = null;
    wrap.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'touch') return;
      var el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && el.classList && el.classList.contains('ch') && el !== touched) { touched = el; el._enter(); }
    });
    wrap.addEventListener('pointerup', function () { touched = null; });
    wrap.addEventListener('pointercancel', function () { touched = null; });
    wrap.addEventListener('pointerleave', function (e) { if (e.pointerType === 'touch') touched = null; });
  })();


  /* ---------- lightbox for case-study diagrams / images ---------- */
  (function () {
    var box = document.getElementById('lightbox');
    if (!box) return;
    var img = box.querySelector('.lightbox__img'), closeBtn = box.querySelector('.lightbox__close'), last = null;
    function open(btn) {
      var src = btn.querySelector('img');
      img.src = src.currentSrc || src.src; img.alt = src.alt; last = btn;
      box.hidden = false; box.classList.remove('is-zoomed');
      void box.offsetWidth; box.classList.add('is-open');
      document.documentElement.style.overflow = 'hidden';
      closeBtn.focus();
    }
    function close() {
      box.classList.remove('is-open', 'is-zoomed');
      document.documentElement.style.overflow = '';
      setTimeout(function () { box.hidden = true; img.removeAttribute('src'); }, reduce ? 0 : 250);
      if (last) last.focus();
    }
    [].forEach.call(document.querySelectorAll('.case__zoom'), function (b) { b.addEventListener('click', function () { open(b); }); });
    img.addEventListener('click', function (e) { e.stopPropagation(); box.classList.toggle('is-zoomed'); });
    box.addEventListener('click', function (e) { if (e.target !== img) close(); });
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !box.hidden) close(); });
  })();

  /* ---------- smooth, eased in-page scrolling (Check it out! button, Work tab, logo) ---------- */
  var scrollRaf = 0;
  function cancelScroll() { if (scrollRaf) { cancelAnimationFrame(scrollRaf); scrollRaf = 0; } }
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (ev) { window.addEventListener(ev, cancelScroll, { passive: true }); });
  function smoothScrollTo(y) {
    cancelScroll();
    var start = window.pageYOffset, dist = y - start;
    if (Math.abs(dist) < 2) return;
    if (reduce) { window.scrollTo(0, y); return; }
    var dur = Math.min(1500, Math.max(750, 520 + Math.abs(dist) * 0.55)), t0 = performance.now();
    var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };   // easeInOutCubic
    (function step(now) {
      var p = Math.min(1, (now - t0) / dur);
      window.scrollTo(0, start + dist * ease(p));
      scrollRaf = p < 1 ? requestAnimationFrame(step) : 0;
    })(t0);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.hasAttribute('data-pt') || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var u; try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.origin !== location.origin && u.protocol !== 'file:') return;
    if (u.pathname !== location.pathname || !u.hash && a.getAttribute('href') !== '#') return;
    var target = u.hash ? document.getElementById(decodeURIComponent(u.hash.slice(1))) : null;
    if (u.hash && !target) return;
    e.preventDefault();
    var navVis = parseFloat(getComputedStyle(root).getPropertyValue('--nav-vis')) || 0;
    var y = target ? target.getBoundingClientRect().top + window.pageYOffset - navVis : 0;
    smoothScrollTo(Math.max(0, Math.round(y)));
    if (history.pushState) { try { history.pushState(null, '', u.hash || location.pathname); } catch (err) {} }
  });

  /* ---------- 1. sequential line highlight on linked case-study titles ---------- */
  var links = [].slice.call(document.querySelectorAll('.cs--link .cs__link'));

  function splitLines(a) {
    if (a.dataset.orig === undefined) a.dataset.orig = a.textContent.trim().replace(/\s+/g, ' ');
    a.classList.remove('is-split');
    a.textContent = '';
    var words = a.dataset.orig.split(' '), spans = [];
    words.forEach(function (w, i) {
      var s = document.createElement('span'); s.textContent = w; a.appendChild(s); spans.push(s);
      if (i < words.length - 1) a.appendChild(document.createTextNode(' '));
    });
    var lines = [], lastTop = null;
    spans.forEach(function (s) {
      var t = s.offsetTop;
      if (lastTop === null || Math.abs(t - lastTop) > 4) { lines.push([]); lastTop = t; }
      lines[lines.length - 1].push(s.textContent);
    });
    a.textContent = '';
    var els = lines.map(function (ws, i) {
      var L = document.createElement('span'); L.className = 'hl-line'; L.textContent = ws.join(' ');
      a.appendChild(L); if (i < lines.length - 1) a.appendChild(document.createTextNode(' '));
      return L;
    });
    a.classList.add('is-split');
    // constant "pen speed": each line takes time proportional to its width; line 2 starts when line 1 is done
    var durs = els.map(function (L) { return Math.min(0.45, Math.max(0.14, L.getBoundingClientRect().width / 900)); });
    var OVERLAP = 0.55; // next line starts when the previous is ~55% through, so it reads as one stroke
    els.forEach(function (L, i) {
      var before = durs.slice(0, i).reduce(function (x, y) { return x + y; }, 0) * OVERLAP;
      var after = durs.slice(i + 1).reduce(function (x, y) { return x + y; }, 0) * OVERLAP;
      L.style.setProperty('--d', durs[i] + 's');
      L.style.setProperty('--in-delay', before + 's');   // hover: top line first
      L.style.setProperty('--out-delay', after + 's');   // un-hover: bottom line retracts first
    });
  }
  function layoutTitles() { links.forEach(splitLines); }
  if (links.length) {
    layoutTitles();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutTitles);
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(layoutTitles, 150); });
  }

  /* whole row is clickable (not just the title) — robust even while the text is mid-reveal */
  [].forEach.call(document.querySelectorAll('.cs--link'), function (row) {
    row.addEventListener('click', function (e) {
      if (e.target.closest('a')) return;
      var a = row.querySelector('a[href]'); if (a) a.click();
    });
  });

  /* ---------- 2. page transition: the row's image grows to fill the screen, then lands in the next page ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[data-pt]') : null;
    if (!a || reduce || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var row = a.closest('.cs'), media = row && row.querySelector('.cs__media');
    if (!media || !media.animate) return;
    e.preventDefault();
    var r = media.getBoundingClientRect();
    var ov = media.cloneNode(true);
    ov.classList.add('pt-overlay'); ov.setAttribute('aria-hidden', 'true');
    ov.style.cssText = 'position:fixed;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height +
      'px;margin:0;z-index:9999;flex:none;aspect-ratio:auto;order:0';
    document.body.appendChild(ov);
    document.documentElement.classList.add('pt-leaving');
    var go = function () {
      try { sessionStorage.setItem('pt-from', JSON.stringify({ n: a.dataset.pt })); } catch (err) {}
      window.location.href = a.href;
    };
    // the thumbnail dips up a touch, then drops off the bottom of the screen with a slight tilt
    var dist = Math.round(window.innerHeight - r.top + 60);
    var anim = ov.animate(
      [{ transform: 'translateY(0) rotate(0deg)', offset: 0, easing: 'cubic-bezier(.2,.7,.3,1)' },
       { transform: 'translateY(-14px) rotate(-1deg)', offset: 0.2, easing: 'cubic-bezier(.55,0,.85,.35)' },
       { transform: 'translateY(' + dist + 'px) rotate(4deg)', offset: 1 }],
      { duration: 720, fill: 'forwards' });
    anim.finished.then(go, go);
    setTimeout(go, 1600); // safety net
  });

  /* ---------- 3. scroll reveal: text rises in as it enters the viewport (all pages) ---------- */
  window.__rv = true;
  var SEL = window.__RV_SELECTORS;
  if (SEL && document.documentElement.classList.contains('js') && 'IntersectionObserver' in window) {
    var nodes = [].slice.call(document.querySelectorAll(SEL));
    var io = new IntersectionObserver(function (entries) {
      var vis = entries.filter(function (en) { return en.isIntersecting; })
                       .sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left; });
      vis.forEach(function (en, k) {
        en.target.style.setProperty('--rv-delay', Math.min(k, 6) * 80 + 'ms');
        en.target.classList.add('in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px 0px 0px' });
    var wait = document.documentElement.classList.contains('pt-in') ? 150 : 0;
    setTimeout(function () { nodes.forEach(function (n) { io.observe(n); }); }, wait);
  }

  // coming back with the browser's Back button: clear any leftover overlay
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    [].forEach.call(document.querySelectorAll('.pt-overlay'), function (n) { n.remove(); });
    document.documentElement.classList.remove('pt-leaving');
  });
})();


  /* ---------- play page: looping tile videos only run while on screen ---------- */
  (function () {
    var vids = [].slice.call(document.querySelectorAll('video.pl__media'));
    if (!vids.length) return;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) return;      // posters only
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { v.muted = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      });
    }, { rootMargin: '120px 0px', threshold: 0.05 });
    vids.forEach(function (v) { v.muted = true; v.loop = true; io.observe(v); });
  })();


/* ---------- project01: styleboard carousel (5s per slide, hover/focus pauses, dots jump) ---------- */
(function () {
  var pc = document.querySelector('.pc'); if (!pc) return;
  var slides = [].slice.call(pc.querySelectorAll('.pc__slide'));
  var dots = [].slice.call(pc.querySelectorAll('.pc__dot'));
  var MS = 3000, cur = 0, timer = 0, left = MS, started = 0, hover = false, inView = true;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  pc.style.setProperty('--pc-ms', MS + 'ms');
  function show(i) {
    cur = (i + slides.length) % slides.length;
    slides.forEach(function (s, k) { s.classList.toggle('is-active', k === cur); s.tabIndex = k === cur ? 0 : -1; });
    dots.forEach(function (d, k) { d.classList.remove('is-active'); if (k === cur) { void d.offsetWidth; d.classList.add('is-active'); } });
    left = MS; schedule();
  }
  function schedule() {
    clearTimeout(timer);
    if (reduce || hover || !inView || document.hidden) { pc.classList.add('is-paused'); return; }
    pc.classList.remove('is-paused'); started = Date.now();
    timer = setTimeout(function () { show(cur + 1); }, left);
  }
  function pause() { if (!timer) return; clearTimeout(timer); timer = 0; left = Math.max(300, left - (Date.now() - started)); pc.classList.add('is-paused'); }
  if (reduce) pc.classList.add('is-static');
  dots.forEach(function (d, k) { d.addEventListener('click', function () { show(k); }); });
  pc.addEventListener('mouseenter', function () { hover = true; pause(); });
  pc.addEventListener('mouseleave', function () { hover = false; schedule(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); else schedule(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) {
    inView = es[0].isIntersecting; if (inView) { timer = 0; schedule(); } else pause();
  }, { threshold: 0.25 }).observe(pc);
  // swipe on touch
  var x0 = null;
  pc.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  pc.addEventListener('touchend', function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1)); });
  schedule();
})();

/* avoid orphaned last words: glue the last two words of longer text blocks */
(function(){
  var sel='.case__p,.kb__p,.kb__list li,.case__figcap,.case__caption,.cs__desc,.sw p,.tl__card p,.hw__item p,.ab__row p,.pl__intro p';
  [].forEach.call(document.querySelectorAll(sel),function(el){
    if(el.textContent.split(/\s+/).length<5) return;
    var w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),n,last=null;
    while((n=w.nextNode())) if(n.nodeValue.trim()) last=n;
    if(last) last.nodeValue=last.nodeValue.replace(/\s+(\S+)(\s*)$/,'\u00A0$1$2');
  });
})();
