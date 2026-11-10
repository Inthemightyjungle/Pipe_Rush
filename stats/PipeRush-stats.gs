/**
 * Pipe Rush play statistics: the Google Sheet side.
 *
 * Setup (once):
 *   1. Make a new Google Sheet. Extensions > Apps Script. Replace the code there with this file. Save.
 *   2. Choose the function "setup" and press Run. Approve the permission prompt. The tabs appear.
 *   3. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone. Deploy.
 *   4. Copy the web app URL (it ends in /exec) into STATS_URL in the game.
 * After changing this file: Deploy > Manage deployments > edit > Version: New version. The URL stays the same.
 *
 * Tabs: Summary, Players, Sessions, Levels, Level stats, Daily, Quiz, Events, Read me.
 * Times in the data tabs are minutes (seconds on the two level tabs). File > Download > Microsoft Excel gives an .xlsx copy.
 */

var MODES = ['normal', 'hard', 'rush', 'endless', 'puzzle'];
var MODE_NAME = { normal: 'Normal', hard: 'Hard', rush: 'Rush', endless: 'Endless', puzzle: 'Puzzle' };
var RESULTS = { win: 1, fail: 1, quit: 1, restart: 1 };
var EVENTS = { start: 1, ping: 1, leave: 1, level_start: 1, level_end: 1, quiz: 1 };
var DUR = '[h]:mm:ss', MIN = '0.0', STAMP = 'yyyy-mm-dd hh:mm:ss';

var TABS = {
  Players: { head: ['Player ID', 'First seen', 'Last seen', 'Days active', 'Sessions', 'Play time (min)', 'Time open (min)', 'Avg play per session (min)',
      'Device', 'System', 'Browser', 'Opened as', 'Screen', 'Language', 'Time zone', 'Came from', 'Game version',
      'Levels started', 'Levels won', 'Levels failed', 'Levels quit',
      'Normal (min)', 'Hard (min)', 'Rush (min)', 'Endless (min)', 'Puzzle (min)',
      'Normal levels cleared', 'Normal stars', 'Hard levels at 3 stars', 'Rush levels at 3 stars', 'Rush best run score', 'Endless best days', 'Puzzles solved',
      'Quiz answered', 'Quiz correct', 'Last level played', 'Last result'],
    min: [6, 7, 8, 22, 23, 24, 25, 26], stamp: [2, 3] },
  Sessions: { head: ['Session ID', 'Player ID', 'Started', 'Last update', 'Time open (min)', 'Play time (min)',
      'Normal (min)', 'Hard (min)', 'Rush (min)', 'Endless (min)', 'Puzzle (min)', 'In menus (min)', 'Reading facts (min)', 'In workshop (min)',
      'Levels started', 'Levels won', 'Levels failed', 'Levels quit', 'Quiz answered', 'Quiz correct', 'Visit number',
      'Device', 'System', 'Browser', 'Opened as', 'Screen', 'Game version', 'Came from', 'Last screen', 'Last level', 'Closed cleanly'],
    min: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14], stamp: [3, 4] },
  Levels: { head: ['Time', 'Player ID', 'Session ID', 'Mode', 'Level', 'Level name', 'Result', 'Stars', 'Score', 'Play time (s)', 'Time in level (s)', 'Moves', 'Details', 'Game version'],
    stamp: [1] },
  'Level stats': { head: ['Mode', 'Level', 'Level name', 'Started', 'Won', 'Failed', 'Quit or restarted', 'Win rate', 'Avg play time (s)', 'Avg stars on a win', 'Best score', 'Total play time (s)', 'Stars total'],
    pct: [8] },
  Daily: { head: ['Date', 'Active players', 'New players', 'Sessions', 'Play time (min)', 'Time open (min)', 'Levels started', 'Levels won', 'Levels failed', 'Levels quit', 'Quiz answered', 'Quiz correct'],
    min: [5, 6], text: [1] },
  Quiz: { head: ['Where', 'Question ID', 'Question', 'Answered', 'Correct', 'Correct rate'], pct: [6] },
  Events: { head: ['Received', 'Sent', 'Player ID', 'Session ID', 'No.', 'Event', 'Mode', 'Level', 'Result', 'Data', 'Game version'], stamp: [1, 2] }
};

