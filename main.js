'use strict';
// Portfolio behaviour: theme, scroll engine (progress, parallax, pinned sections), and one small live demo per project.
// Every demo runs only while it's on screen and the tab is visible, and has a Pause where it moves on its own.
(() => {
  const root = document.documentElement;
  const calm = !root.classList.contains('motion'); // the visitor prefers less motion
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const ease = k => 1 - Math.pow(1 - k, 3);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const svgEl = (tag, attrs) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

  // Calls on(true) when target is on screen and the tab is showing, on(false) otherwise.
  function whenVisible(target, on, threshold = 0) {
    let inView = false, was = false;
    const update = () => { const now = inView && !document.hidden; if (now !== was) on(was = now); };
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; update(); }, { threshold }).observe(target);
    document.addEventListener('visibilitychange', update);
  }

  // Runs fn(dt) every frame while target is visible and not paused. pauseBtn toggles it.
  function loop(target, fn, pauseBtn) {
    let raf = 0, last = 0, vis = false, paused = false;
    const frame = t => { const dt = last ? Math.min(100, t - last) : 16; last = t; fn(dt); raf = requestAnimationFrame(frame); };
    const sync = () => {
      const run = vis && !paused;
      if (run && !raf) { last = 0; raf = requestAnimationFrame(frame); }
      else if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
    };
    whenVisible(target, v => { vis = v; sync(); });
    pauseBtn?.addEventListener('click', () => {
      paused = !paused;
      pauseBtn.setAttribute('aria-pressed', paused);
      pauseBtn.textContent = paused ? 'Play' : 'Pause';
      sync();
    });
  }

  // Moves a dot along an SVG path. Resolves when it arrives (instantly when motion is off).
  function travel(dot, path, dur = 520, reverse = false) {
    if (calm) return sleep(180);
    const len = path.getTotalLength();
    return new Promise(res => {
      const t0 = performance.now();
      const step = now => {
        const k = clamp((now - t0) / dur), p = path.getPointAtLength((reverse ? 1 - ease(k) : ease(k)) * len);
        dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); dot.style.opacity = 1;
        if (k < 1) requestAnimationFrame(step); else { dot.style.opacity = 0; res(); }
      };
      requestAnimationFrame(step);
    });
  }

  // Range inputs paint their filled part through --p.
  for (const r of $$('input[type=range]')) {
    const upd = () => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%');
    r.addEventListener('input', upd); upd();
  }

  /* ---------- Theme ---------- */
  const themeBtn = $('#themeToggle');
  const light = matchMedia('(prefers-color-scheme: light)');
  const isDark = () => (root.dataset.theme || (light.matches ? 'light' : 'dark')) === 'dark';
  const label = () => themeBtn.setAttribute('aria-label', isDark() ? 'Switch to light mode' : 'Switch to dark mode');
  themeBtn.addEventListener('click', () => {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch {}
    label();
  });
  light.addEventListener('change', label);
  label();

  const menu = $('#menu');
  menu.addEventListener('click', e => { if (e.target.closest('a')) menu.hidePopover?.(); });

  /* ---------- Reveals ---------- */
  // Headlines use a CSS scroll timeline where supported; cards and demos (and headlines elsewhere) fade in once.
  if (!calm) {
    const scrollTimeline = CSS.supports?.('animation-timeline: view()');
    const seen = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px' });
    $$(scrollTimeline ? '.rise' : '.reveal, .rise').forEach(r => seen.observe(r));
  }

  /* ---------- Scrollspy ---------- */
  const navFor = { meesho: 'meesho', s2s: 'meesho', audit: 'meesho', pool: 'meesho', now: 'meesho', goquant: 'goquant', projects: 'projects', principles: 'principles', skills: 'skills', contact: 'contact', top: '', thesis: '' };
  const navLinks = $$('.nav-links a');
  const spy = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const key = navFor[e.target.id];
      for (const a of navLinks) {
        if (a.hash === '#' + key) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      }
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main > section[id]').forEach(s => spy.observe(s));

  /* ---------- Scroll engine: progress bar, hero parallax, thesis words, horizontal principles ---------- */
  const bar = $('.progress i');
  const hero = $('.hero'), heroIn = $('.hero-in'), glow = $('.hero-glow'), dots = $('.hero-grid');
  const thesis = $('.thesis'), wordsEl = $('[data-words]');
  const principles = $('#principles'), hz = $('.hz', principles), hzPin = $('.hz-pin', principles), track = $('#ptrack'), hzBar = $('#hz-bar');
  let words = [], lit = -1, vh = 0, docH = 0, L = {};

  // Split the thesis into words (screen readers get the plain sentence).
  if (wordsEl) {
    const text = wordsEl.textContent.trim().replace(/\s+/g, ' ');
    const accent = /^(invisible|minutes,|early|record\.|off\.)$/;
    const vis = el('span'); vis.setAttribute('aria-hidden', 'true');
    for (const w of text.split(' ')) { const s = el('span', 'w' + (accent.test(w) ? ' hl' : ''), w); vis.append(s, ' '); words.push(s); }
    wordsEl.replaceChildren(el('span', 'sr-only', text), vis);
  }

  function measure() {
    vh = root.clientHeight;
    const top = e => e.getBoundingClientRect().top + scrollY;
    if (!calm) {
      // Pin the principles only when the pinned layout fits the screen; otherwise it stays a normal grid.
      principles.classList.add('pinned');
      const extra = Math.max(0, track.scrollWidth - root.clientWidth);
      const need = $('.hz-head', principles).offsetHeight + track.offsetHeight + 80;
      if (need > vh || extra === 0) principles.classList.remove('pinned');
      else hz.style.setProperty('--hz-h', `${Math.round(extra + vh * 1.35)}px`);
      L.extra = extra;
      L.hz = { top: top(hz), h: hz.offsetHeight };
      L.thesis = { top: top(thesis), h: thesis.offsetHeight };
      L.hero = hero.offsetHeight;
    }
    docH = root.scrollHeight;
    paint();
  }

  let ticking = false;
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(paint); } };
  function paint() {
    ticking = false;
    const y = scrollY;
    bar.style.transform = `scaleX(${clamp(y / Math.max(1, docH - vh))})`;
    if (calm) return;
    // Hero: the headline drifts down and fades while the glow moves slower than the page.
    const hp = clamp(y / L.hero);
    if (hp < 1 || heroIn.style.opacity !== '0') {
      heroIn.style.transform = `translate3d(0, ${hp * 140}px, 0) scale(${1 - hp * .05})`;
      heroIn.style.opacity = clamp(1 - hp * 1.5);
      glow.style.transform = `translate3d(0, ${hp * 260}px, 0)`;
      dots.style.transform = `translate3d(0, ${hp * 90}px, 0)`;
    }
    // Thesis: light words in step with scroll while it's pinned.
    if (words.length) {
      const t = L.thesis, from = t.top - vh * .35, to = t.top + t.h - vh * 1.25;
      const n = Math.round(clamp((y - from) / (to - from)) * words.length);
      if (n !== lit) { words.forEach((w, i) => w.classList.toggle('lit', i < n)); lit = n; }
    }
    // Principles: vertical scroll drives the horizontal track.
    if (principles.classList.contains('pinned')) {
      const p = clamp((y - L.hz.top - vh * .15) / Math.max(1, L.extra));
      track.style.transform = `translate3d(${-p * L.extra}px, 0, 0)`;
      hzBar.style.transform = `scaleX(${p})`;
    }
  }
  let rz = 0;
  const remeasure = () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(measure); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', remeasure);
  new ResizeObserver(remeasure).observe(document.body);
  measure();

  /* ---------- S2S workload identity ---------- */
  {
    const demo = $('#s2s-demo'), svg = $('.flow', demo), pkt = $('.pkt', svg);
    const node = id => $('#' + id, svg);
    const STAGES = {
      prove: ['n-caller', 'n-auth', 'e-prove', 'l-prove'],
      mint: ['n-auth', 'n-ident', 'e-mint', 'l-mint'],
      call: ['n-caller', 'n-recv', 'e-call', 'l-call'],
      verify: ['n-recv', 'n-ident', 'e-jwks', 'l-jwks'],
      decide: ['n-recv', 'n-pol', 'e-pol', 'l-pol'],
      rollout: ['n-recv'],
    };
    const S = { mode: 'shadow', caller: 'billing', kill: false, keys: [{ kid: 'k1', st: 'signing' }], next: 2, tokens: {}, n: 0, busy: false, again: false };
    const verdictEl = $('#s2s-verdict'), logEl = $('#s2s-log'), tokEl = $('#tok'), keysEl = $('#keys'), revokeBtn = $('#s2s-revoke');

    const setStage = s => {
      $$('.on', svg).forEach(e => e.classList.remove('on'));
      (STAGES[s] || []).forEach(id => node(id).classList.add('on'));
    };
    const outcome = cls => { for (const n of $$('.nd', svg)) n.classList.remove('good', 'bad', 'warn'); if (cls) node('n-recv').classList.add(cls); };
    const verdict = (code, kind, text) => { verdictEl.dataset.v = kind; verdictEl.replaceChildren(el('b', '', code), el('span', '', text)); };
    // Fixed rows whose contents shift down, so new entries never move the layout.
    const logRows = Array.from({ length: 6 }, () => el('li')), entries = [];
    logEl.append(...logRows);
    const log = (kind, html) => {
      entries.unshift([kind, html]); entries.length = Math.min(entries.length, logRows.length);
      logRows.forEach((li, i) => { li.className = entries[i]?.[0] || ''; li.innerHTML = entries[i]?.[1] || ''; });
      if (!calm) { void logRows[0].offsetWidth; logRows[0].classList.add('new'); }
    };
    const keyOf = kid => S.keys.find(k => k.kid === kid);
    const heldKid = () => S.tokens[S.caller]?.kid || S.keys.find(k => k.st === 'signing').kid;

    function render() {
      keysEl.replaceChildren(...S.keys.map(k => {
        const li = el('li', '', `<code>${k.kid}</code><span>${{ signing: 'signing', published: 'still published', revoked: 'revoked' }[k.st]}</span>`);
        li.dataset.st = k.st; return li;
      }), el('li', 'hint', 'Receivers trust every published key.'));
      const t = S.tokens[S.caller];
      if (!t) tokEl.innerHTML = `<span class="c">// ${S.caller} has no token: next request exchanges one</span>`;
      else {
        const bad = keyOf(t.kid)?.st === 'revoked';
        tokEl.innerHTML = `{\n  <span class="k">"iss"</span>: <span class="s">"identity-service"</span>,\n  <span class="k">"sub"</span>: <span class="s">"workload:${S.caller}"</span>,\n  <span class="k">"aud"</span>: <span class="s">"ledger"</span>,\n  <span class="k">"kid"</span>: <span class="${bad ? 'bad' : 's'}">"${t.kid}"</span>,${bad ? ' <span class="c">// revoked</span>' : ''}\n  <span class="k">"exp"</span>: <span class="s">"minutes after issue"</span>\n}`;
      }
      node('caller-name').textContent = S.caller;
      node('recv-mode').textContent = S.kill ? 'receiver · shadow (kill switch)' : `receiver · ${S.mode}`;
      revokeBtn.textContent = `Revoke ${heldKid()}`;
    }

    async function send() {
      if (S.busy) { S.again = true; return; }
      S.busy = true;
      const c = S.caller, n = ++S.n;
      outcome();
      if (!S.tokens[c]) {
        setStage('prove'); await travel(pkt, node('e-prove'));
        setStage('mint'); await travel(pkt, node('e-mint'));
        S.tokens[c] = { kid: S.keys.find(k => k.st === 'signing').kid };
        log('sys', `#${n} minted a token for <b>${c}</b>, signed with ${S.tokens[c].kid}`);
        render();
        await travel(pkt, node('e-mint'), 360, true);
        await travel(pkt, node('e-prove'), 360, true);
      }
      setStage('call'); await travel(pkt, node('e-call'));
      setStage('verify'); await travel(pkt, node('e-jwks'));
      const t = S.tokens[c], key = keyOf(t.kid);
      if (!key || key.st === 'revoked') {
        outcome('bad');
        verdict('401', 'deny', `Rejected in every mode: ${t.kid} was revoked, so it left the key set. Shadow and the kill switch relax policy, never identity. ${c} drops its token and exchanges a new one next time.`);
        log('deny', `#${n} ${c} → ledger <b>401</b> key ${t.kid} revoked`);
        S.tokens[c] = null; render();
      } else {
        setStage('decide'); await travel(pkt, node('e-pol'));
        const granted = c === 'billing', mode = S.kill ? 'shadow' : S.mode;
        if (granted) {
          outcome('good');
          verdict('200', 'ok', `Signature valid (${t.kid}), audience matches, and billing is granted to call ledger.`);
          log('ok', `#${n} ${c} → ledger <b>200</b> allowed · ${t.kid}`);
        } else if (mode === 'enforce') {
          outcome('bad');
          verdict('403', 'deny', 'Signature is fine, but reports has no grant for ledger, and Enforce means no.');
          log('deny', `#${n} ${c} → ledger <b>403</b> no grant`);
        } else if (S.kill) {
          outcome('warn');
          verdict('200', 'kill', 'Kill switch on: receivers are back in shadow, so this missing grant is logged as a would-deny and let through. No redeploy needed.');
          log('kill', `#${n} ${c} → ledger <b>200</b> would deny · kill switch`);
        } else {
          outcome('warn');
          verdict('200', 'shadow', 'Shadow mode: reports has no grant. It is logged as a would-deny and let through, so the rollout breaks nothing while you watch.');
          log('shadow', `#${n} ${c} → ledger <b>200</b> would deny · shadow`);
        }
      }
      setStage('');
      S.busy = false;
      if (S.again) { S.again = false; send(); }
    }

    function rotate() {
      for (const k of S.keys) if (k.st === 'signing') k.st = 'published';
      const kid = 'k' + S.next++;
      S.keys.push({ kid, st: 'signing' });
      while (S.keys.length > 4) S.keys.shift();
      return kid;
    }
    $('#s2s-send').addEventListener('click', send);
    $('#s2s-rotate').addEventListener('click', () => {
      const old = S.keys.find(k => k.st === 'signing').kid, kid = rotate();
      log('sys', `rotated: ${kid} signs new tokens, ${old} stays published until its tokens expire`);
      verdict('↻', '', `Rotated. ${kid} signs from now on; ${old} stays in the key set, so tokens already out keep working.`);
      render(); send();
    });
    revokeBtn.addEventListener('click', () => {
      const kid = heldKid(), k = keyOf(kid);
      const wasSigning = k.st === 'signing';
      k.st = 'revoked';
      let note = '';
      if (wasSigning) note = `, ${rotate()} takes over signing`;
      log('deny', `${kid} marked compromised: pulled from the key set${note}`);
      verdict('✕', 'deny', `${kid} is revoked and gone from the key set${note}. Every token it signed now fails, everywhere, at once.`);
      render(); send();
    });
    $$('input[name=s2s-mode]', demo).forEach(r => r.addEventListener('change', () => { S.mode = r.value; render(); send(); }));
    $$('input[name=s2s-caller]', demo).forEach(r => r.addEventListener('change', () => { S.caller = r.value; render(); send(); }));
    $('#s2s-kill').addEventListener('change', e => {
      S.kill = e.target.checked;
      log('kill', `kill switch ${S.kill ? 'ON: receivers forced to shadow' : 'off: back to each receiver\'s own mode'}`);
      render(); send();
    });
    render();

    // While reading the steps, the diagram follows along.
    const steps = $$('#s2s .step');
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) {
        steps.forEach(s => s.classList.toggle('on', s === e.target));
        if (!S.busy) setStage(e.target.dataset.stage);
      }
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(s => io.observe(s));
  }

  /* ---------- Audit stream ---------- */
  {
    const demo = $('#audit-demo'), list = $('#audit-list'), filter = $('#audit-filter');
    const TYPES = [['token.minted', 60], ['principal.registered', 10], ['binding.changed', 12], ['user.deleted', 12], ['key.compromised', 3]];
    const W = ['billing', 'ledger', 'search', 'catalog', 'notifications', 'payments', 'reports'];
    const counts = Object.fromEntries(TYPES.map(([t]) => [t, 0]));
    const written = [];
    let show = 'all', kid = 7, buffer = [], dropped = 0, slow = false, genIn = 400, writeIn = 0;
    const hex = n => Array.from({ length: n }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
    const detail = {
      'token.minted': () => { const a = pick(W); let b = pick(W); if (b === a) b = 'ledger'; return `workload:${a} → aud ${b} · kid k${kid}`; },
      'principal.registered': () => `workload:${pick(W)} · synced from the infra catalog`,
      'binding.changed': () => { const w = pick(W); return `workload:${w} ⇄ service account ${w}-sa`; },
      'user.deleted': () => `user u_${hex(6)} · on the user's request`,
      'key.compromised': () => `kid k${kid++} · by an operator · pulled from the key set`,
    };
    const opts = [['all', 'All'], ...TYPES.map(([t]) => [t, t])];
    filter.append(...opts.map(([v, txt], i) => {
      const l = el('label', '', `<input type="radio" name="audit-f" value="${v}"${i ? '' : ' checked'}><span>${txt} <i data-c="${v}"></i></span>`);
      return l;
    }));
    // Ten fixed rows; a new event rewrites their contents instead of inserting, so nothing shifts.
    const rows = Array.from({ length: 10 }, () => el('li', 'ev empty', '<time></time><span class="ty"></span><span class="d"></span><span class="ttl">TTL</span>'));
    list.append(...rows);
    const renderAll = fresh => {
      const shown = written.filter(e => show === 'all' || e.type === show);
      rows.forEach((li, i) => {
        const e = shown[i], [time, ty, d] = li.children;
        li.classList.toggle('empty', !e);
        li.classList.remove('new');
        if (!e) return;
        time.textContent = e.time; ty.textContent = e.type; ty.dataset.t = e.type; d.textContent = e.d;
      });
      if (fresh && !calm) { void rows[0].offsetWidth; rows[0].classList.add('new'); }
    };
    const renderCounts = () => {
      let all = 0;
      for (const [t] of TYPES) { $(`[data-c="${t}"]`, filter).textContent = counts[t]; all += counts[t]; }
      $('[data-c="all"]', filter).textContent = all;
    };
    filter.addEventListener('change', e => { show = e.target.value; renderAll(); });
    const meter = () => {
      const b = $('#audit-buf'); b.textContent = buffer.length; b.className = buffer.length >= 40 ? 'bad' : buffer.length > 20 ? 'warn' : '';
      const d = $('#audit-drop'); d.textContent = dropped; d.className = dropped ? 'bad' : '';
      $('#audit-lat').textContent = `${38 + Math.floor(Math.random() * 7)} ms`;
    };
    $('#audit-slow').addEventListener('change', e => {
      slow = e.target.checked;
      $('#pipe-w').classList.toggle('hot', slow);
      $('#pipe-w').textContent = slow ? 'writer · slow' : 'writer';
    });
    const write = ev => {
      written.unshift(ev); written.length = Math.min(written.length, 60);
      counts[ev.type]++;
      if (show === 'all' || ev.type === show) renderAll(true);
    };
    // Seed a few so the panel never starts empty.
    const stamp = d => d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0');
    const gen = (time = new Date()) => {
      let r = Math.random() * 97, type = TYPES[0][0];
      for (const [t, w] of TYPES) { if ((r -= w) < 0) { type = t; break; } }
      return { type, d: detail[type](), time: stamp(time) };
    };
    for (let i = 8; i > 0; i--) write(gen(new Date(Date.now() - i * 900)));
    renderAll(); renderCounts(); meter();
    loop(demo, dt => {
      genIn -= dt; writeIn -= dt;
      if (genIn <= 0) {
        genIn = 450 + Math.random() * 650;
        if (buffer.length >= 40) dropped++; else buffer.push(gen());
        meter();
      }
      if (buffer.length && writeIn <= 0) {
        writeIn = slow ? 2200 : 0;
        write(buffer.shift());
        renderCounts(); meter();
      }
    }, $('#audit-pause'));
  }

  /* ---------- Bounded worker pool ---------- */
  {
    const demo = $('#pool-demo');
    const SVC = 200, TO = 1500, BIN = 250, BINS = 40;
    const P = { load: 12, workers: 4, queue: 8, skip: true };
    const inp = { load: $('#p-load'), workers: $('#p-workers'), queue: $('#p-queue') };
    const slotsEl = $('#p-slots'), wksEl = $('#p-wks'), chart = $('#p-chart'), say = $('#p-say'), live = $('#p-live');
    let q = [], wk = new Array(12).fill(null), now = 0, nextArr = 0, binT = 0, sayT = 0, lat = [];
    const newBin = () => ({ ok: 0, rej: 0, to: 0, cpu: 0, waste: 0 });
    let bins = Array.from({ length: BINS }, newBin), cur = newBin();
    let slots = [], wkEls = [];

    for (let i = 0; i < BINS; i++) chart.append(el('i', '', '<s></s><s></s><s></s>'));
    const bars = [...chart.children];

    function build() {
      slots = [];
      slotsEl.classList.toggle('none', P.queue === 0);
      if (P.queue === 0) slotsEl.replaceChildren('No queue: if every worker is busy, reject.');
      else { slotsEl.replaceChildren(...Array.from({ length: P.queue }, () => el('i', 'slot'))); slots = [...slotsEl.children]; }
      wksEl.replaceChildren(...Array.from({ length: P.workers }, (_, i) => el('div', 'wk', `<i></i><span>w${i + 1}</span>`)));
      wkEls = [...wksEl.children].map(w => ({ w, bar: w.firstChild, s: '' }));
      $('#o-cap').textContent = `${P.workers * 1000 / SVC} req/s max`;
    }
    const outputs = () => {
      $('#o-load').textContent = `${P.load} req/s`; $('#o-workers').textContent = P.workers; $('#o-queue').textContent = P.queue;
    };
    let announce = 0;
    const changed = () => {
      P.load = +inp.load.value; P.workers = +inp.workers.value; P.queue = +inp.queue.value; P.skip = $('#p-skip').checked;
      if (q.length > P.queue) { cur.rej += q.length - P.queue; q.length = P.queue; }
      outputs(); build();
      clearTimeout(announce); announce = setTimeout(() => { live.textContent = say.textContent; }, 2500);
    };
    for (const k in inp) inp[k].addEventListener('input', changed);
    $('#p-skip').addEventListener('change', changed);
    const PRESETS = { calm: [12, 4, 8, true], spike: [40, 4, 8, true], deep: [40, 4, 40, false] };
    $$('[data-preset]', demo).forEach(b => b.addEventListener('click', () => {
      const [l, w, qs, sk] = PRESETS[b.dataset.preset];
      inp.load.value = l; inp.workers.value = w; inp.queue.value = qs; $('#p-skip').checked = sk;
      for (const k in inp) inp[k].dispatchEvent(new Event('input'));
    }));

    const start = (i, job) => { const t = SVC * (.8 + Math.random() * .4); wk[i] = { job, left: t, total: t }; };
    function arrive() {
      const job = { t0: now, dead: false };
      const free = wk.findIndex((w, i) => !w && i < P.workers);
      if (free >= 0 && !q.length) start(free, job);
      else if (q.length < P.queue) q.push(job);
      else cur.rej++; // fail fast: the queue is full, answer 429 now
    }
    function tick(dt) {
      now += dt;
      nextArr -= dt;
      while (nextArr <= 0) { arrive(); nextArr += -Math.log(1 - Math.random()) * 1000 / P.load; }
      for (const j of q) if (!j.dead && now - j.t0 > TO) { j.dead = true; cur.to++; }
      for (let i = 0; i < wk.length; i++) {
        const w = wk[i];
        if (w) {
          if (!w.job.dead && now - w.job.t0 > TO) { w.job.dead = true; cur.to++; }
          const used = Math.min(dt, w.left);
          w.left -= dt; cur.cpu += used; if (w.job.dead) cur.waste += used;
          if (w.left <= 0) { if (!w.job.dead) { cur.ok++; lat.push([now, now - w.job.t0]); } wk[i] = null; }
        }
        if (!wk[i] && i < P.workers) {
          while (q.length) {
            const j = q.shift();
            if (P.skip && j.dead) continue; // the caller already gave up: don't hash for nobody
            start(i, j); break;
          }
        }
      }
      binT += dt;
      if (binT >= BIN) { binT -= BIN; bins.push(cur); bins.shift(); cur = newBin(); stats(); }
      draw();
    }
    function draw() {
      for (let i = 0; i < slots.length; i++) {
        const j = q[i], s = j ? String(Math.min(2, Math.floor((now - j.t0) / TO * 2))) : '';
        if (slots[i].dataset.s !== s) { if (s) slots[i].dataset.s = s; else delete slots[i].dataset.s; }
      }
      for (let i = 0; i < wkEls.length; i++) {
        const w = wk[i], e = wkEls[i], s = w ? (w.job.dead ? 'waste' : 'ok') : '';
        if (e.s !== s) { e.s = s; e.w.dataset.s = s; }
        e.bar.style.transform = `scaleX(${w ? 1 - w.left / w.total : 0})`;
      }
      $('#o-depth').textContent = `${q.length} / ${P.queue}`;
    }
    const setMetric = (id, v, unit, s) => { const m = $(id); m.dataset.s = s; m.firstElementChild.nextElementSibling.innerHTML = `${v}<u>${unit}</u>`; };
    function stats() {
      const win = bins.slice(-16), secs = win.length * BIN / 1000, sum = k => win.reduce((a, b) => a + b[k], 0);
      const ok = sum('ok') / secs, rej = sum('rej') / secs, to = sum('to') / secs, cpu = sum('cpu'), waste = cpu ? sum('waste') / cpu * 100 : 0;
      lat = lat.filter(([t]) => t > now - 4000);
      const sorted = lat.map(l => l[1]).sort((a, b) => a - b), p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] : 0;
      setMetric('#m-ok', ok.toFixed(0), '/s', ok > 0 ? 'ok' : '');
      setMetric('#m-rej', rej.toFixed(0), '/s', rej > .5 ? 'warn' : '');
      setMetric('#m-to', to.toFixed(0), '/s', to > .5 ? 'bad' : '');
      setMetric('#m-p95', Math.round(p95), 'ms', p95 > TO * .8 ? 'bad' : p95 > 600 ? 'warn' : '');
      setMetric('#m-waste', waste.toFixed(0), '%', waste > 25 ? 'bad' : waste > 5 ? 'warn' : '');
      const max = Math.max(P.load * BIN / 1000 * 1.4, ...bins.map(b => b.ok + b.rej + b.to), 3);
      // Stacked bars drawn with transforms only (no layout work, no layout shift).
      bins.forEach((b, i) => {
        const s = bars[i].children, a = b.ok / max, r = b.rej / max, t = b.to / max;
        s[0].style.transform = `scaleY(${a})`;
        s[1].style.transform = `translateY(${-a * 100}%) scaleY(${r})`;
        s[2].style.transform = `translateY(${-(a + r) * 100}%) scaleY(${t})`;
      });
      if ((sayT += 1) % 2) return; // the sentence changes twice a second at most
      const cap = P.workers * 1000 / SVC;
      let kind, text;
      if (waste > 25 || to > 1) {
        kind = 'bad';
        text = `<b>Congestion.</b> Requests wait longer than the caller's 1.5 s timeout, so ${waste.toFixed(0)}% of CPU goes to answers nobody will read. ${P.queue * SVC / P.workers > TO ? 'The queue is too deep for the timeout: shrink it.' : ''}${P.skip ? '' : ' Turn on skipping.'}`;
      } else if (rej > .5) {
        kind = 'warn';
        text = `<b>Over capacity, failing fast.</b> Load is ${P.load} req/s against ${cap} req/s of capacity. About ${rej.toFixed(0)}/s get an instant 429, and everyone admitted is answered in ${Math.round(p95)} ms (p95).`;
      } else {
        kind = 'ok';
        text = `<b>Healthy.</b> ${P.load} req/s against ${cap} req/s of capacity: nothing rejected, p95 ${Math.round(p95)} ms. Try the login spike.`;
      }
      say.dataset.s = kind; say.innerHTML = text;
    }
    outputs(); build(); stats(); stats();
    loop(demo, tick, $('#p-pause'));
  }

  /* ---------- Lazy hash migration ---------- */
  {
    const steps = $$('#mig-steps li'), hash = $('#mig-hash'), algo = $('#mig-algo'), msg = $('#mig-say');
    const btns = [$('#mig-ok'), $('#mig-bad'), $('#mig-reset')];
    const BCRYPT = hash.textContent;
    const b64 = n => Array.from({ length: n }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[Math.floor(Math.random() * 64)]).join('');
    let a = 'bcrypt';
    const wait = () => sleep(calm ? 250 : 650);
    const busy = b => btns.forEach(x => { x.disabled = b; });
    const clear = () => steps.forEach(s => s.classList.remove('on', 'no', 'skip'));
    async function login(right) {
      busy(true); clear();
      steps[0].classList.add('on'); msg.textContent = `Verifying against the stored ${a} hash…`; await wait();
      if (!right) {
        steps[0].classList.replace('on', 'no'); steps.slice(1).forEach(s => s.classList.add('skip'));
        msg.textContent = 'Wrong password: 401. A failed login never touches the stored hash, and there is no plaintext to migrate with.';
        return busy(false);
      }
      steps[1].classList.add('on'); msg.textContent = 'Correct. The user gets their 200 now; nothing after this adds to their wait.'; await wait();
      if (a === 'argon2id') {
        steps[2].classList.add('skip'); steps[3].classList.add('skip');
        msg.textContent = 'Already Argon2id, so there is nothing to migrate. This is the path every login takes from now on.';
        return busy(false);
      }
      steps[2].classList.add('on'); msg.textContent = 'Off the request path: rehashing the password with Argon2id…'; await wait(); await wait();
      steps[3].classList.add('on');
      a = 'argon2id'; algo.dataset.a = a; algo.textContent = a;
      hash.textContent = `$argon2id$v=19$m=…$${b64(22)}$${b64(43)}`;
      msg.textContent = 'Stored. asha is on Argon2id now and never noticed. Log in again to see the fast path.';
      busy(false);
    }
    btns[0].addEventListener('click', () => login(true));
    btns[1].addEventListener('click', () => login(false));
    btns[2].addEventListener('click', () => {
      a = 'bcrypt'; algo.dataset.a = a; algo.textContent = a; hash.textContent = BCRYPT; clear();
      msg.textContent = "asha's account still has a bcrypt hash from before the migration.";
    });
  }

  /* ---------- GoQuant: before/after, router, risk ---------- */
  {
    const ba = $('#ba'), radios = $$('input[name=ba]', ba);
    let touched = false;
    const set = m => {
      ba.dataset.m = m;
      radios.forEach(r => { r.checked = r.value === m; });
      $$('.barrow b', ba).forEach(b => { b.textContent = m === 'after' ? b.dataset.a : b.dataset.b; });
    };
    radios.forEach(r => r.addEventListener('change', () => { touched = true; set(r.value); }));
    if (!calm) {
      set('before');
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        setTimeout(() => { if (!touched) set('after'); }, 450);
      }, { threshold: .6 });
      io.observe(ba);
    }
  }
  {
    const r = $('#router'), svg = $('svg', r), pkt = $('.pkt', svg), info = $('#venue-info');
    const V = {
      binance: ['BTCUSDT', 'API key + HMAC-SHA256 signed request', 'REST, WebSocket streams'],
      deribit: ['BTC-PERPETUAL', 'public/auth → bearer access token', 'JSON-RPC over WebSocket or HTTP'],
      hyperliquid: ['BTC', 'actions signed with a wallet key', 'REST, WebSocket'],
    };
    let run = 0;
    async function route(v) {
      const id = ++run;
      $$('.ed, [id^=v-]', svg).forEach(e => e.classList.remove('on'));
      $('#r-in', svg).classList.add('on'); $('#r-' + v, svg).classList.add('on'); $('#v-' + v, svg).classList.add('on');
      const [sym, auth, wire] = V[v];
      info.innerHTML = `<dt>Symbol</dt><dd><code>${sym}</code></dd><dt>Auth</dt><dd>${auth}</dd><dt>Wire</dt><dd>${wire}</dd>`;
      await travel(pkt, $('#r-in', svg), 300);
      if (id === run) await travel(pkt, $('#r-' + v, svg), 420);
    }
    $$('input[name=venue]', r).forEach(x => x.addEventListener('change', () => route(x.value)));
    route('binance');
  }
  {
    const ENTRY = 60000, MMR = .005;
    const size = $('#r-size'), lev = $('#r-lev'), move = $('#r-move');
    const money = v => (v < 0 ? '−' : '') + '$' + (Math.abs(v) >= 1000 ? (Math.abs(v) / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1) + 'k' : Math.abs(v).toFixed(0));
    const pct = v => (v < 0 ? '−' : v > 0 ? '+' : '') + Math.abs(v).toFixed(1) + '%';
    function calc() {
      const s = +size.value, l = +lev.value, m = +move.value;
      const notional = s * ENTRY, margin = notional / l, pnl = notional * m / 100;
      const liq = -(1 / l - MMR) * 100, dist = m - liq;
      $('#r-size-o').textContent = s.toFixed(2) + ' BTC'; $('#r-lev-o').textContent = l + '×'; $('#r-move-o').textContent = pct(m);
      $('#r-not').textContent = money(notional); $('#r-mar').textContent = money(margin); $('#r-pnl').textContent = money(pnl);
      $('#r-pnl-m').dataset.s = pnl < 0 ? 'bad' : pnl > 0 ? 'ok' : '';
      $('#r-dist').textContent = dist <= 0 ? 'liquidated' : dist.toFixed(1) + '%';
      $('#r-needle').style.left = clamp(dist / 20) * 100 + '%';
      const st = $('#r-state');
      const [k, t] = dist <= 0 ? ['bad', 'Liquidated: the move ate the margin'] : dist < 3 ? ['warn', 'Close to liquidation'] : ['ok', 'Healthy'];
      if (st.dataset.s !== k || st.textContent !== t) { st.dataset.s = k; st.textContent = t; }
    }
    [size, lev, move].forEach(x => x.addEventListener('input', calc));
    calc();
  }

  /* ---------- Relay agent grid ---------- */
  {
    const grid = $('#agrid'), n = $('#ag-n');
    const A = [['Lead', '★', 'var(--t-accent)'], ['Wishlist API', 'C'], ['Wishlist page', 'C'], ['Tests', 'C'], ['Scout', 'S'], ['Docs', 'G'], ['Review', 'X'], ['Shell', '$'],
      ['Search', 'C'], ['Email', 'X'], ['Perf', 'C'], ['Theme', 'G'], ['Fix flaky', 'C'], ['Infra', 'C'], ['Lint', '$'], ['Data', 'C']];
    const LINES = ['Write(src/api/wishlist.js) ⎿ Wrote 28 lines', 'Bash(npm test) ⎿ pass 42 fail 0', 'Grep("formatPrice") ⎿ 3 files', 'Update(cart.js) ⎿ +6 −1',
      'create_task("Search API")', 'Allow Bash(npm install)?', 'Edit(theme.css) ⎿ +14 −3', 'git diff --stat ⎿ 4 files changed', 'Read(README.md)', 'message_agent("Scout")', 'Plan: 3 tasks for the goal'];
    const STATES = [['working', 55], ['idle', 20], ['needs', 8], ['done', 17]];
    const cells = A.map(([name, ch, c], i) => {
      const d = el('div', 'ag', `<header><i style="--av:${c || '#636366'}">${ch}</i><b>${name}</b><span class="st"></span></header><p>${LINES[i % LINES.length]}</p>`);
      d.dataset.s = i ? pick(['working', 'working', 'idle', 'done']) : 'working';
      return d;
    });
    grid.append(...cells);
    const count = () => {
      const on = cells.slice(0, +n.value);
      const w = on.filter(c => c.dataset.s === 'working').length, nd = on.filter(c => c.dataset.s === 'needs').length;
      $('#ag-cnt').textContent = `${w} working · ${nd} need${nd === 1 ? 's' : ''} you`;
    };
    const apply = () => { $('#ag-o').textContent = n.value; cells.forEach((c, i) => c.classList.toggle('off', i >= +n.value)); count(); };
    n.addEventListener('input', apply); apply();
    let t = 0;
    loop($('#agents'), dt => {
      if ((t += dt) < 900) return;
      t = 0;
      const c = cells[Math.floor(Math.random() * +n.value)];
      let r = Math.random() * 100;
      for (const [s, w] of STATES) if ((r -= w) < 0) { c.dataset.s = s; break; }
      $('p', c).textContent = pick(LINES);
      count();
    }, $('#ag-pause'));
  }

  /* ---------- Built with Relay: counter ---------- */
  {
    const n = $('#proof-n'), TARGET = 30;
    if (!calm) {
      n.textContent = '0';
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const step = t => { const k = clamp((t - t0) / 1400); n.textContent = Math.round(ease(k) * TARGET); if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      }, { threshold: .6 });
      io.observe(n);
    }
  }

  /* ---------- SwiftTrade fan-out ---------- */
  {
    const fan = $('#fan'), svg = $('#fan-svg'), range = $('#fan-n');
    const inst = ['BTC', 'ETH', 'BTC', 'BTC', 'ETH', 'BTC', 'ETH', 'BTC'];
    let subs = [], ticksIn = 0, msgsOut = 0, tickT = 0;
    const flying = [];
    const box = (x, y, w, h, t1, t2) => {
      const g = svgEl('g', { class: 'nd' });
      g.append(svgEl('rect', { x, y, width: w, height: h, rx: 12 }));
      const a = svgEl('text', { x: x + w / 2, y: y + h / 2 - 2 }); a.textContent = t1;
      const b = svgEl('text', { x: x + w / 2, y: y + h / 2 + 14, class: 'sub' }); b.textContent = t2;
      g.append(a, b); return g;
    };
    const lnIn = svgEl('path', { class: 'ln', d: 'M118 135 H 160' });
    const lnMid = svgEl('path', { class: 'ln', d: 'M290 135 H 330' });
    const subLayer = svgEl('g', {}), dotLayer = svgEl('g', {});
    svg.append(lnIn, lnMid, subLayer,
      box(8, 107, 110, 56, 'Deribit', 'WebSocket feed'),
      box(160, 107, 130, 56, 'SwiftTrade', 'C++ client'),
      box(330, 107, 120, 56, 'Local WS server', 'broadcast'),
      dotLayer);
    function build() {
      const N = +range.value;
      $('#fan-o').textContent = N;
      subLayer.replaceChildren();
      subs = Array.from({ length: N }, (_, i) => {
        const y = N === 1 ? 135 : 22 + i * (226 / (N - 1));
        const path = svgEl('path', { class: 'ln', d: `M450 135 C 490 135, 480 ${y}, 516 ${y}` });
        const g = svgEl('g', { class: 'sb', tabindex: 0, role: 'button' });
        g.append(svgEl('circle', { cx: 532, cy: y, r: 16 }));
        const t = svgEl('text', { x: 532, y }); g.append(t);
        const s = { path, g, t, i };
        const paint = () => { g.dataset.i = inst[i]; t.textContent = inst[i]; g.setAttribute('aria-label', `Subscriber ${i + 1}: ${inst[i]}. Activate to switch instrument.`); };
        const flip = () => { inst[i] = inst[i] === 'BTC' ? 'ETH' : 'BTC'; paint(); };
        g.addEventListener('click', flip);
        g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
        paint();
        subLayer.append(path, g);
        return s;
      });
    }
    range.addEventListener('input', build);
    build();
    const flash = (e, cls = 'hot', ms = 260) => { e.classList.add(cls); setTimeout(() => e.classList.remove(cls), ms); };
    const fly = (path, cls, dur, done) => {
      if (calm) { flash(path); return setTimeout(done, dur); }
      const dot = svgEl('circle', { class: 'dot ' + cls, r: 4, cx: -10, cy: -10 });
      dotLayer.append(dot);
      flying.push({ dot, path, len: path.getTotalLength(), t: 0, dur, done });
    };
    function tick() {
      const sym = Math.random() < .6 ? 'BTC' : 'ETH';
      ticksIn++;
      fly(lnIn, sym, 240, () => fly(lnMid, sym, 240, () => {
        for (const s of subs) if (inst[s.i] === sym) {
          msgsOut++;
          fly(s.path, sym, 420, () => flash(s.g, 'ping', 220));
        }
        $('#fan-out').textContent = msgsOut;
      }));
      $('#fan-in').textContent = ticksIn;
    }
    loop(fan, dt => {
      if ((tickT += dt) > 700) { tickT = 0; tick(); }
      for (let i = flying.length - 1; i >= 0; i--) {
        const f = flying[i];
        f.t += dt;
        const k = clamp(f.t / f.dur), p = f.path.getPointAtLength(k * f.len);
        f.dot.setAttribute('cx', p.x); f.dot.setAttribute('cy', p.y);
        if (k >= 1) { f.dot.remove(); flying.splice(i, 1); f.done(); }
      }
    }, $('#fan-pause'));
  }

  /* ---------- Copy email ---------- */
  {
    const b = $('#copy-email');
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(b.dataset.email); b.textContent = 'Copied'; }
      catch { location.href = 'mailto:' + b.dataset.email; return; }
      setTimeout(() => { b.textContent = 'Copy email'; }, 2000);
    });
  }
})();
