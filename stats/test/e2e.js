const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { makeEnv } = require('./mock');
const ROOT = process.argv[2], GS = path.join(ROOT, 'stats/PipeRush-stats.gs');
const env = makeEnv(GS); env.ctx.setup();
const got = []; let failPosts = false;
const srv = http.createServer((q, r) => {
  if (q.method === 'POST' && q.url.startsWith('/stats')) { let b = ''; q.on('data', d => b += d); q.on('end', () => { if (failPosts) { q.socket.destroy(); return; } try { const list = JSON.parse(b); got.push(...list); env.post(b); } catch (e) { console.log('BAD POST', e); } r.writeHead(200); r.end('ok'); }); return; }
  let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
const types = () => got.map(e => e.ev + (e.result ? ':' + e.result : '')).join(' ');
(async () => {
  await new Promise(ok => srv.listen(0, ok)); const port = srv.address().port, base = `http://localhost:${port}/`;
  const b = await chromium.launch();
  const errs = [];
  // ---- 0. the shipped build on localhost sends nothing ----
  { const ctx = await b.newContext(); const pg = await ctx.newPage(); let n = 0; pg.on('request', r => { if (r.method() === 'POST') n++; }); pg.on('pageerror', e => errs.push('off: ' + e.message));
    await pg.goto(base); await pg.waitForTimeout(4500); const on = await pg.evaluate(() => window.__pbStats.on); assert.strictEqual(on, false); assert.strictEqual(n, 0); assert.strictEqual(got.length, 0);
    assert.strictEqual(await pg.evaluate(() => localStorage.getItem('pb_stats1')), null, 'nothing stored while off'); await ctx.close(); console.log('0 off by default: ok'); }

  const ctx = await b.newContext({ viewport: { width: 420, height: 860 } });
  await ctx.addInitScript(u => { window.PB_STATS_TEST = 1; window.PB_STATS_URL = u; }, base + 'stats');
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' || /stats/.test(m.text())) errs.push('console: ' + m.text()); });
  await pg.clock.install({ time: new Date(env.now) });
  const run = async (secs, poke = true) => { for (let left = secs; left > 0; left -= 5) { if (poke) await pg.evaluate(() => window.dispatchEvent(new PointerEvent('pointermove'))); await pg.clock.runFor(Math.min(5, left) * 1000); env.advance(Math.min(5, left) * 1000); } await pg.waitForTimeout(60); };
  const norm = t => t.replace(/\s+/g, ' ').trim();
  const card = async label => { const ok = await pg.evaluate(label => { const n = t => t.replace(/\s+/g, ' ').trim().toLowerCase(); const b = Array.from(document.querySelectorAll('#ov:not([hidden]) #card button')).find(b => n(b.innerText).includes(n(label))); if (b) b.click(); return !!b; }, label); if (!ok) throw new Error('no card button "' + label + '": ' + JSON.stringify(await buttons())); };
  const cardText = () => pg.evaluate(() => document.querySelector('#ov').hidden ? '' : document.querySelector('#card').innerText.replace(/\s+/g, ' ').slice(0, 160));
  const buttons = () => pg.evaluate(() => document.querySelector('#ov').hidden ? [] : Array.from(document.querySelectorAll('#card button')).map(b => b.innerText.trim()));
  // press through briefing cards until the level clock runs
  const through = async () => { for (let i = 0; i < 12; i++) { const st = await pg.evaluate(() => window.__pb.g && window.__pb.g.state); const bs = await buttons(); if (st === 'play' && !bs.length) return; if (!bs.length) { await run(1); continue; }
      const pick = bs.find(t => /^(start|skip|play now|let.s go|got it|ok|begin|next|continue|back to work)/i.test(t)) || bs[0]; await card(pick); await run(1); } throw new Error('could not get into the level: ' + await cardText() + ' ' + JSON.stringify(await buttons())); };
  const through0 = through;
  const settle = async () => { await through0(); for (let i = 0; i < 6; i++) { await run(3); const bs = await buttons(); if (!bs.length) return; await card(bs.find(t => /got it|ok|skip|back to work|continue/i.test(t)) || bs[0]); } };
  const S = () => pg.evaluate(() => Object.assign({}, window.__pbStats.session, { round: window.__pbStats.round, queue: window.__pbStats.queue }));

  await pg.goto(base); await pg.evaluate(() => window.__pb.noDraw(true));
  assert.strictEqual(await pg.evaluate(() => window.__pbStats.on), true);
  await run(4); assert.strictEqual(types(), 'start'); assert.strictEqual(got[0].device, 'Computer'); assert.ok(/^s[0-9a-f]{9}$/.test(got[0].sid), got[0].sid); assert.strictEqual(got[0].fresh, 1);
  console.log('1 start sent:', JSON.stringify(got[0]).slice(0, 330));

  // ---- 2. Normal level 1 through the real menus, won by the built-in bot ----
  await pg.click('#playBtn'); await run(2); await pg.locator('#lvpath .lnode .info').first().click(); await run(1);
  assert.strictEqual((await S()).round, null, 'no level yet while the briefing is open');
  await settle();
  let s = await S(); assert.ok(s.round && s.round.mode === 'normal' && s.round.lv === 1, JSON.stringify(s.round)); const menu0 = s.menu; assert.ok(menu0 >= 2, 'menu time ' + menu0);
  const modal = () => pg.evaluate(() => !!(window.__pb.g && window.__pb.g.modal));
  const pA = (await S()).round.play; let clear = 0, blocked = 0;
  for (let i = 0; i < 40 && clear < 12; i++) { const m0 = await modal(); await run(1); const m1 = await modal(); if (!m0 && !m1) clear++; else { blocked++; const bs = await buttons(); if (bs.length) await card(bs.find(t => /got it|ok|skip|back to work|continue/i.test(t)) || bs[0]); } }
  const p10 = (await S()).round.play - pA, pB = pA + p10; console.log('  clear seconds', clear, 'card seconds', blocked, 'play counted', p10);
  assert.ok(clear >= 12 && p10 >= clear - 1 && p10 <= clear + blocked + 3, 'play time tracks the clear seconds');   // the test clock also runs in real time, hence the slack
   
  // pause: time must stop
  await pg.evaluate(() => window.__pb.pauseGame()); await run(30); const pPause = (await S()).round.play; assert.ok(pPause - pB < 1.5, 'paused time counted: ' + (pPause - pB)); const wall = (await S()).round.wall; assert.ok(wall - pPause >= 28, 'time in level keeps running on a card');
  await card('Resume'); await run(2);
  // idle: no input for 90 s -> at most 60 s more counted
  const pI0 = (await S()).round.play; await run(90, false); const pI1 = (await S()).round.play; assert.ok(pI1 - pI0 <= 61 && pI1 - pI0 >= 55, 'idle cut-off: ' + (pI1 - pI0));
  await pg.evaluate(() => window.__pb.auto(.4, .4));
  for (let i = 0; i < 80 && !got.some(e => e.ev === 'level_end'); i++) { const bs = await buttons(); if (bs.length) { const pick = bs.find(t => /back to work|got it|ok|continue|resume/i.test(t)) || bs[0]; if (/next level|play again|try again|levels|home/i.test(bs.join('|'))) break; await card(pick); } await run(5); }
  await run(4);
  let end = got.find(e => e.ev === 'level_end'); assert.ok(end, 'level end sent. card: ' + await cardText() + ' events: ' + types());
  console.log('2 normal level:', JSON.stringify(end));
  assert.strictEqual(end.mode, 'normal'); assert.strictEqual(end.lv, 1); assert.ok(end.secs >= 70, 'secs'); assert.ok(end.wall >= end.secs + 28); assert.ok(end.sends > 0);   // the bot edits the board directly, so it makes no counted moves assert.ok(end.name);
  const firstResult = end.result;
  if (firstResult === 'win') assert.ok(end.stars >= 1 && end.points > 0);
  // ---- 3. restart, quit, fail ----
  await pg.evaluate(() => window.__pb.startLevel(1, 'easy')); await run(1); await settle(); await run(6);
  await pg.evaluate(() => window.__pb.pauseGame()); await card('Restart'); await run(1); await settle(); await run(3);
  assert.strictEqual(got.filter(e => e.ev === 'level_end').pop().result, 'restart');
  // a quiz card inside a level
  const qkey = await pg.evaluate(() => { for (const l of window.__pb.LEVELS) for (const e of l.events) if (e.ev.startsWith('quiz:')) return e.ev; return ''; }); assert.ok(qkey, 'a quiz exists');
  await pg.evaluate(k => window.__pb.runEvent({ ev: k }, () => {}), qkey); await run(1); const choices = await buttons(); assert.ok(choices.length >= 2, JSON.stringify(choices)); await card(choices[0]); await run(1);
  const lq = got.filter(e => e.ev === 'quiz').pop(); assert.ok(lq && lq.src === 'level' && lq.q === qkey.slice(5) && lq.title && lq.mode === 'normal' && lq.lv === 1, JSON.stringify(lq)); console.log('  level quiz:', JSON.stringify(lq));
  await card((await buttons())[0]); await run(1);
  await pg.evaluate(() => window.__pb.pauseGame()); await card('Home'); await run(2);
  assert.strictEqual(got.filter(e => e.ev === 'level_end').pop().result, 'quit'); { const q = got.filter(e => e.ev === 'level_end').pop(); assert.ok(q.low > 0 && q.hour >= 0, 'a quit still reports the board: ' + JSON.stringify(q)); } assert.strictEqual((await S()).round, null);
  await pg.evaluate(() => window.__pb.startLevel(1, 'easy')); await run(1); await settle(); await run(5); await pg.evaluate(() => window.__pb.blackout()); await run(3);
  end = got.filter(e => e.ev === 'level_end').pop(); assert.strictEqual(end.result, 'fail'); assert.strictEqual(end.stars, 0); console.log('3 restart / quit / fail: ok');
  await pg.evaluate(() => window.__pb.blackout()); await run(2); assert.strictEqual(got.filter(e => e.ev === 'level_end' && e.result === 'fail').length, 1, 'a second blackout call is not counted');
  await card('Home'); await run(1);

  // ---- 4. Rush: time runs out on grid 1 ----
  await pg.evaluate(() => window.__pb.startRush(1)); await run(1); await settle();
  s = await S(); assert.strictEqual(s.round.mode, 'rush'); assert.strictEqual(s.round.lv, 1);
  const turned = await pg.evaluate(() => { const g = window.__pb.g; let n = 0; for (let y = 0; y < g.H && n < 3; y++) for (let x = 0; x < g.W && n < 3; x++) if (window.__pb.rotateAt(x, y) !== false) n++; return n; }); assert.strictEqual(turned, 3);
  await run(245); end = got.filter(e => e.ev === 'level_end').pop(); console.log('4 rush:', JSON.stringify(end));
  assert.strictEqual(end.mode, 'rush'); assert.strictEqual(end.result, 'fail'); assert.ok(end.secs >= 235 && end.secs <= 246, 'rush secs ' + end.secs); assert.strictEqual(end.turns, 3); assert.strictEqual(end.moves, 3);
  await card('Rush levels'); await run(1);
  // ---- 5. Endless: day 1 then blackout ----
  await pg.evaluate(() => window.__pb.show('title')); await pg.click('#endlessBtn'); await run(1); await settle();
  s = await S(); assert.strictEqual(s.round.mode, 'endless'); await run(8); await pg.evaluate(() => window.__pb.blackout()); await run(3);
  end = got.filter(e => e.ev === 'level_end').pop(); assert.strictEqual(end.mode, 'endless'); assert.strictEqual(end.result, 'fail'); assert.strictEqual(end.lv, 1); console.log('5 endless: ok');
  await card('Home'); await run(1);
  // ---- 6. Hard ----
  await pg.evaluate(() => window.__pb.startLevel(1, 'hard')); await run(1); await settle(); s = await S(); assert.strictEqual(s.round.mode, 'hard');
  for (let i = 0; i < 40 && got.filter(e => e.ev === 'level_end').pop().mode !== 'hard'; i++) { const bs = await buttons(); if (bs.length) await card(bs.find(t => /got it|ok|skip|back to work|continue/i.test(t)) || bs[0]); await run(3); }
  end = got.filter(e => e.ev === 'level_end').pop(); console.log('6 hard:', JSON.stringify(end)); assert.strictEqual(end.mode, 'hard'); assert.ok(['fail', 'win'].includes(end.result)); assert.ok(end.secs >= 55 && end.secs <= 66, 'hard secs ' + end.secs);
  await card('Levels'); await run(1);
  // ---- 7. Puzzle 1 with the quiz, solved on the keyboard ----
  await pg.evaluate(() => window.__pb.show('title')); await pg.click('#puzzleBtn'); await run(1); await pg.click('#puzzleContinue'); await run(1);
  for (let i = 0; i < 6 && (await buttons()).length; i++) { const bs = await buttons(); await card(bs.find(t => /skip|start|got it|ok|play/i.test(t)) || bs[0]); await run(1); }
  assert.ok(await pg.evaluate(() => document.querySelector('#routeBrief').open), 'quiz brief open');
  s = await S(); assert.strictEqual(s.round.mode, 'puzzle'); const pq0 = s.round.play; await run(10); assert.ok((await S()).round.play - pq0 < 1.5, 'no play time while the quiz is open');
  await pg.locator('#briefChoices button').first().click(); await run(1); await pg.click('#briefStart'); await run(1);
  const quiz = got.filter(e => e.ev === 'quiz').pop(); assert.ok(quiz && quiz.src === 'puzzle' && quiz.q.startsWith('story-') && quiz.title, JSON.stringify(quiz));
  await pg.focus('#routeBoard');
  for (const sol of ['DDRRUULD', 'RRDDLLUR']) { for (const ch of sol) { await pg.keyboard.press({ D: 'ArrowDown', R: 'ArrowRight', U: 'ArrowUp', L: 'ArrowLeft' }[ch]); } await run(2); if (got.some(e => e.ev === 'level_end' && e.mode === 'puzzle')) break; await pg.click('#routeReset'); await run(1); }
  await run(8); end = got.filter(e => e.ev === 'level_end' && e.mode === 'puzzle' && e.result === 'win').pop(); assert.ok(end, 'puzzle solved: ' + types()); console.log('7 puzzle:', JSON.stringify(end));
  assert.strictEqual(end.cells, 9); assert.ok(end.quiz === 'right' || end.quiz === 'wrong'); assert.ok(end.secs >= 1);
  await pg.click('#puzzleAtlas'); await run(1); assert.strictEqual(got.filter(e => e.ev === 'level_end').pop(), end, 'leaving a solved puzzle is not a quit');
  // ---- 8. ping within a minute, leave on hide, nothing new on a second hide ----
  await run(62); assert.ok(got.some(e => e.ev === 'ping'), 'ping');
  const hide = v => pg.evaluate(v => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v }); document.dispatchEvent(new Event('visibilitychange')); }, v);
  await hide('hidden'); await pg.waitForTimeout(300); const leaves = got.filter(e => e.ev === 'leave').length; assert.strictEqual(leaves, 1); const lv = got.filter(e => e.ev === 'leave').pop();
  const openAtHide = lv.open; await run(120); await hide('visible'); await hide('hidden'); await pg.waitForTimeout(300);
  assert.strictEqual(got.filter(e => e.ev === 'leave').length, 1, 'no second leave when nothing changed'); assert.strictEqual((await S()).open, openAtHide, 'no time counted while hidden');
  await hide('visible'); console.log('8 leave:', JSON.stringify(lv));
  assert.strictEqual(lv.ls, got.filter(e => e.ev === 'level_start').length); assert.strictEqual(lv.lw + lv.lf + lv.lq, got.filter(e => e.ev === 'level_end').length);
  assert.ok(Math.abs(lv.m.reduce((a, v) => a + v, 0) - lv.play) <= 3, 'mode seconds add up to play'); assert.ok(lv.open >= lv.play + lv.menu - 3);
  // ---- 9. offline: events wait on the device, then go ----
  failPosts = true; const before = got.length;
  await pg.evaluate(() => window.__pb.startLevel(1, 'easy')); await run(1); await settle(); await run(4); await pg.evaluate(() => window.__pb.goHome()); await run(3);
  assert.strictEqual(got.length, before); const queued = (await S()).queue; assert.ok(queued >= 2, 'queued ' + queued);
  failPosts = false; await pg.evaluate(() => window.dispatchEvent(new Event('online'))); await pg.waitForTimeout(400); await run(3); await pg.waitForTimeout(400);
  assert.strictEqual((await S()).queue, 0, 'queue flushed'); assert.ok(got.length >= before + 2); console.log('9 offline queue: ok');
  // ---- 10. reload: same player, new session, visit 2 ----
  const pid = got[0].pid, sid1 = got[0].sid; await hide('hidden'); await pg.waitForTimeout(200);
  await pg.reload(); await pg.evaluate(() => window.__pb.noDraw(true)); await run(4);
  const st2 = got.filter(e => e.ev === 'start').pop(); assert.strictEqual(st2.pid, pid); assert.notStrictEqual(st2.sid, sid1); assert.strictEqual(st2.visits, 2); assert.strictEqual(st2.fresh, 0); assert.ok(st2.life >= lv.play);
  console.log('10 reload: ok. progress sent:', JSON.stringify(st2.prog));
  assert.deepStrictEqual(errs.filter(e => !/ERR_EMPTY_RESPONSE/.test(e)), [], 'page errors');   // the empty responses are this test's own simulated outage
  // every event had a unique number per session
  const seen = new Set(); for (const e of got) { const k = e.sid + ':' + e.n; assert.ok(!seen.has(k), 'duplicate ' + k); seen.add(k); }

  // ---- the sheet ----
  const P = env.table('Players'), Se = env.table('Sessions'), L = env.table('Levels'), LS = env.table('Level stats'), D = env.table('Daily'), Q = env.table('Quiz'), E = env.table('Events');
  assert.strictEqual(P.length, 1); assert.strictEqual(Se.length, 2); assert.strictEqual(P[0]['Sessions'], 2);
  const ends = got.filter(e => e.ev === 'level_end'), starts = got.filter(e => e.ev === 'level_start');
  assert.strictEqual(L.length, ends.length); assert.strictEqual(P[0]['Levels started'], starts.length);
  assert.strictEqual(P[0]['Levels won'] + P[0]['Levels failed'] + P[0]['Levels quit'], ends.length);
  assert.strictEqual(LS.reduce((a, r) => a + r.Started, 0), starts.length);
  const sessPlay = Se.reduce((a, r) => a + r['Play time (min)'], 0); assert.ok(Math.abs(P[0]['Play time (min)'] - sessPlay) < 0.1, 'player play = sum of sessions');
  assert.ok(Math.abs(D[0]['Play time (min)'] - sessPlay) < 0.1); assert.strictEqual(E.length, got.filter(e => e.ev !== 'ping').length);
  const modeSum = ['Normal', 'Hard', 'Rush', 'Endless', 'Puzzle'].reduce((a, m) => a + P[0][m + ' (min)'], 0); assert.ok(Math.abs(modeSum - P[0]['Play time (min)']) < 0.15, 'modes add up');
  fs.writeFileSync(path.join(__dirname, 'sheet.json'), JSON.stringify({ Players: P, Sessions: Se, Levels: L, 'Level stats': LS, Daily: D, Quiz: Q, Events: E.length }, null, 1));
  console.log('\nPLAYERS', JSON.stringify(P[0])); console.log('\nSESSION 1', JSON.stringify(Se[0])); console.log('\nLEVELS'); L.forEach(r => console.log(' ', [r.Mode, r.Level, r['Level name'], r.Result, r.Stars, r.Score, r['Play time (s)'], r['Time in level (s)'], r.Moves, r.Details].join(' | ')));
  console.log('\nLEVEL STATS'); LS.forEach(r => console.log(' ', Object.values(r).join(' | '))); console.log('\nDAILY', JSON.stringify(D)); console.log('QUIZ', JSON.stringify(Q));
  console.log('\nALL E2E CHECKS PASSED (first normal level result: ' + firstResult + ')');
  await b.close(); srv.close();
})().catch(e => { console.error('FAILED:', e.message, '\nevents so far:', types()); process.exit(1); });