/* ---------- setup ---------- */

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var summary = ss.getSheetByName('Summary') || ss.insertSheet('Summary', 0);
  Object.keys(TABS).forEach(function (name) {
    var T = TABS[name], sh = ss.getSheetByName(name) || ss.insertSheet(name), n = T.head.length;
    sh.getRange(1, 1, 1, n).setValues([T.head]).setFontWeight('bold').setBackground('#1a2236').setFontColor('#fff3d6').setWrap(true);
    sh.setFrozenRows(1);
    (T.min || []).forEach(function (c) { sh.getRange(2, c, sh.getMaxRows() - 1, 1).setNumberFormat(MIN); });
    (T.text || []).forEach(function (c) { sh.getRange(2, c, sh.getMaxRows() - 1, 1).setNumberFormat('@'); });
    (T.stamp || []).forEach(function (c) { sh.getRange(2, c, sh.getMaxRows() - 1, 1).setNumberFormat(STAMP); });
    (T.pct || []).forEach(function (c) { sh.getRange(2, c, sh.getMaxRows() - 1, 1).setNumberFormat('0%'); });
  });
  ss.getSheetByName('Players').setFrozenColumns(1);
  ss.getSheetByName('Sessions').setFrozenColumns(2);
  writeSummary_(summary);
  writeReadMe_(ss.getSheetByName('Read me') || ss.insertSheet('Read me'));
  var blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
}

function writeSummary_(sh) {
  var rows = [
    ['Pipe Rush play statistics', ''],
    ['Updates by itself while people play. Times on this tab are hours:minutes:seconds.', ''],
    ['', ''],
    ['PLAYERS', ''],
    ['Players in total', '=COUNTA(Players!A2:A)'],
    ['Players active today', '=IFERROR(VLOOKUP(TEXT(TODAY(),"yyyy-mm-dd"),Daily!A:B,2,FALSE),IFERROR(VLOOKUP(TODAY(),Daily!A:B,2,FALSE),0))'],
    ['New players today', '=IFERROR(VLOOKUP(TEXT(TODAY(),"yyyy-mm-dd"),Daily!A:C,3,FALSE),IFERROR(VLOOKUP(TODAY(),Daily!A:C,3,FALSE),0))'],
    ['Players active in the last 7 days', '=COUNTIF(Players!C2:C,">="&(TODAY()-6))'],
    ['Players who came back (2 or more sessions)', '=COUNTIF(Players!E2:E,">1")'],
    ['Players who played on 2 or more days', '=COUNTIF(Players!D2:D,">1")'],
    ['', ''],
    ['PLAY TIME', ''],
    ['Total play time', '=SUM(Players!F2:F)/1440'],
    ['Total time with the game open', '=SUM(Players!G2:G)/1440'],
    ['Average play time per player', '=IFERROR(SUM(Players!F2:F)/COUNTA(Players!A2:A)/1440,0)'],
    ['Longest play time by one player', '=MAX(Players!F2:F)/1440'],
    ['Sessions in total', '=COUNTA(Sessions!A2:A)'],
    ['Average play time per session', '=IFERROR(SUM(Sessions!F2:F)/COUNTA(Sessions!A2:A)/1440,0)'],
    ['Average sessions per player', '=IFERROR(COUNTA(Sessions!A2:A)/COUNTA(Players!A2:A),0)'],
    ['', ''],
    ['PLAY TIME BY MODE', ''],
    ['Normal play time', '=SUM(Players!V2:V)/1440'],
    ['Hard play time', '=SUM(Players!W2:W)/1440'],
    ['Rush play time', '=SUM(Players!X2:X)/1440'],
    ['Endless play time', '=SUM(Players!Y2:Y)/1440'],
    ['Puzzle play time', '=SUM(Players!Z2:Z)/1440'],
    ['', ''],
    ['LEVELS', ''],
    ['Levels started', '=SUM(Players!R2:R)'],
    ['Levels won', '=SUM(Players!S2:S)'],
    ['Levels failed', '=SUM(Players!T2:T)'],
    ['Levels quit or restarted', '=SUM(Players!U2:U)'],
    ['Win rate', '=IFERROR(SUM(Players!S2:S)/(SUM(Players!S2:S)+SUM(Players!T2:T)+SUM(Players!U2:U)),0)'],
    ['Quiz questions answered', '=SUM(Players!AH2:AH)'],
    ['Quiz correct rate', '=IFERROR(SUM(Players!AI2:AI)/SUM(Players!AH2:AH),0)'],
    ['', ''],
    ['DEVICES', ''],
    ['Players on phones', '=COUNTIF(Players!I2:I,"Phone")'],
    ['Players on tablets', '=COUNTIF(Players!I2:I,"Tablet")'],
    ['Players on computers', '=COUNTIF(Players!I2:I,"Computer")']
  ];
  sh.clear();
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  sh.getRange(1, 1).setFontSize(16).setFontWeight('bold');
  sh.setColumnWidth(1, 330); sh.setColumnWidth(2, 140);
  rows.forEach(function (r, i) {
    var cell = sh.getRange(i + 1, 2), label = r[0];
    if (/^[A-Z ]+$/.test(label) && label) sh.getRange(i + 1, 1, 1, 2).setFontWeight('bold').setBackground('#1a2236').setFontColor('#fff3d6');
    else if (/time/i.test(label) && r[1]) cell.setNumberFormat(DUR);
    else if (/rate/i.test(label)) cell.setNumberFormat('0%');
    else if (/Average sessions/.test(label)) cell.setNumberFormat('0.0');
  });
}

