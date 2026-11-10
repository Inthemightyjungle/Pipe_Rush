/* ==== Pipe Rush play statistics (stats/pipe-rush-stats.js) ====
   Anonymous play statistics, sent to the developer's Google Sheet through stats/PipeRush-stats.gs.
   This block lives inside the game's main script, just before `window.__pb = {`. stats/inject.py puts it there.
   What is sent: a random ID for this device, the device type, and what was played for how long. No names or accounts.
   Off on claude.ai, localhost and file:// pages. `window.PB_STATS_URL` / `window.PB_STATS_TEST` turn it on for tests. */
const STATS_URL = '';
const STATS_VER = 'v2026.11.04';
const PBStats = (() => {
  const url = window.PB_STATS_URL || STATS_URL;
  const isWeb = /^https?:$/.test(location.protocol) && !/claude|localhost|^127\.|^0\.0\.0\.0$|^\[::1\]$/.test(location.hostname);
  const on = !!url && (isWeb || !!window.PB_STATS_TEST);
  const KEY = 'pb_stats1', IDLE_MS = 60000, MODES = ['normal', 'hard', 'rush', 'endless', 'puzzle'];
  const MENUS = { title: 1, levels: 1, rushLevels: 1, puzzleLevels: 1, options: 1 };
  const rid = () => { try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    const h = () => Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
    return h() + h() + '-' + h() + '-4' + h().slice(1) + '-a' + h().slice(1) + '-' + h() + h() + h(); };

  /* kept on the device: the player ID, lifetime play time, visit count and anything not yet sent */
  let st = null; try { st = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  const fresh = !st || !/^[A-Za-z0-9-]{8,40}$/.test(st.pid || '');
  if (fresh) st = { pid: rid(), first: Date.now(), visits: 0, play: 0, q: [] };
  if (!Array.isArray(st.q)) st.q = [];
  st.visits = (st.visits || 0) + 1;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  if (on) save();

  /* this visit */
  const sid = 's' + rid().replace(/-/g, '').slice(0, 9);   // starts with a letter so a sheet never reads it as a number
  const S = { play: 0, open: 0, m: [0, 0, 0, 0, 0], menu: 0, facts: 0, shop: 0, ls: 0, lw: 0, lf: 0, lq: 0, qa: 0, qr: 0 };
  let seq = 0, round = null, board = null, lastLevel = '', lastSave = 0, lastSent = '', lastPing = 0, sending = false;

  const ua = navigator.userAgent || '';
  const device = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'Tablet'
    : /iPhone|iPod/.test(ua) ? 'Phone' : /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Phone' : 'Tablet') : 'Computer';
  const os = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iOS'
    : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Macintosh/.test(ua) ? 'Mac' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : 'Other';
  const browser = /Edg(e|A|iOS)?\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Other';
  const standalone = () => { try { return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true; } catch (e) { return false; } };
  const about = () => {
    let tz = '', ref = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    try { if (document.referrer) ref = new URL(document.referrer).hostname; } catch (e) {}
    return { device, os, browser, platform: standalone() ? 'web-installed' : 'web', scr: window.screen.width + 'x' + window.screen.height + '@' + (Math.round((window.devicePixelRatio || 1) * 10) / 10),
      lang: navigator.language || '', tz, ref: ref === location.hostname ? '' : ref, host: location.hostname, visits: st.visits, first: st.first || Date.now(), fresh: fresh ? 1 : 0 };
  };
  /* the player's saved progress, so the sheet shows how far each player has got */
  const progress = () => {
    try {
      const sum = o => Object.values(o || {}).reduce((a, v) => a + (+v || 0), 0), count = (o, f) => Object.values(o || {}).filter(f).length;
      const day = store.get('day_stars', {}), hard = store.get('hard75_stars', {}), rush = store.get('rush_stars', {}), eb = store.get('endless_best', { days: 0, sparks: 0 }) || {};
      return { nl: count(day, v => v > 0), ns: sum(day), hl: count(hard, v => v === 3), rl: count(rush, v => v === 3), rb: Math.round(store.get('rush_run_best', 0) || 0),
        ed: eb.days || 0, ep: eb.sparks || 0, pz: count(store.get('puzzle_done', {}), Boolean) };
    } catch (e) { return {}; }
  };
  const snapshot = () => ({ play: Math.round(S.play), open: Math.round(S.open), life: Math.round(st.play), m: S.m.map(Math.round), menu: Math.round(S.menu), facts: Math.round(S.facts), shop: Math.round(S.shop),
    ls: S.ls, lw: S.lw, lf: S.lf, lq: S.lq, qa: S.qa, qr: S.qr, at: screen, last: lastLevel, prog: progress() });

  function flush(beacon) {
    if (!on || !st.q.length) return;
    if (navigator.onLine === false) return;
    const batch = st.q.slice(0, 25), body = JSON.stringify(batch);
    if (beacon && navigator.sendBeacon) {
      let ok = false; try { ok = navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' })); } catch (e) {}
      if (ok) { st.q.splice(0, batch.length); save(); }
      return;
    }
    if (sending) return; sending = true;
    fetch(url, { method: 'POST', mode: 'no-cors', keepalive: body.length < 60000, headers: { 'Content-Type': 'text/plain' }, body })
      .then(() => { st.q.splice(0, batch.length); save(); sending = false; if (st.q.length) setTimeout(flush, 1500); })
      .catch(() => { sending = false; });
  }
  function ev(type, data, beacon) {
    if (!on) return;
    st.q.push(Object.assign({ pid: st.pid, sid, n: ++seq, ev: type, t: Date.now(), ver: STATS_VER }, data || {}));
    if (st.q.length > 120) st.q.splice(0, st.q.length - 120);
    save(); flush(beacon);
  }

  /* ---- play time ----
     Once a second: time counts only while the page is on screen and the player has touched it in the last minute.
     "Play" is time in a level with nothing covering the board. "Open" is all time on the page. */
  let lastInput = Date.now(), lastTick = Date.now();
  for (const type of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'])
    window.addEventListener(type, () => { lastInput = Date.now(); }, { capture: true, passive: true });
  const playing = () => {
    if (!round) return false;
    if (round.mode === 'puzzle') { const brief = $('#routeBrief'); return screen === 'puzzlePlay' && !!puzzle && !(brief && brief.open) && !(g && g.modal); }
    return screen === 'game' && !!g && g.state === 'play' && !g.modal;
  };
  function tick() {
    const now = Date.now(), dt = Math.min(2, Math.max(0, (now - lastTick) / 1000)); lastTick = now;
    if (!on || !dt || document.visibilityState !== 'visible' || now - lastInput > IDLE_MS) return;
    S.open += dt;
    if (MENUS[screen]) S.menu += dt; else if (screen === 'facts') S.facts += dt; else if (screen === 'workshop') S.shop += dt;
    if (round) round.wall += dt;
    if (playing()) { S.play += dt; st.play += dt; round.play += dt; S.m[MODES.indexOf(round.mode)] += dt; }
    if (st.play - lastSave > 10) { lastSave = st.play; save(); }
    if (S.open - lastPing >= 60) { lastPing = S.open; report('ping'); }
  }
  /* a report carries this visit's running totals; it is skipped when nothing has changed since the last one */
  function report(type, beacon) {
    const snap = snapshot(), sig = JSON.stringify([snap.play, snap.open, snap.ls, snap.lw, snap.lf, snap.lq, snap.qa, snap.at]);
    if (type !== 'start' && sig === lastSent) { flush(beacon); return; }
    lastSent = sig; ev(type, type === 'start' ? Object.assign(about(), snap) : snap, beacon);
  }

  /* ---- levels ---- */
  function begin(mode, lv, name) {
    if (round) end('quit');
    round = { mode, lv, name: name || '', play: 0, wall: 0, turns: 0, placed: 0, sends: 0, quiz: '', hints0: null };
    board = mode === 'puzzle' ? null : g; lastLevel = mode + ' ' + lv; S.ls++;
    ev('level_start', { mode, lv, name: round.name });
  }
  function end(result, data) {
    if (!round) return;
    const r = round, G = board; round = null; board = null;
    if (!data && G) data = boardData(G, 0);   // quit or restarted: still say how far the board had got
    if (result === 'win') S.lw++; else if (result === 'fail') S.lf++; else S.lq++;
    ev('level_end', Object.assign({ mode: r.mode, lv: r.lv, name: r.name, result, secs: Math.round(r.play), wall: Math.round(r.wall),
      moves: r.turns + r.placed, turns: r.turns, placed: r.placed, sends: r.sends }, data || {}));
  }
  const kindOf = G => G.endless ? 'endless' : G.mode === 'rush' ? 'rush' : G.mode === 'hard' ? 'hard' : 'normal';
  const levelOf = G => G.endless ? G.endless.day : G.mode === 'rush' ? G.rushLevel : G.n;
  const boardData = (G, stars) => ({ stars, score: Math.round((G.endless ? G.endless.total : 0) + (G.points || 0)), points: Math.round(G.points || 0),
    kwh: Math.round(G.gen || 0), low: Math.round(G.minBat == null ? 0 : G.minBat), wise: G.wise || 0, hour: Math.round((G.hr || 0) * 10) / 10 });
  const safe = fn => { try { fn(); } catch (e) { try { console.warn('stats', e); } catch (e2) {} } };

  if (on) {
    /* a level begins when its clock starts (after the briefing cards) */
    { const _f = startDay; startDay = function () { const r = _f.apply(this, arguments); safe(() => begin(kindOf(g), levelOf(g), g.LV && g.LV.name)); return r; }; }
    /* a new board while a level is still open: the player restarted or switched */
    { const _f = newGame; newGame = function (n, custom, mode) {
        safe(() => { if (!round) return; const kind = mode === 'rush' ? 'rush' : custom ? 'endless' : mode === 'hard' ? 'hard' : 'normal', lv = mode === 'rush' ? custom.n - 200 : n;
          end(kind === round.mode && (kind === 'endless' || lv === round.lv) ? 'restart' : 'quit'); });
        return _f.apply(this, arguments); }; }
    { const _f = show; show = function (name) { safe(() => { if (round && name !== 'game' && name !== 'puzzlePlay') end('quit'); }); return _f.apply(this, arguments); }; }
    { const _f = win; win = function () { const G = g, r = _f.apply(this, arguments); safe(() => { if (G && round) end('win', boardData(G, g === G ? starsFor() : 0)); }); return r; }; }
    { const _f = blackout; blackout = function () { const G = g, was = !!G && G.state !== 'over', r = _f.apply(this, arguments); safe(() => { if (was && round) end('fail', boardData(G, 0)); }); return r; }; }
    { const _f = finishHardRound; finishHardRound = function () { const G = g, was = !!G && G.state === 'play' && G.mode === 'hard', r = _f.apply(this, arguments);
        safe(() => { if (!was || !round) return; const passed = G.points >= G.goal[1]; end(passed ? 'win' : 'fail', boardData(G, passed ? 3 : g === G ? starsFor() : 0)); }); return r; }; }
    { const _f = recordRushRound; recordRushRound = function (cleared) { const G = g, r = _f.apply(this, arguments);
        safe(() => { if (round && r) end(cleared ? 'win' : 'fail', Object.assign(boardData(G, r.stars), { score: r.score, bonus: r.bonus })); }); return r; }; }
    /* moves */
    { const _f = rotateAt; rotateAt = function () { const r = _f.apply(this, arguments); if (r !== false && round) round.turns++; return r; }; }
    { const _f = putPipe; putPipe = function () { const r = _f.apply(this, arguments); if (round) round.placed++; return r; }; }
    { const _f = sendGas; sendGas = function () { const r = _f.apply(this, arguments); if (r !== false && round) round.sends++; return r; }; }
    /* quiz cards inside levels */
    { const _f = quizResult; quizResult = function (q, ok) {
        safe(() => { S.qa++; if (ok) S.qr++; const key = Object.keys(QUIZ).find(k => QUIZ[k] === q) || '';
          ev('quiz', { src: 'level', q: key, title: q && q.title, ok: ok ? 1 : 0, mode: round ? round.mode : '', lv: round ? round.lv : '' }); });
        return _f.apply(this, arguments); }; }
    /* puzzles */
    { const _f = startPuzzle; startPuzzle = function (n, restart) {
        const before = puzzle; safe(() => { if (round) end(round.mode === 'puzzle' && round.lv === n ? 'restart' : 'quit'); });
        const r = _f.apply(this, arguments);
        safe(() => { if (puzzle && puzzle !== before && puzzle.n === n && screen === 'puzzlePlay' && !routeComplete(puzzle.level, puzzle.route)) {
          begin('puzzle', n, puzzle.level.name); round.resumed = puzzle.route.length > 1 || puzzle.hints !== null ? 1 : 0; round.hints0 = puzzle.hints; } });
        return r; }; }
    { const _f = answerPuzzleQuiz; answerPuzzleQuiz = function () {
        const open = !!puzzle && puzzle.hints === null, r = _f.apply(this, arguments);
        safe(() => { if (!open || !puzzle || puzzle.hints === null) return; const ok = puzzle.hints === 3, item = ENERGY_EDITION[puzzle.question];
          S.qa++; if (ok) S.qr++; if (round) { round.quiz = ok ? 'right' : 'wrong'; round.hints0 = puzzle.hints; }
          ev('quiz', { src: 'puzzle', q: 'story-' + (puzzle.question + 1), title: item && (item.kicker || item.question), ok: ok ? 1 : 0, mode: 'puzzle', lv: puzzle.n }); });
        return r; }; }
    { const _f = moveRoute; moveRoute = function () {
        const was = !!puzzle && routeComplete(puzzle.level, puzzle.route), r = _f.apply(this, arguments);
        safe(() => { if (!round || round.mode !== 'puzzle' || !puzzle) return; if (r) round.placed++;
          if (!was && routeComplete(puzzle.level, puzzle.route)) end('win', { cells: puzzle.level.w * puzzle.level.h, quiz: round.quiz, resumed: round.resumed || 0,
            hints: round.hints0 == null || puzzle.hints == null ? '' : Math.max(0, round.hints0 - puzzle.hints) }); });
        return r; }; }

    const leave = () => report('leave', true);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') leave(); else { lastTick = Date.now(); flush(); } });
    window.addEventListener('pagehide', leave);
    window.addEventListener('online', () => flush());
    setInterval(tick, 1000);
    setTimeout(() => report('start'), 3000);
  }
  return { on, get pid() { return st.pid; }, get sid() { return sid; }, get queue() { return st.q.length; }, get play() { return st.play; },
    get session() { return snapshot(); }, get round() { return round; }, flush, tick };
})();
window.__pbStats = PBStats;
/* ==== end of play statistics ==== */
