const assert = require('assert'); const { makeEnv } = require('./mock');
const GS = process.argv[2];
const env = makeEnv(GS); env.ctx.setup(); env.ctx.setup(); // setup twice: must be safe to re-run
const names = env.sheets.map(s => s.name); console.log('tabs:', names.join(', '));
assert.deepStrictEqual(names, ['Summary', 'Players', 'Sessions', 'Levels', 'Level stats', 'Daily', 'Quiz', 'Events', 'Read me']);
// summary formulas reference real columns
const P = env.ss.getSheetByName('Players').data[0], S = env.ss.getSheetByName('Sessions').data[0], D = env.ss.getSheetByName('Daily').data[0];
const col = n => { let s = ''; while (n > 0) { s = String.fromCharCode(65 + (n - 1) % 26) + s; n = Math.floor((n - 1) / 26); } return s; };
const want = { 'Players!F': 'Play time (min)', 'Players!G': 'Time open (min)', 'Players!C': 'Last seen', 'Players!E': 'Sessions', 'Players!D': 'Days active', 'Players!V': 'Normal (min)', 'Players!W': 'Hard (min)', 'Players!X': 'Rush (min)', 'Players!Y': 'Endless (min)', 'Players!Z': 'Puzzle (min)', 'Players!R': 'Levels started', 'Players!S': 'Levels won', 'Players!T': 'Levels failed', 'Players!U': 'Levels quit', 'Players!AH': 'Quiz answered', 'Players!AI': 'Quiz correct', 'Players!I': 'Device', 'Sessions!F': 'Play time (min)' };
const heads = { Players: P, Sessions: S, Daily: D };
const sum = env.ss.getSheetByName('Summary').data;
const refs = new Set(); sum.forEach(r => (String(r[1]).match(/(Players|Sessions|Daily)!([A-Z]+)/g) || []).forEach(x => refs.add(x)));
for (const ref of refs) { const [tab, c] = ref.split('!'); const idx = c.split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0); const h = heads[tab][idx - 1]; if (want[ref]) assert.strictEqual(h, want[ref], ref); console.log('  ', ref, '->', h); assert.ok(h, ref); }
for (const k in want) assert.ok(refs.has(k), 'summary should use ' + k);
assert.strictEqual(D[1], 'Active players'); assert.strictEqual(D[2], 'New players');

const pid = 'aaaaaaaa-1111-4222-a333-bbbbbbbbbbbb', sid = 's12345e789';
const base = (n, ev, x) => Object.assign({ pid, sid, n, ev, t: env.now, ver: 'v2026.11.04' }, x);
// 1. start
env.post([base(1, 'start', { device: 'Phone', os: 'iOS', browser: 'Safari', platform: 'web', scr: '390x844@3', lang: 'en-SG', tz: 'Asia/Singapore', ref: '', host: 'x.github.io', visits: 1, first: env.now - 5000, fresh: 1, play: 0, open: 3, life: 0, m: [0, 0, 0, 0, 0], menu: 3, facts: 0, shop: 0, ls: 0, lw: 0, lf: 0, lq: 0, qa: 0, qr: 0, at: 'title', last: '', prog: {} })]);
// 2. level start + quiz + win, then ping
env.advance(120000);
env.post([base(2, 'level_start', { mode: 'normal', lv: 1, name: 'Kopitiam' }), base(3, 'quiz', { src: 'level', q: 'cut', title: '=HYPERLINK("http://evil")', ok: 1, mode: 'normal', lv: 1 }),
  base(4, 'level_end', { mode: 'normal', lv: 1, name: 'Kopitiam', result: 'win', stars: 3, score: 42, points: 42, kwh: 900, low: 55, wise: 1, hour: 24, secs: 95, wall: 110, moves: 14, turns: 4, placed: 10, sends: 8 }),
  base(5, 'ping', { play: 95, open: 123, life: 95, m: [95, 0, 0, 0, 0], menu: 10, facts: 0, shop: 0, ls: 1, lw: 1, lf: 0, lq: 0, qa: 1, qr: 1, at: 'game', last: 'normal 1', prog: { nl: 1, ns: 3, hl: 0, rl: 0, rb: 0, ed: 0, ep: 0, pz: 0 } })]);