function writeReadMe_(sh) {
  var rows = [
    ['What each tab shows'],
    ['Summary: the headline numbers. It recalculates by itself.'],
    ['Players: one row for each device that has opened the game. The ID is random; no names or accounts are collected.'],
    ['Sessions: one row for each visit (each time the game page is opened).'],
    ['Levels: one row each time a level ends: won, failed, quit or restarted.'],
    ['Level stats: one row for each level in each mode, with how often it is started, won and failed.'],
    ['Daily: one row for each day.'],
    ['Quiz: one row for each quiz question, with how often it is answered correctly.'],
    ['Events: the raw log of everything the game sent.'],
    [''],
    ['How time is counted'],
    ['Times in the Players, Sessions and Daily tabs are in minutes. Times in the Levels and Level stats tabs are in seconds.'],
    ['Play time: time inside a level with the board showing. It stops while a card, the pause menu or a quiz is open.'],
    ['Time in level: play time plus the time spent on cards inside that level.'],
    ['Time open: all time with the game on screen, including menus.'],
    ['No time is counted while the game is in a background tab, or after a minute without a tap, click or key press.'],
    ['The game reports once a minute and when the page is hidden or closed, so a visit that ends suddenly can be up to a minute short.'],
    [''],
    ['Notes'],
    ['A player who clears their browser data, or uses another browser or device, shows up as a new player.'],
    ['Days and dates use this spreadsheet\'s time zone (File > Settings).'],
    ['To keep a copy in Excel: File > Download > Microsoft Excel (.xlsx).'],
    ['Do not rename the tabs or move the columns: the script writes to them by position. Adding your own tabs is fine.']
  ];
  sh.clear();
  sh.getRange(1, 1, rows.length, 1).setValues(rows);
  sh.setColumnWidth(1, 900);
  [1, 11, 19].forEach(function (r) { sh.getRange(r, 1).setFontWeight('bold'); });
}

/* ---------- web app ---------- */

function doGet() {
  return ContentService.createTextOutput('Pipe Rush stats are live.');
}

