// In-memory stand-ins for the Apps Script services, enough to run PipeRush-stats.gs.
const fs = require('fs'), vm = require('vm');
function makeEnv(gsPath, opts = {}) {
  const tz = opts.tz || 'Asia/Singapore';
  let nowMs = opts.now || Date.UTC(2026, 10, 10, 3, 0, 0);
  class Range {
    constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
    getValues() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sh.cell(this.r + i, this.c + j)); o.push(row); } return o; }
    setValues(v) {
      if (v.length !== this.nr) throw new Error(`setValues rows ${v.length} != ${this.nr} on ${this.sh.name}`);
      v.forEach((row, i) => { if (row.length !== this.nc) throw new Error(`setValues cols ${row.length} != ${this.nc} on ${this.sh.name} row ${this.r + i}`);
        row.forEach((x, j) => { if (x === undefined || (typeof x === 'number' && !isFinite(x))) throw new Error(`bad value ${x} on ${this.sh.name} r${this.r + i} c${this.c + j}`); this.sh.put(this.r + i, this.c + j, x); }); });
      return this; }
    setValue(x) { this.sh.put(this.r, this.c, x); return this; }
    setNumberFormat(f) { (this.sh.formats[this.c] = f); return this; }
    setFontWeight() { return this; } setBackground() { return this; } setFontColor() { return this; } setWrap() { return this; } setFontSize() { return this; }
  }
  class Sheet {
    constructor(name) { this.name = name; this.data = []; this.formats = {}; this.frozen = 0; }
    cell(r, c) { const row = this.data[r - 1]; const v = row ? row[c - 1] : undefined; return v === undefined ? '' : v; }
    put(r, c, v) { while (this.data.length < r) this.data.push([]); const row = this.data[r - 1]; while (row.length < c) row.push(''); row[c - 1] = v; }
    getRange(r, c, nr = 1, nc = 1) { if (r < 1 || c < 1 || nr < 1 || nc < 1) throw new Error(`bad range ${r},${c},${nr},${nc} on ${this.name}`); return new Range(this, r, c, nr, nc); }
    getLastRow() { for (let i = this.data.length; i > 0; i--) if (this.data[i - 1].some(v => v !== '' && v != null)) return i; return 0; }
    getMaxRows() { return 1000; }
    setFrozenRows(n) { this.frozen = n; } setFrozenColumns() {} setColumnWidth() {} clear() { this.data = []; }
    appendRow(row) { this.data.push(row.slice()); }
  }
  const sheets = [new Sheet('Sheet1')];
  const ss = {
    getSheetByName: n => sheets.find(s => s.name === n) || null,
    insertSheet: (n, i) => { const s = new Sheet(n); if (i === 0) sheets.unshift(s); else sheets.push(s); return s; },
    getSheets: () => sheets, deleteSheet: s => sheets.splice(sheets.indexOf(s), 1),
    getSpreadsheetTimeZone: () => tz
  };
  const cacheStore = {};
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    Utilities: { formatDate: (d, zone, fmt) => { if (fmt !== 'yyyy-MM-dd') throw new Error('fmt'); return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); } },
    CacheService: { getScriptCache: () => ({ getAll: keys => { const o = {}; keys.forEach(k => { if (cacheStore[k]) o[k] = cacheStore[k]; }); return o; }, putAll: (m) => Object.assign(cacheStore, m) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { createTextOutput: t => ({ text: t }) },
    console
  };
  // the script's own clock
  const RealDate = Date;
  class FakeDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(nowMs); } static now() { return nowMs; } }
  ctx.Date = FakeDate;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(gsPath, 'utf8'), ctx, { filename: 'PipeRush-stats.gs' });
  const table = name => { const s = ss.getSheetByName(name); if (!s) return null; const head = s.data[0]; return s.data.slice(1).filter(r => r.some(v => v !== '')).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] instanceof RealDate ? new RealDate(r[i].getTime()).toISOString() : r[i] === undefined ? '' : r[i]]))); };
  return { ctx, ss, sheets, table, post: body => ctx.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }), setNow: ms => { nowMs = ms; }, advance: ms => { nowMs += ms; }, get now() { return nowMs; }, clearCache: () => { for (const k in cacheStore) delete cacheStore[k]; } };
}
module.exports = { makeEnv };
