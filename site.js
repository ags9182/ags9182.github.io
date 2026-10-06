/* Shared site behaviour: line-by-line title highlight + page transition into case studies */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    // landing frame: centred, 16:9, never bigger than ~720px wide
    var lw = Math.min(window.innerWidth - 40, 720), lh = Math.round(lw * 9 / 16);
    var land = { l: Math.round((window.innerWidth - lw) / 2), t: Math.round((window.innerHeight - lh) / 2), w: lw, h: lh };
    var go = function () {
      try { sessionStorage.setItem('pt-from', JSON.stringify({ n: a.dataset.pt, l: land.l, t: land.t, w: land.w, h: land.h })); } catch (err) {}
      window.location.href = a.href;
    };
    var anim = ov.animate(
      [{ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: '20px' },
       { left: land.l + 'px', top: land.t + 'px', width: land.w + 'px', height: land.h + 'px', borderRadius: '15px' }],
      { duration: 600, easing: 'cubic-bezier(.65,0,.25,1)', fill: 'forwards' });
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
    var wait = document.documentElement.classList.contains('pt-in') ? 650 : 0; // let the page transition land first
    setTimeout(function () { nodes.forEach(function (n) { io.observe(n); }); }, wait);
  }

  // coming back with the browser's Back button: clear any leftover overlay
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    [].forEach.call(document.querySelectorAll('.pt-overlay'), function (n) { n.remove(); });
    document.documentElement.classList.remove('pt-leaving');
  });
})();