function doPost(e) {
  var out = ContentService.createTextOutput('ok');
  var list;
  try { list = JSON.parse(e.postData.contents); } catch (err) { return out; }
  if (!Array.isArray(list)) list = [list];
  list = list.slice(0, 40).filter(valid_);
  if (!list.length) return out;
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (err) { return out; }
  try { record_(list); } finally { lock.releaseLock(); }
  return out;
}

function valid_(ev) {
  return ev && typeof ev === 'object' && /^[A-Za-z0-9-]{8,40}$/.test(String(ev.pid || '')) && /^[A-Za-z0-9]{6,12}$/.test(String(ev.sid || '')) && EVENTS[ev.ev] === 1;
}

/* ---------- helpers ---------- */

/* text from the game is never trusted: trimmed, and kept from being read as a formula */
function clean_(v, max) {
  var s = String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max || 60);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
function num_(v, max) { v = Number(v); return isFinite(v) && v > 0 ? Math.min(Math.round(v), max == null ? 1e9 : max) : 0; }
/* times are kept as minutes in the sheet and worked on as whole seconds here */
function toMin_(secs) { return secs / 60; }
function secs_(v) { return Math.round((Number(v) || 0) * 60); }
function mode_(m) { return MODES.indexOf(m) >= 0 ? m : ''; }

/* a tab held in memory: read once, changed, then written back in one go */
function Table_(ss, name) {
  this.sh = ss.getSheetByName(name);
  this.n = TABS[name].head.length;
  var last = this.sh.getLastRow();
  this.rows = last > 1 ? this.sh.getRange(2, 1, last - 1, this.n).getValues() : [];
  this.old = this.rows.length; this.lo = -1; this.hi = -1; this.map = null;
}
Table_.prototype.index = function (keyOf) {
  this.keyOf = keyOf; this.map = {};
  for (var i = 0; i < this.rows.length; i++) this.map[keyOf(this.rows[i])] = i;
};
Table_.prototype.find = function (key) { var i = this.map[key]; return i == null ? -1 : i; };
Table_.prototype.touch = function (i) { if (i < this.old) { if (this.lo < 0 || i < this.lo) this.lo = i; if (i > this.hi) this.hi = i; } };
Table_.prototype.add = function (row) {
  while (row.length < this.n) row.push('');
  this.rows.push(row); var i = this.rows.length - 1;
  if (this.map) this.map[this.keyOf(row)] = i;
  return i;
};
Table_.prototype.save = function () {
  if (this.lo >= 0) this.sh.getRange(this.lo + 2, 1, this.hi - this.lo + 1, this.n).setValues(this.rows.slice(this.lo, this.hi + 1));
  if (this.rows.length > this.old) this.sh.getRange(this.old + 2, 1, this.rows.length - this.old, this.n).setValues(this.rows.slice(this.old));
};

/* ---------- recording ---------- */