let p = env.table('Players'), s = env.table('Sessions');
assert.strictEqual(p.length, 1); assert.strictEqual(s.length, 1);
assert.strictEqual(Math.round(p[0]['Play time (min)'] * 60), 95); assert.strictEqual(Math.round(p[0]['Time open (min)'] * 60), 123); assert.strictEqual(Math.round(p[0]['Normal (min)'] * 60), 95);
assert.strictEqual(p[0]['Levels started'], 1); assert.strictEqual(p[0]['Levels won'], 1); assert.strictEqual(p[0]['Normal stars'], 3); assert.strictEqual(p[0]['Quiz correct'], 1);
assert.strictEqual(p[0]['Device'], 'Phone'); assert.strictEqual(p[0]['Came from'], 'direct'); assert.strictEqual(p[0]['Sessions'], 1); assert.strictEqual(p[0]['Last result'], 'win');
assert.strictEqual(s[0]['Session ID'], sid); assert.strictEqual(s[0]['Levels won'], 1);
// formula text is neutralised
const q = env.table('Quiz'); assert.strictEqual(q.length, 1); assert.ok(q[0]['Question'].startsWith("'="), q[0]['Question']); assert.strictEqual(q[0]['Correct rate'], 1);
// 3. the same batch again (a resend) changes nothing
const before = JSON.stringify([env.table('Players'), env.table('Levels'), env.table('Level stats'), env.table('Daily'), env.table('Events').length]);
env.post([base(4, 'level_end', { mode: 'normal', lv: 1, name: 'Kopitiam', result: 'win', stars: 3, score: 42, secs: 95, wall: 110 }), base(2, 'level_start', { mode: 'normal', lv: 1, name: 'Kopitiam' })]);
assert.strictEqual(JSON.stringify([env.table('Players'), env.table('Levels'), env.table('Level stats'), env.table('Daily'), env.table('Events').length]), before, 'resend must not double count');
// 4. fail + quit, leave
env.advance(60000);
env.post([base(6, 'level_start', { mode: 'hard', lv: 1, name: 'Kopitiam' }), base(7, 'level_end', { mode: 'hard', lv: 1, name: 'Kopitiam', result: 'fail', stars: 1, score: 5, secs: 60, wall: 61 }),
  base(8, 'level_start', { mode: 'puzzle', lv: 3, name: 'Tiong Bahru' }), base(9, 'level_end', { mode: 'puzzle', lv: 3, name: 'Tiong Bahru', result: 'quit', secs: 20, wall: 30, moves: 5, cells: 16, quiz: 'wrong', hints: 0 }),
  base(10, 'leave', { play: 175, open: 240, life: 175, m: [95, 60, 0, 0, 20], menu: 20, facts: 5, shop: 0, ls: 3, lw: 1, lf: 1, lq: 1, qa: 1, qr: 1, at: 'puzzleLevels', last: 'puzzle 3', prog: { nl: 1, ns: 3 } })]);
p = env.table('Players'); s = env.table('Sessions');
assert.strictEqual(Math.round(p[0]['Play time (min)'] * 60), 175); assert.strictEqual(Math.round(p[0]['Hard (min)'] * 60), 60); assert.strictEqual(Math.round(p[0]['Puzzle (min)'] * 60), 20);
assert.strictEqual(p[0]['Levels started'], 3); assert.strictEqual(p[0]['Levels failed'], 1); assert.strictEqual(p[0]['Levels quit'], 1);
assert.strictEqual(s[0]['Closed cleanly'], 'yes'); assert.strictEqual(Math.round(s[0]['Reading facts (min)'] * 60), 5);
const ls = env.table('Level stats'); assert.strictEqual(ls.length, 3);
const n1 = ls.find(r => r.Mode === 'Normal'); assert.strictEqual(n1['Win rate'], 1); assert.strictEqual(n1['Avg play time (s)'], 95); assert.strictEqual(n1['Avg stars on a win'], 3); assert.strictEqual(n1['Best score'], 42);
const lv = env.table('Levels'); assert.strictEqual(lv.length, 3); assert.strictEqual(lv[2].Stars, ''); assert.strictEqual(lv[2].Score, '');
console.log('  details:', lv.map(r => r.Details).join(' | '));
// 5. same player, new session next day -> days active 2, daily has 2 rows, lifetime from device wins if higher
env.advance(24 * 3600e3);
env.post([{ pid, sid: 's2222222222'.slice(0, 10), n: 1, ev: 'start', t: env.now, ver: 'v2026.11.04', device: 'Phone', os: 'iOS', browser: 'Safari', platform: 'web', visits: 2, first: 1, play: 0, open: 3, life: 300, m: [0, 0, 0, 0, 0], ref: 'www.google.com' }]);
// and a second player
env.post([{ pid: 'cccccccc-1111-4222-a333-bbbbbbbbbbbb', sid: 's333333333', n: 1, ev: 'start', t: env.now, device: 'Computer', os: 'Windows', browser: 'Chrome', visits: 1, play: 0, open: 3, life: 0 }]);
p = env.table('Players'); assert.strictEqual(p.length, 2); assert.strictEqual(p[0]['Days active'], 2); assert.strictEqual(p[0]['Sessions'], 2); assert.strictEqual(Math.round(p[0]['Play time (min)'] * 60), 300);
assert.strictEqual(p[0]['Came from'], 'direct', 'first source is kept');
const d = env.table('Daily'); assert.strictEqual(d.length, 2); assert.deepStrictEqual([d[0]['Active players'], d[0]['New players'], d[0]['Sessions'], d[1]['Active players'], d[1]['New players'], d[1]['Sessions']], [1, 1, 1, 2, 1, 2]);
assert.strictEqual(d[0].Date, '2026-11-10'); assert.strictEqual(d[1].Date, '2026-11-11');
assert.strictEqual(Math.round(d[0]['Play time (min)'] * 60), 175);
// 6. junk is ignored
for (const junk of ['not json', '{}', '[]', JSON.stringify([{ pid: 'short', sid: 'x', ev: 'start' }]), JSON.stringify([{ pid, sid, n: 99, ev: 'constructor' }]), JSON.stringify([base(50, 'level_end', { mode: 'nope', result: 'win' })]), JSON.stringify([base(51, 'level_end', { mode: 'rush', lv: 2, result: '__proto__' })])]) env.post(junk);
assert.strictEqual(env.table('Levels').length, 3); assert.strictEqual(env.table('Players').length, 2);
// 7. the day column read back as a real date (as Sheets may convert it) still matches
env.ss.getSheetByName('Daily').data[2][0] = new Date(Date.UTC(2026, 10, 10, 16, 0, 0)); // midnight 11 Nov in Singapore
env.post([{ pid: 'dddddddd-1111-4222-a333-bbbbbbbbbbbb', sid: 's444444444', n: 1, ev: 'start', t: env.now, device: 'Tablet' }]);
assert.strictEqual(env.table('Daily').length, 2); assert.strictEqual(env.table('Daily')[1]['Active players'], 3);
console.log('unit checks passed');