function record_(list) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), tz = ss.getSpreadsheetTimeZone(), now = new Date();
  var today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');

  /* drop anything already recorded (the game resends when it is not sure a batch arrived) */
  var cache = CacheService.getScriptCache(), keys = list.map(function (ev) { return 'e:' + ev.pid + ':' + ev.sid + ':' + num_(ev.n, 1e6); });
  var seen = {}; try { seen = cache.getAll(keys) || {}; } catch (err) {}
  var fresh = [], mark = {};
  list.forEach(function (ev, i) { if (!seen[keys[i]] && !mark[keys[i]]) { mark[keys[i]] = '1'; fresh.push(ev); } });
  if (!fresh.length) return;
  fresh.sort(function (a, b) { return (num_(a.t, 1e14) - num_(b.t, 1e14)) || (num_(a.n, 1e6) - num_(b.n, 1e6)); });

  var P = new Table_(ss, 'Players'), S = new Table_(ss, 'Sessions'), D = new Table_(ss, 'Daily');
  P.index(function (r) { return String(r[0]); }); S.index(function (r) { return String(r[0]); }); D.index(function (r) { return dayKey_(r[0], tz); });
  var L = null, LS = null, Q = null, events = [];

  var day = D.find(today);
  if (day < 0) day = D.add([today, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  var dayRow = D.rows[day]; D.touch(day);
  for (var c = 1; c < 12; c++) dayRow[c] = Number(dayRow[c]) || 0;

  fresh.forEach(function (ev) {
    var pid = String(ev.pid), sid = String(ev.sid), type = ev.ev, ver = clean_(ev.ver, 16);
    var sent = new Date(Number(ev.t) || 0), when = sent.getTime() > now.getTime() - 7 * 864e5 && sent.getTime() < now.getTime() + 3e5 ? sent : now;

    /* the player's row */
    var pi = P.find(pid), p;
    if (pi < 0) {
      var first = new Date(Number(ev.first) || 0);
      if (!(first.getTime() > 1.7e12 && first.getTime() <= now.getTime())) first = when;
      pi = P.add([pid, first, now, 1, 0, 0, 0, 0, '', '', '', '', '', '', '', '', ver, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', '']);
      dayRow[1]++; dayRow[2]++;
      p = P.rows[pi];
    } else {
      p = P.rows[pi]; P.touch(pi);
      if (dayKey_(p[2], tz) !== today) { p[3] = (Number(p[3]) || 0) + 1; dayRow[1]++; }
      p[2] = now;
    }
    if (ver) p[16] = ver;

    /* the session's row */
    var si = S.find(sid), s;
    if (si < 0) {
      si = S.add([sid, pid, when, now, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', '', '', '', '', '', ver, '', '', '', '']);
      p[4] = (Number(p[4]) || 0) + 1; dayRow[3]++;
      s = S.rows[si];
    } else { s = S.rows[si]; S.touch(si); s[3] = now; }

    if (type === 'start') {
      var about = [clean_(ev.device, 12), clean_(ev.os, 12), clean_(ev.browser, 20), clean_(ev.platform, 16), clean_(ev.scr, 20)];
      for (var a = 0; a < 5; a++) { p[8 + a] = about[a]; s[21 + a] = about[a]; }
      p[13] = clean_(ev.lang, 16); p[14] = clean_(ev.tz, 40);
      var ref = clean_(ev.ref, 60); s[27] = ref || 'direct'; if (!p[15]) p[15] = ref || 'direct';
      s[20] = num_(ev.visits, 1e6);
    }

    /* running totals for this visit: start, ping and leave all carry them */
    if (type === 'start' || type === 'ping' || type === 'leave') {
      var play = num_(ev.play, 864000), open = num_(ev.open, 864000), dPlay = Math.max(0, play - secs_(s[5])), dOpen = Math.max(0, open - secs_(s[4]));
      s[4] = toMin_(Math.max(open, secs_(s[4]))); s[5] = toMin_(Math.max(play, secs_(s[5])));
      var m = Array.isArray(ev.m) ? ev.m : [];
      for (var k = 0; k < 5; k++) {
        var v = num_(m[k], 864000), d = Math.max(0, v - secs_(s[6 + k]));
        s[6 + k] = toMin_(Math.max(v, secs_(s[6 + k]))); p[21 + k] = toMin_(secs_(p[21 + k]) + d);
      }
      s[11] = toMin_(Math.max(num_(ev.menu, 864000), secs_(s[11]))); s[12] = toMin_(Math.max(num_(ev.facts, 864000), secs_(s[12]))); s[13] = toMin_(Math.max(num_(ev.shop, 864000), secs_(s[13])));
      s[14] = Math.max(num_(ev.ls, 1e5), Number(s[14]) || 0); s[15] = Math.max(num_(ev.lw, 1e5), Number(s[15]) || 0);
      s[16] = Math.max(num_(ev.lf, 1e5), Number(s[16]) || 0); s[17] = Math.max(num_(ev.lq, 1e5), Number(s[17]) || 0);
      s[18] = Math.max(num_(ev.qa, 1e5), Number(s[18]) || 0); s[19] = Math.max(num_(ev.qr, 1e5), Number(s[19]) || 0);
      s[28] = clean_(ev.at, 16); if (ev.last) s[29] = clean_(ev.last, 24);
      s[30] = type === 'leave' ? 'yes' : '';
      /* the player's totals: this visit's new seconds, or the device's own lifetime count if that is higher */
      p[5] = toMin_(Math.max(secs_(p[5]) + dPlay, num_(ev.life, 31536000))); p[6] = toMin_(secs_(p[6]) + dOpen);
      p[7] = toMin_(secs_(p[5]) / Math.max(1, Number(p[4]) || 1));
      dayRow[4] = toMin_(secs_(dayRow[4]) + dPlay); dayRow[5] = toMin_(secs_(dayRow[5]) + dOpen);
      var g = ev.prog && typeof ev.prog === 'object' ? ev.prog : null;
      if (g) { p[26] = num_(g.nl, 99); p[27] = num_(g.ns, 999); p[28] = num_(g.hl, 99); p[29] = num_(g.rl, 99); p[30] = num_(g.rb); p[31] = num_(g.ed, 1e5); p[32] = num_(g.pz, 999); }
    }

    var mode = mode_(ev.mode), lv = num_(ev.lv, 1e5), name = clean_(ev.name, 40);

    if (type === 'level_start' && mode) {
      if (!LS) { LS = new Table_(ss, 'Level stats'); LS.index(function (r) { return r[0] + '|' + r[1]; }); }
      var st = levelRow_(LS, mode, lv, name); st[3]++;
      p[17] = (Number(p[17]) || 0) + 1; dayRow[6]++;
      p[35] = MODE_NAME[mode] + ' ' + lv + (name ? ' · ' + name : ''); p[36] = 'playing';
    }

    if (type === 'level_end' && mode && RESULTS[ev.result] === 1) {
      if (!L) L = new Table_(ss, 'Levels');
      if (!LS) { LS = new Table_(ss, 'Level stats'); LS.index(function (r) { return r[0] + '|' + r[1]; }); }
      var result = ev.result, secs = num_(ev.secs, 86400), wall = Math.max(secs, num_(ev.wall, 86400)), stars = Math.min(3, num_(ev.stars, 3)), score = num_(ev.score);
      var hasStars = mode !== 'puzzle' && result !== 'quit' && result !== 'restart';
      L.add([when, pid, sid, MODE_NAME[mode], lv, name, result, hasStars ? stars : '', mode === 'puzzle' ? '' : score, secs, wall, num_(ev.moves, 1e6), details_(ev, mode), ver]);
      var t = levelRow_(LS, mode, lv, name);
      if (result === 'win') { t[4]++; t[12] += stars; p[18] = (Number(p[18]) || 0) + 1; dayRow[7]++; }
      else if (result === 'fail') { t[5]++; p[19] = (Number(p[19]) || 0) + 1; dayRow[8]++; }
      else { t[6]++; p[20] = (Number(p[20]) || 0) + 1; dayRow[9]++; }
      t[11] = (Number(t[11]) || 0) + secs;
      var ended = t[4] + t[5] + t[6];
      t[7] = ended ? t[4] / ended : 0; t[8] = ended ? Math.round(t[11] / ended) : 0; t[9] = t[4] && mode !== 'puzzle' ? Math.round(t[12] / t[4] * 100) / 100 : '';
      if (mode !== 'puzzle') t[10] = Math.max(Number(t[10]) || 0, score);
      p[35] = MODE_NAME[mode] + ' ' + lv + (name ? ' · ' + name : ''); p[36] = result;
    }

    if (type === 'quiz') {
      if (!Q) { Q = new Table_(ss, 'Quiz'); Q.index(function (r) { return r[0] + '|' + r[1]; }); }
      var where = ev.src === 'puzzle' ? 'Puzzle' : 'Level', qid = clean_(ev.q, 40) || 'unknown', qi = Q.find(where + '|' + qid);
      if (qi < 0) qi = Q.add([where, qid, clean_(ev.title, 120), 0, 0, 0]); else Q.touch(qi);
      var q = Q.rows[qi]; q[3] = (Number(q[3]) || 0) + 1; if (ev.ok) q[4] = (Number(q[4]) || 0) + 1; q[5] = q[4] / q[3];
      if (!q[2] && ev.title) q[2] = clean_(ev.title, 120);
      p[33] = (Number(p[33]) || 0) + 1; if (ev.ok) p[34] = (Number(p[34]) || 0) + 1;
      dayRow[10]++; if (ev.ok) dayRow[11]++;
    }

    if (type !== 'ping') events.push([now, sent.getTime() > 1.7e12 ? sent : '', pid, sid, num_(ev.n, 1e6), type, mode ? MODE_NAME[mode] : '', lv || '', clean_(ev.result, 10), data_(ev), ver]);
  });

  P.save(); S.save(); D.save();
  if (L) L.save(); if (LS) LS.save(); if (Q) Q.save();
  if (events.length) { var E = ss.getSheetByName('Events'); E.getRange(E.getLastRow() + 1, 1, events.length, events[0].length).setValues(events); }
  try { cache.putAll(mark, 21600); } catch (err) {}
}

function dayKey_(v, tz) {
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  return String(v || '').slice(0, 10);
}

function levelRow_(LS, mode, lv, name) {
  var key = MODE_NAME[mode] + '|' + lv, i = LS.find(key);
  if (i < 0) i = LS.add([MODE_NAME[mode], lv, name, 0, 0, 0, 0, 0, 0, '', mode === 'puzzle' ? '' : 0, 0, 0]); else LS.touch(i);
  var r = LS.rows[i];
  for (var c = 3; c <= 6; c++) r[c] = Number(r[c]) || 0;
  r[12] = Number(r[12]) || 0;
  if (!r[2] && name) r[2] = name;
  return r;
}

/* the Details column of the Levels tab, in plain words */
function details_(ev, mode) {
  var out = [];
  if (mode === 'puzzle') {
    if (ev.cells) out.push(num_(ev.cells, 999) + ' squares');
    if (ev.quiz === 'right' || ev.quiz === 'wrong') out.push('quiz ' + ev.quiz);
    if (ev.hints !== '' && ev.hints != null) out.push(num_(ev.hints, 9) + ' hints used');
    if (ev.resumed) out.push('continued from a saved route');
  } else {
    out.push(num_(ev.points, 1e6) + ' power points');
    if (mode === 'normal' || mode === 'endless') out.push(num_(ev.kwh) + ' kWh');
    if (mode === 'rush' && ev.bonus) out.push('speed bonus ' + num_(ev.bonus));
    if (mode !== 'rush') out.push('lowest city power ' + num_(ev.low, 100) + '%');
    out.push(num_(ev.turns, 1e6) + ' turns, ' + num_(ev.placed, 1e6) + ' pipes placed, ' + num_(ev.sends, 1e6) + ' gas sends');
    if (ev.wise) out.push(num_(ev.wise, 99) + ' quiz right');
    if (ev.result === 'fail' && mode !== 'rush' && mode !== 'hard') out.push('blackout at hour ' + (Math.round((Number(ev.hour) || 0) * 10) / 10));
  }
  return out.join('; ');
}

/* the Data column of the Events tab: what the game sent, minus the IDs already in their own columns */
function data_(ev) {
  var o = {};
  Object.keys(ev).forEach(function (k) { if (['pid', 'sid', 'n', 'ev', 't', 'ver', 'mode', 'lv', 'result'].indexOf(k) < 0) o[k] = ev[k]; });
  var s = ''; try { s = JSON.stringify(o); } catch (err) {}
  return clean_(s === '{}' ? '' : s, 600);
}
