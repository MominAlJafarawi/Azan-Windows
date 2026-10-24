// أذان - Windows (Electron). Port of the Mac app: tray, panel, desktop widget, adhan, silent spoken alert,
// khatma, adhkar, Friday, Ramadan, meeting detection, media pause, self-check and repair.
const { app, BrowserWindow, Tray, Menu, ipcMain, screen, shell, nativeImage, net, powerMonitor, powerSaveBlocker } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');
const os = require('os');
const Calc = require('./app/calc.js');
const Quran = require('./app/quran.js');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const TEST = !!process.env.AZAN_DATA;
// On Windows: %APPDATA%\Azan. Anywhere else (testing on the Mac) NEVER the Mac app's folder
// (~/Library/Application Support/Azan), so the Mac settings can't be overwritten.
const DATA = process.env.AZAN_DATA
  || path.join(app.getPath('appData'), process.platform === 'win32' ? 'Azan' : 'Azan-Windows-Dev');
if (process.platform !== 'win32' && path.resolve(DATA) === path.resolve(path.join(app.getPath('appData'), 'Azan'))) {
  throw new Error('refusing to use the Mac app data folder');
}
// Chromium's own files go in a subfolder, never next to settings.json
app.setPath('userData', path.join(DATA, 'electron'));
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
const RES = app.isPackaged ? path.join(process.resourcesPath, 'res') : path.join(__dirname, 'res');
const SPARE = path.join(DATA, 'Spare');
const LOG = path.join(DATA, 'azan.log');
fs.mkdirSync(DATA, { recursive: true });

function log(s) {
  try {
    const line = `${new Date().toISOString()} ${s}\n`;
    if (fs.existsSync(LOG) && fs.statSync(LOG).size > 512000) fs.unlinkSync(LOG);
    fs.appendFileSync(LOG, line);
  } catch (_) {}
}

// ---------------- settings (never overwrite a file that exists but cannot be read) ----------------
const DEFAULTS = {
  autoLocation: true, lat: null, lon: null, placeName: '', countryCode: null,
  autoMethod: true, method: 'mwl', school: 'shafi', highLat: 'auto', offsets: [0, 0, 0, 0, 0, 0],
  hijriOffset: 0, latinDigits: false, use24h: true,
  modes: {}, voice: 'makkah', fajrVoice: 'makkah_fajr', volume: 0.8, preReminder: 10, smartPause: true, meetingSilent: true,
  khatmaOn: true, khatmaDays: 30, khatmaStart: Date.now(), khatmaRead: 0, khatmaCount: 0, khatmaAfterPrayer: true,
  adhkarMorning: true, adhkarEvening: true, adhkarAfterPrayer: true, jumuah: true, khutbahBefore: 30, suhoorBefore: 45,
  launchAtLogin: true, deskOn: true, deskSize: 'medium', deskOnTop: false, deskX: null, deskY: null, deskScale: 1, panelScale: 1, autoUpdateCheck: true,
  speakOn: true, speakRepeats: 2, speakInMeeting: true, speakVolume: 0.6, speakTakbir: true,
  quranPage: 1, quranBookmark: 0,
};
const SETTINGS = path.join(DATA, 'settings.json');
let readOnly = false;

function sanitize(raw) {
  const s = { ...DEFAULTS };
  if (raw && typeof raw === 'object') {
    for (const k of Object.keys(DEFAULTS)) {
      const v = raw[k];
      if (v === undefined) continue;
      const def = DEFAULTS[k];
      if (def === null || typeof v === typeof def || (Array.isArray(def) && Array.isArray(v))) s[k] = v;
    }
  }
  s.deskScale = Math.min(2, Math.max(0.6, Number(s.deskScale) || 1));
  s.panelScale = Math.min(1.5, Math.max(0.8, Number(s.panelScale) || 1));
  s.quranPage = Math.min(Quran.PAGES, Math.max(1, Math.round(Number(s.quranPage) || 1)));
  s.quranBookmark = Math.min(Quran.PAGES, Math.max(0, Math.round(Number(s.quranBookmark) || 0)));
  return s;
}
function loadSettings() {
  if (!fs.existsSync(SETTINGS)) return { ...DEFAULTS };
  try { return sanitize(JSON.parse(fs.readFileSync(SETTINGS, 'utf8'))); } catch (e) {
    const aside = path.join(DATA, `settings.unreadable-${Date.now()}.json`);
    try { fs.copyFileSync(SETTINGS, aside); } catch (_) {}
    readOnly = true;
    log(`settings unreadable, kept as ${path.basename(aside)}`);
    const bdir = path.join(DATA, 'Backups');
    try {
      for (const f of fs.readdirSync(bdir).sort().reverse()) {
        try { const s = sanitize(JSON.parse(fs.readFileSync(path.join(bdir, f), 'utf8'))); log(`restored from ${f}`); return s; } catch (_) {}
      }
    } catch (_) {}
    return { ...DEFAULTS };
  }
}
function saveSettings() {
  if (readOnly) return;
  try { const tmp = SETTINGS + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(S, null, 1)); fs.renameSync(tmp, SETTINGS); } catch (e) { log('save failed ' + e.message); }
}
function dailyBackup() {
  if (!fs.existsSync(SETTINGS)) return;
  const bdir = path.join(DATA, 'Backups');
  fs.mkdirSync(bdir, { recursive: true });
  const name = `settings-${new Date().toISOString().slice(0, 10)}.json`;
  const dest = path.join(bdir, name);
  if (!fs.existsSync(dest)) try { fs.copyFileSync(SETTINGS, dest); } catch (_) {}
  const all = fs.readdirSync(bdir).filter((f) => f.startsWith('settings-')).sort();
  for (const old of all.slice(0, Math.max(0, all.length - 7))) try { fs.unlinkSync(path.join(bdir, old)); } catch (_) {}
}
let S = loadSettings();

// ---------------- self-check and repair ----------------
const VOICES = ['makkah', 'makkah_fajr', 'madinah', 'madinah_fajr', 'alafasy', 'alafasy_fajr', 'aqsa', 'abdulbasit'];
let broken = new Set();
let report = { checked: 0, problems: [], repaired: [], date: Date.now() };
const sha = (f) => { try { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); } catch (_) { return null; } };

function resPath(rel) {
  const inRes = path.join(RES, rel);
  if (!broken.has(rel) && fs.existsSync(inRes)) return inRes;
  const spare = path.join(SPARE, rel);
  return fs.existsSync(spare) ? spare : null;
}

function selfCheck() {
  const r = { checked: 0, problems: [], repaired: [], date: Date.now() };
  let manifest = {};
  try { manifest = JSON.parse(fs.readFileSync(path.join(RES, 'manifest.json'), 'utf8')); } catch (_) {
    try { manifest = JSON.parse(fs.readFileSync(path.join(SPARE, 'manifest.json'), 'utf8')); r.repaired.push('manifest.json'); } catch (_) { r.problems.push('manifest.json'); }
  }
  broken = new Set();
  for (const [rel, hash] of Object.entries(manifest)) {
    r.checked++;
    const inRes = path.join(RES, rel), spare = path.join(SPARE, rel);
    const resOK = sha(inRes) === hash, spareOK = sha(spare) === hash;
    if (resOK) {
      if (!spareOK) { try { fs.mkdirSync(path.dirname(spare), { recursive: true }); fs.copyFileSync(inRes, spare); } catch (_) {} }
      continue;
    }
    if (spareOK) {
      // put the healthy copy back into the install folder; if that is not allowed, use the spare copy directly
      try { fs.mkdirSync(path.dirname(inRes), { recursive: true }); fs.copyFileSync(spare, inRes); } catch (_) { broken.add(rel); }
      r.repaired.push(rel);
    } else { broken.add(rel); r.problems.push(rel); }
  }
  try { fs.mkdirSync(SPARE, { recursive: true }); if (fs.existsSync(path.join(RES, 'manifest.json'))) fs.copyFileSync(path.join(RES, 'manifest.json'), path.join(SPARE, 'manifest.json')); } catch (_) {}

  const avail = VOICES.filter((v) => resPath(`sounds/${v}.mp3`));
  if (avail.length) {
    if (!avail.includes(S.voice)) { S.voice = avail[0]; r.repaired.push('صوت الأذان'); }
    if (!avail.includes(S.fajrVoice)) { S.fajrVoice = avail.find((v) => v.includes('fajr')) || avail[0]; r.repaired.push('صوت الفجر'); }
  }
  if (!TEST && app.isPackaged) {
    const li = app.getLoginItemSettings();
    if (S.launchAtLogin && !li.openAtLogin) { app.setLoginItemSettings({ openAtLogin: true }); r.repaired.push('التشغيل مع ويندوز'); }
  }
  log(`selfcheck: ${r.checked} files, problems=${r.problems.join(',')} repaired=${r.repaired.join(',')}`);
  report = r;
  return r;
}

// ---------------- derived state ----------------
const ramadanNow = () => Calc.isRamadan(new Date(), S.hijriOffset);
const effMethod = () => (S.autoMethod ? Calc.methodForCountry(S.countryCode) : S.method);
function calcInput(ramadan = ramadanNow()) {
  if (S.lat == null || S.lon == null) return null;
  return { lat: S.lat, lon: S.lon, method: effMethod(), school: S.school, highLat: S.highLat, offsets: S.offsets, ramadan };
}
const modeOf = (p) => S.modes[p] || (p === 'sunrise' ? 'off' : 'adhan');

let playing = null;         // prayer key while the adhan plays
let locationStatus = 'idle';
function publicState() {
  return { settings: S, effMethod: effMethod(), methods: Object.fromEntries(Object.entries(Calc.METHODS).map(([k, v]) => [k, v.ar])),
    playing, report, locationStatus, voices: VOICES, now: Date.now(), version: currentVersion(), update: upd };
}
function broadcast() { for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('state', publicState()); }

function update(patch) {
  const before = JSON.stringify(S);
  S = sanitize({ ...S, ...patch });
  if (JSON.stringify(S) === before) return;
  saveSettings();
  if ('launchAtLogin' in patch && !TEST && app.isPackaged) app.setLoginItemSettings({ openAtLogin: !!S.launchAtLogin });
  if ('deskOn' in patch || 'deskSize' in patch || 'deskOnTop' in patch || 'deskScale' in patch) applyDesk();
  if ('panelScale' in patch && panel && panel.isVisible()) placePanel(panelHeight, true);
  if ('autoLocation' in patch && S.autoLocation) autoLocate();
  broadcast();
}

// ---------------- location (IP based, plus city search) ----------------
async function getJSON(url) {
  const r = await net.fetch(url, { headers: { 'Accept-Language': 'ar' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
async function autoLocate() {
  if (!S.autoLocation) return;
  locationStatus = 'locating'; broadcast();
  try {
    let j = await getJSON('https://ipwho.is/?lang=ar');
    if (!j || j.success === false) j = null;
    let lat, lon, city, cc;
    if (j) { lat = j.latitude; lon = j.longitude; city = j.city; cc = j.country_code; } else {
      const k = await getJSON('https://ipapi.co/json/');
      lat = k.latitude; lon = k.longitude; city = k.city; cc = k.country_code;
    }
    if (typeof lat !== 'number') throw new Error('no position');
    const near = S.lat != null && Math.abs(S.lat - lat) < 0.05 && Math.abs(S.lon - lon) < 0.05;
    if (!near || !S.placeName) update({ lat: Math.round(lat * 1e4) / 1e4, lon: Math.round(lon * 1e4) / 1e4, placeName: city || S.placeName, countryCode: cc || S.countryCode });
    locationStatus = 'ok';
    log(`location: ${city} ${cc}`);
  } catch (e) { locationStatus = S.lat == null ? 'failed' : 'ok'; log('location failed ' + e.message); }
  broadcast();
}
async function searchCity(q) {
  const j = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?count=8&language=ar&name=${encodeURIComponent(q)}`);
  return (j.results || []).map((r) => ({ name: [r.name, r.country].filter(Boolean).join('، '), city: r.name, cc: r.country_code, lat: r.latitude, lon: r.longitude }));
}

// ---------------- meeting (microphone in use) and media pause ----------------
function micInUse() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve(!!process.env.AZAN_MEETING);
    execFile('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone', '/s', '/v', 'LastUsedTimeStop'],
      { windowsHide: true, timeout: 4000 }, (err, out) => {
        if (err || !out) return resolve(false);
        resolve(/LastUsedTimeStop\s+REG_QWORD\s+0x0\s*$/m.test(out));
      });
  });
}
const PS_MEDIA = (action, ids) => `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
function Await($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime] | Out-Null
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$ids = @(${(ids || []).map((i) => `'${String(i).replace(/'/g, '')}'`).join(',')})
foreach ($s in $mgr.GetSessions()) {
  ${action === 'pause'
    ? "if ($s.GetPlaybackInfo().PlaybackStatus -eq 'Playing') { Await ($s.TryPauseAsync()) ([bool]) | Out-Null; Write-Output $s.SourceAppUserModelId }"
    : "if ($ids -contains $s.SourceAppUserModelId) { Await ($s.TryPlayAsync()) ([bool]) | Out-Null }"}
}`;
function runPS(script) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve('');
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true, timeout: 8000 },
      (err, out) => { if (err) log('powershell: ' + err.message); resolve(out || ''); });
  });
}
let pausedMedia = [];
async function pauseMedia() { pausedMedia = (await runPS(PS_MEDIA('pause'))).split(/\r?\n/).map((s) => s.trim()).filter(Boolean); if (pausedMedia.length) log('paused ' + pausedMedia.join(',')); }
async function resumeMedia() { if (!pausedMedia.length) return; const ids = pausedMedia; pausedMedia = []; await runPS(PS_MEDIA('play', ids)); }

// ---------------- audio (hidden window) ----------------
let audioWin = null;
const audio = (cmd) => { if (audioWin && !audioWin.isDestroyed()) audioWin.webContents.send('audio', cmd); };
const TAKBIR_END = { makkah: 14.4, makkah_fajr: 10.9, madinah: 9.8, madinah_fajr: 14.4, alafasy: 15.6, alafasy_fajr: 17.9, aqsa: 10.7, abdulbasit: 10.3 };
const fileUrl = (p) => (p ? 'file:///' + p.replace(/\\/g, '/').replace(/^\//, '') : null);

async function startAdhan(p) {
  if (S.smartPause) await pauseMedia();
  playing = p;
  audio({ type: 'adhan', src: fileUrl(resPath(`sounds/${p === 'fajr' ? S.fajrVoice : S.voice}.mp3`)), volume: S.volume });
  updateTray(); broadcast();
}
function stopAdhan() { audio({ type: 'stop' }); if (playing) adhanEnded(); }
function adhanEnded() {
  playing = null;
  resumeMedia();
  updateTray(); broadcast();
  if (cardKind === 'adhan') setTimeout(() => closeCard(), 30000);
}
function announce(p) {
  const key = p === 'maghrib' && ramadanNow() ? 'iftar' : p;
  const voice = S.speakTakbir ? (p === 'fajr' ? S.fajrVoice : S.voice) : null;
  audio({ type: 'announce', takbir: voice ? fileUrl(resPath(`sounds/${voice}.mp3`)) : null, takbirEnd: voice ? TAKBIR_END[voice] || 8 : 0,
    speech: fileUrl(resPath(`speech/${key}.m4a`)), times: S.speakRepeats, volume: S.speakVolume });
}

// ---------------- updates (GitHub releases) ----------------
const UPDATE_REPO = 'MominAlJafarawi/Azan-Windows';
const currentVersion = () => process.env.AZAN_FAKE_VERSION || app.getVersion();
let upd = { available: null, checking: false, lastCheck: null, progress: null, error: null };
function isNewer(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const x = pa[i] || 0, y = pb[i] || 0; if (x !== y) return x > y; }
  return false;
}
function readState() { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (_) { return {}; } }
function writeState(patch) { try { fs.writeFileSync(STATE, JSON.stringify({ ...readState(), ...patch })); } catch (_) {} }
async function checkUpdate(force) {
  const st = readState();
  if (!force && st.updateLastCheck && Date.now() - st.updateLastCheck < 20 * 3600e3) return;
  upd.checking = true; upd.error = null; broadcast();
  try {
    const r = await net.fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const v = String(j.tag_name || '').replace(/^v/i, '');
    const exe = (j.assets || []).find((a) => /^Azan-Setup-.*\.exe$/.test(a.name));
    log(`update check: latest ${v}, current ${currentVersion()}`);
    upd.available = isNewer(v, currentVersion()) && exe ? { version: v, notes: j.body || '', url: exe.browser_download_url, size: exe.size, page: j.html_url } : null;
    upd.lastCheck = Date.now(); writeState({ updateLastCheck: upd.lastCheck });
    if (upd.available && (force || st.updateSnoozed !== v)) showCard({ kind: 'update', time: new Date() }, false);
  } catch (e) { upd.error = 'ما قدرت أوصل لـGitHub: ' + e.message; log('update check failed ' + e.message); }
  upd.checking = false; broadcast();
}
async function installUpdate() {
  const u = upd.available; if (!u || upd.progress != null) return;
  upd.progress = 0; upd.error = null; broadcast();
  try {
    const file = path.join(os.tmpdir(), `Azan-Setup-${u.version}.exe`);
    const r = await net.fetch(u.url);
    if (!r.ok || !r.body) throw new Error('HTTP ' + r.status);
    const total = Number(r.headers.get('content-length')) || u.size || 1;
    const out = fs.createWriteStream(file);
    const reader = r.body.getReader(); let got = 0, last = 0;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      out.write(Buffer.from(value)); got += value.length;
      if (Date.now() - last > 300) { last = Date.now(); upd.progress = got / total; broadcast(); }
    }
    await new Promise((res) => out.end(res));
    if (got < 1e6 || (u.size && got !== u.size)) throw new Error('الملف ناقص');
    upd.progress = 1; broadcast();
    if (process.env.AZAN_UPDATE_DRYRUN) { log(`update dry run ok: ${file} ${got} bytes`); upd.progress = null; upd.error = `تجربة: التحديث جاهز (${u.version})`; broadcast(); return; }
    log(`update: installing ${u.version}`);
    // silent install over the current one, then start the app again; settings in %APPDATA% stay
    spawn(file, ['/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref();
    setTimeout(() => { app.isQuitting = true; app.quit(); }, 500);
  } catch (e) { upd.progress = null; upd.error = 'فشل التحديث: ' + e.message; log('update failed ' + e.message); broadcast(); }
}

// ---------------- events ----------------
const STATE = path.join(DATA, 'state.json');
let fired = new Set();
try { fired = new Set(JSON.parse(fs.readFileSync(STATE, 'utf8')).fired || []); } catch (_) {}
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

function events(around) {
  const inp = calcInput();
  if (!inp) return [];
  const out = [];
  for (const off of [-1, 0, 1]) {
    const d = new Date(around.getTime() + off * 86400000);
    const ram = Calc.isRamadan(d, S.hijriOffset);
    const t = Calc.compute({ ...inp, ramadan: ram }, d);
    for (const p of Calc.PRAYERS) {
      const pt = t[p]; if (!pt) continue;
      const mode = modeOf(p);
      if (mode !== 'off') out.push({ kind: 'adhan', p, time: pt, window: 120e3 });
      if (p !== 'sunrise' && mode !== 'off' && S.preReminder > 0) out.push({ kind: 'pre', p, time: new Date(pt - S.preReminder * 60e3), window: 120e3 });
      if (p !== 'sunrise' && (S.adhkarAfterPrayer || (S.khatmaOn && S.khatmaAfterPrayer))) out.push({ kind: 'after', p, time: new Date(+pt + 20 * 60e3), window: 30 * 60e3 });
    }
    if (S.adhkarMorning && t.sunrise && t.dhuhr) out.push({ kind: 'morningAdhkar', time: new Date(+t.sunrise + 15 * 60e3), window: t.dhuhr - t.sunrise - 20 * 60e3 });
    if (S.adhkarEvening && t.asr && t.maghrib) out.push({ kind: 'eveningAdhkar', time: new Date(+t.asr + 30 * 60e3), window: Math.max(600e3, t.maghrib - t.asr - 30 * 60e3) });
    if (S.jumuah && d.getDay() === 5) {
      const k = new Date(d); k.setHours(10, 0, 0, 0);
      out.push({ kind: 'kahf', time: k, window: 5 * 3600e3 });
      if (t.dhuhr) out.push({ kind: 'khutbah', p: 'dhuhr', time: new Date(t.dhuhr - S.khutbahBefore * 60e3), window: 600e3 });
    }
    if (ram && t.fajr) out.push({ kind: 'suhoor', p: 'fajr', time: new Date(t.fajr - S.suhoorBefore * 60e3), window: 600e3 });
  }
  return out.map((e) => ({ ...e, key: `${dayKey(e.time)}|${e.kind}|${e.p || ''}` }));
}

function markPast() {
  const n = Date.now();
  for (const e of events(new Date())) {
    if (e.time > n) continue;
    if (['morningAdhkar', 'eveningAdhkar', 'kahf'].includes(e.kind) && n - e.time < e.window && !fired.has(e.key)) continue;
    fired.add(e.key);
  }
}
function saveFired() { try { fs.writeFileSync(STATE, JSON.stringify({ fired: [...fired].slice(-200) })); } catch (_) {} }

async function fire(e) {
  log(`event ${e.kind} ${e.p || ''}`);
  if (e.kind === 'adhan') {
    const meeting = S.meetingSilent && (await micInUse());
    const mode = modeOf(e.p);
    if (mode === 'adhan' && !meeting) await startAdhan(e.p);
    else if (mode !== 'off' && S.speakOn && (!meeting || S.speakInMeeting)) announce(e.p);
    showCard(e, meeting && mode === 'adhan');
    return;
  }
  showCard(e, false);
}

// keep the PC from falling asleep on its own from 10 minutes before an adhan until it is over
let awakeId = null;
function holdAwake(list, n) {
  const need = !!playing || list.some((e) => e.kind === 'adhan' && +n >= +e.time - 600e3 && +n <= +e.time + 180e3);
  if (need && awakeId == null) { awakeId = powerSaveBlocker.start('prevent-app-suspension'); log('sleep held for adhan'); }
  else if (!need && awakeId != null) { powerSaveBlocker.stop(awakeId); awakeId = null; log('sleep allowed again'); }
}

let lastDay = '', lastTick = null;
function tick() {
  const n = new Date();
  const list = events(n);
  const prev = lastTick; lastTick = n;
  let missed = null;
  for (const e of list) {
    if (e.time > n || fired.has(e.key)) continue;
    fired.add(e.key); saveFired();
    if (n - e.time > e.window) {
      // the PC slept through the adhan (no tick at adhan time): say so quietly if the prayer time is still running
      if (e.kind === 'adhan' && prev && prev < e.time) { const until = Calc.missedUntil(calcInput(), e.p, e.time, n); if (until) missed = { kind: 'missed', p: e.p, time: e.time, until }; }
      continue;
    }
    fire(e);
  }
  if (missed) fire(missed);
  holdAwake(list, n);
  const dk = dayKey(n);
  if (dk !== lastDay) { lastDay = dk; dailyBackup(); }
  updateTray();
  broadcast();
}

// ---------------- windows ----------------
const APP = path.join(__dirname, 'app');
const PRELOAD = path.join(__dirname, 'preload.js');
const base = (extra) => ({ frame: false, transparent: true, resizable: false, show: false, backgroundColor: '#00000000', hasShadow: true,
  webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: false }, ...extra });

let tray = null, panel = null, panelPinned = false, panelPlacing = false;
let desk = null, card = null, cardKind = null, mainWin = null;

function trayIcon() {
  const p = path.join(APP, 'img', 'tray.png');
  const img = nativeImage.createFromPath(p);
  return img.isEmpty() ? nativeImage.createEmpty() : img.resize({ width: 16, height: 16 });
}
function updateTray() {
  if (!tray) return;
  const inp = calcInput();
  let tip = 'أذان';
  if (playing) tip = `أذان ${Calc.AR[playing]} شغّال · اكبس لإيقافه`;
  else if (inp) { const n = Calc.next(inp, new Date()); tip = `${Calc.AR[n.p]} ${Calc.countdown((n.t - Date.now()) / 1000, S.latinDigits)} · ${Calc.time(n.t, S.latinDigits, S.use24h)}`; }
  tray.setToolTip(tip);
}
function trayMenu() {
  return Menu.buildFromTemplate([
    { label: 'فتح أذان', click: () => showPanel() },
    { label: 'إيقاف الأذان', enabled: !!playing, click: () => stopAdhan() },
    { type: 'separator' },
    { label: 'النافذة الرئيسية', click: () => openMain({ tab: 'home' }) },
    { label: 'المصحف', click: () => openMain({ tab: 'quran' }) },
    { label: 'أذكار الصباح', click: () => openMain({ tab: 'adhkar', kind: 'morning', fresh: true }) },
    { label: 'أذكار المساء', click: () => openMain({ tab: 'adhkar', kind: 'evening', fresh: true }) },
    { label: 'الإعدادات', click: () => openMain({ tab: 'settings' }) },
    { label: S.deskOn ? 'إخفاء الويدجت' : 'إظهار الويدجت', click: () => update({ deskOn: !S.deskOn }) },
    { type: 'separator' },
    { label: 'إنهاء', click: () => { app.isQuitting = true; app.quit(); } },
  ]);
}

function placePanel(h, keepTop) {
  const sc = S.panelScale;
  if (keepTop && panel) {
    // resize in place: keep the top edge and the centre
    const b = panel.getBounds(), wa = screen.getDisplayMatching(b).workArea;
    const W = Math.round(400 * sc), H = Math.round(Math.min(h * sc, wa.height - 24));
    let x = Math.round(b.x + b.width / 2 - W / 2);
    x = Math.min(Math.max(x, wa.x + 12), wa.x + wa.width - W - 12);
    panelPlacing = true; panel.setBounds({ x, y: b.y, width: W, height: H });
    setTimeout(() => { panelPlacing = false; }, 300);
    return;
  }
  const tb = tray ? tray.getBounds() : null;
  const pt = tb && tb.width ? { x: tb.x + tb.width / 2, y: tb.y } : screen.getCursorScreenPoint();
  const wa = screen.getDisplayNearestPoint(pt).workArea;
  const W = Math.round(400 * sc), H = Math.round(Math.min(h * sc, wa.height - 24));
  let x = Math.round(pt.x - W / 2);
  x = Math.min(Math.max(x, wa.x + 12), wa.x + wa.width - W - 12);
  const taskbarTop = pt.y > wa.y + wa.height / 2;
  const y = taskbarTop ? wa.y + wa.height - H - 12 : wa.y + 12;
  panelPlacing = true;
  panel.setBounds({ x, y, width: W, height: H });
  setTimeout(() => { panelPlacing = false; }, 300);
}
function showPanel() {
  if (playing) { /* the panel shows the big stop banner */ }
  if (!panel) {
    panel = new BrowserWindow(base({ width: 400, height: 700, skipTaskbar: true, alwaysOnTop: true }));
    panel.loadFile(path.join(APP, 'panel.html'));
    panel.on('blur', () => { if (!panelPinned && !process.env.AZAN_PIN && !process.env.AZAN_WINTEST && panel && panel.isVisible()) panel.hide(); });
    panel.on('move', () => { if (!panelPlacing && panel.isVisible()) panelPinned = true; });
    panel.webContents.once('did-finish-load', () => { panelPinned = false; placePanel(panelHeight); panel.show(); panel.focus(); });
    return;
  }
  if (panel.isVisible()) { hidePanel(); return; }
  panelPinned = false;
  placePanel(panelHeight);
  panel.show(); panel.focus();
  panel.webContents.send('shown');
}
function hidePanel() { if (panel && !panel.isDestroyed()) { panel.hide(); panelPinned = false; } }
let panelHeight = 860;

const DESK = { small: [230, 230], medium: [470, 240], large: [470, 480] };
function applyDesk() {
  if (!S.deskOn) { if (desk) { desk.destroy(); desk = null; } return; }
  const [bw, bh] = DESK[S.deskSize] || DESK.medium;
  const w = Math.round(bw * S.deskScale), h = Math.round(bh * S.deskScale);
  if (!desk) {
    const wa = screen.getPrimaryDisplay().workArea;
    const x = S.deskX ?? wa.x + wa.width - w - 30, y = S.deskY ?? wa.y + 30;
    desk = new BrowserWindow(base({ width: w, height: h, x, y, skipTaskbar: true, focusable: false, alwaysOnTop: S.deskOnTop }));
    desk.loadFile(path.join(APP, 'widget.html'));
    desk.once('ready-to-show', () => desk.showInactive());
    desk.on('closed', () => { desk = null; });
    // keep it on a visible screen
    const vis = screen.getAllDisplays().some((d) => x < d.bounds.x + d.bounds.width && x + w > d.bounds.x && y < d.bounds.y + d.bounds.height && y + h > d.bounds.y);
    if (!vis) desk.setPosition(wa.x + 30, wa.y + 30);
  } else {
    desk.setSize(w, h);
    desk.setAlwaysOnTop(!!S.deskOnTop);
  }
}

function showCard(e, meeting) {
  closeCard(true);
  cardKind = e.kind;
  const wa = screen.getPrimaryDisplay().workArea;
  const W = 400, H = 260;
  card = new BrowserWindow(base({ width: W, height: H, x: wa.x + wa.width - W - 12, y: wa.y + wa.height - H - 12, skipTaskbar: true, focusable: false, alwaysOnTop: true }));
  card.setAlwaysOnTop(true, 'pop-up-menu');
  card.loadFile(path.join(APP, 'card.html'), { query: { e: JSON.stringify({ kind: e.kind, p: e.p || null, time: +e.time, until: e.until ? +e.until : null, meeting }) } });
  card.once('ready-to-show', () => card && card.showInactive());
  const auto = e.kind === 'update' ? null : e.kind === 'adhan' ? (playing ? null : 120e3) : (e.kind === 'pre' || e.kind === 'khutbah') ? 45e3 : e.kind === 'after' ? 20 * 60e3 : 10 * 60e3;
  if (auto) setTimeout(() => { if (cardKind === e.kind) closeCard(); }, auto);
}
function closeCard() { if (card && !card.isDestroyed()) card.destroy(); card = null; cardKind = null; }

// One main window (tabs: home, adhkar, mushaf, settings). Every "open …" from the panel, the cards,
// the tray or the widget shows this window on the right tab; p = {tab, kind, page, index, sub, fresh}.
function openMain(p = { tab: 'home' }) {
  hidePanel();
  if (mainWin && !mainWin.isDestroyed()) {
    if (mainWin.isMinimized()) mainWin.restore();
    mainWin.webContents.send('nav', p);
    mainWin.show(); mainWin.focus();
    return mainWin;
  }
  const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const W = Math.min(680, wa.width - 40), H = Math.min(780, wa.height - 40);
  mainWin = new BrowserWindow(base({ width: W, height: H, x: Math.round(wa.x + (wa.width - W) / 2), y: Math.round(wa.y + (wa.height - H) / 2),
    title: 'أذان', transparent: false, backgroundColor: '#0b1030', resizable: true, minimizable: true, maximizable: true,
    minWidth: Math.min(560, W), minHeight: Math.min(600, H) }));
  mainWin.loadFile(path.join(APP, 'main.html'), { query: { nav: JSON.stringify(p) } });
  mainWin.once('ready-to-show', () => { if (mainWin) { mainWin.show(); mainWin.focus(); } });
  mainWin.on('closed', () => { mainWin = null; });
  return mainWin;
}

// ---------------- Quran (Tanzil text, shipped verbatim in res/quran) ----------------
let quranCache = null;
function quranData() {
  if (quranCache) return quranCache;
  const t = resPath('quran/quran-uthmani.txt'), m = resPath('quran/quran-meta.json');
  if (!t || !m) return null;
  try { quranCache = { text: fs.readFileSync(t, 'utf8'), meta: JSON.parse(fs.readFileSync(m, 'utf8')) }; } catch (e) { log('quran read failed ' + e.message); return null; }
  return quranCache;
}
let mushafWait = null;

// ---------------- IPC ----------------
ipcMain.handle('state', () => publicState());
ipcMain.handle('quran:data', () => quranData());
ipcMain.handle('adhkar:data', () => { try { return JSON.parse(fs.readFileSync(resPath('adhkar.json'), 'utf8')); } catch (_) { return null; } });
ipcMain.handle('res:url', (_e, rel) => fileUrl(resPath(rel)));
ipcMain.handle('settings:set', (_e, patch) => { update(patch || {}); return publicState(); });
ipcMain.handle('location:search', async (_e, q) => { try { return await searchCity(q); } catch (e) { return { error: e.message }; } });
ipcMain.handle('location:auto', () => { autoLocate(); return true; });
ipcMain.handle('check:run', () => { selfCheck(); broadcast(); return report; });
ipcMain.on('adhan:stop', () => stopAdhan());
ipcMain.on('adhan:test', () => { const inp = calcInput(); const p = inp ? Calc.next(inp, new Date(), false).p : 'maghrib'; startAdhan(p); showCard({ kind: 'adhan', p, time: new Date() }, false); });
ipcMain.on('announce:test', () => { const inp = calcInput(); announce(inp ? Calc.next(inp, new Date(), false).p : 'fajr'); });
ipcMain.on('voice:preview', (_e, id) => audio({ type: 'preview', src: fileUrl(resPath(`sounds/${id}.mp3`)), volume: S.volume }));
ipcMain.on('audio:ended', (_e, what) => { if (what === 'adhan' && playing) adhanEnded(); });
ipcMain.on('khatma:read', (_e, page) => { const read = Math.min(Calc.PAGES, Math.max(S.khatmaRead, page)); update({ khatmaRead: read, khatmaCount: S.khatmaCount + (read >= Calc.PAGES && S.khatmaRead < Calc.PAGES ? 1 : 0) }); });
ipcMain.on('khatma:new', (_e, days) => update({ khatmaDays: days || S.khatmaDays, khatmaStart: Date.now(), khatmaRead: 0 }));
ipcMain.on('open:url', (_e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });
ipcMain.on('open:main', (_e, p) => openMain(p && typeof p === 'object' ? p : { tab: 'home' }));
ipcMain.on('open:settings', (_e, sub) => openMain({ tab: 'settings', sub }));
ipcMain.on('open:adhkar', (_e, kind) => openMain({ tab: 'adhkar', kind, fresh: true }));
ipcMain.on('mushaf:rendered', (_e, r) => { if (mushafWait) { const f = mushafWait; mushafWait = null; f(r); } });
ipcMain.on('panel:close', () => hidePanel());
// the panel reports its natural (unscaled) height; the window is that times panelScale
ipcMain.on('panel:height', (_e, h) => { panelHeight = Math.ceil(h); if (panel && panel.isVisible() && !panelPinned) placePanel(panelHeight); else if (panel) placePanel(panelHeight, true); });
// edge drag on the panel or the widget: everything scales together
let dragStart = null;
ipcMain.on('resize:drag', (e, { factor, done, fromLeft }) => {
  const w = BrowserWindow.fromWebContents(e.sender); if (!w) return;
  const isDesk = w === desk;
  const b = w.getBounds();
  if (!dragStart) dragStart = { scale: isDesk ? S.deskScale : S.panelScale, x: b.x, right: b.x + b.width, y: b.y };
  const [lo, hi] = isDesk ? [0.6, 2] : [0.8, 1.5];
  const sc = Math.min(hi, Math.max(lo, dragStart.scale * factor));
  let W, H;
  if (isDesk) { const [bw, bh] = DESK[S.deskSize] || DESK.medium; W = Math.round(bw * sc); H = Math.round(bh * sc); }
  else { W = Math.round(400 * sc); H = Math.round(Math.min(panelHeight * sc, screen.getDisplayMatching(b).workArea.height - 24)); panelPlacing = true; }
  w.setBounds({ x: fromLeft ? dragStart.right - W : dragStart.x, y: dragStart.y, width: W, height: H });
  w.webContents.send('zoom', sc);
  if (done) {
    dragStart = null;
    const r = Math.round(sc * 100) / 100;
    if (isDesk) { const [x, y] = desk.getPosition(); S.deskX = x; S.deskY = y; update({ deskScale: r }); }
    else { panelPinned = true; setTimeout(() => { panelPlacing = false; }, 300); update({ panelScale: r }); }
  }
});
ipcMain.on('card:close', () => closeCard());
ipcMain.on('update:install', () => installUpdate());
ipcMain.on('update:snooze', () => { if (upd.available) writeState({ updateSnoozed: upd.available.version }); closeCard(); });
ipcMain.handle('update:check', () => checkUpdate(true));
ipcMain.on('win:close', (e) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.close(); });
ipcMain.on('win:min', (e) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.minimize(); });
ipcMain.on('desk:moveBy', (_e, dx, dy) => { if (!desk) return; const [x, y] = desk.getPosition(); desk.setPosition(Math.round(x + dx), Math.round(y + dy)); });
ipcMain.on('desk:moved', () => { if (!desk) return; const [x, y] = desk.getPosition(); S.deskX = x; S.deskY = y; saveSettings(); });
ipcMain.on('desk:click', () => { if (playing) stopAdhan(); else showPanel(); });
ipcMain.on('desk:menu', () => {
  if (!desk) return;
  Menu.buildFromTemplate([
    ...['small', 'medium', 'large'].map((s) => ({ label: `الحجم: ${{ small: 'صغير', medium: 'متوسط', large: 'كبير' }[s]}`, type: 'radio', checked: S.deskSize === s, click: () => update({ deskSize: s }) })),
    { type: 'separator' },
    { label: 'تكبير', click: () => update({ deskScale: Math.min(2, Math.round((S.deskScale + 0.1) * 10) / 10) }) },
    { label: 'تصغير', click: () => update({ deskScale: Math.max(0.6, Math.round((S.deskScale - 0.1) * 10) / 10) }) },
    { label: 'الحجم الأصلي', click: () => update({ deskScale: 1 }) },
    { type: 'separator' },
    { label: S.use24h ? 'الساعة: ٢٤ (اكبس لـ١٢)' : 'الساعة: ١٢ (اكبس لـ٢٤)', click: () => update({ use24h: !S.use24h }) },
    { type: 'separator' },
    { label: 'فوق كل النوافذ', type: 'checkbox', checked: !!S.deskOnTop, click: () => update({ deskOnTop: !S.deskOnTop }) },
    { label: 'الإعدادات…', click: () => openMain({ tab: 'settings' }) },
    { label: 'إخفاء الويدجت', click: () => update({ deskOn: false }) },
  ]).popup({ window: desk });
});

// ---------------- start ----------------
app.on('second-instance', () => showPanel());
app.on('window-all-closed', (e) => { /* keep running in the tray */ });
app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('com.momen.azan.win');
  selfCheck();
  saveSettings();
  audioWin = new BrowserWindow({ show: false, webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: false } });
  audioWin.loadFile(path.join(APP, 'audio.html'));
  tray = new Tray(trayIcon());
  tray.on('click', () => showPanel());
  tray.on('right-click', () => tray.popUpContextMenu(trayMenu()));
  if (S.autoLocation || S.lat == null) autoLocate();
  markPast();
  applyDesk();
  updateTray();
  setInterval(tick, 5000);
  powerMonitor.on('resume', () => setTimeout(tick, 1500));
  setInterval(() => { if (S.autoLocation) autoLocate(); }, 3 * 3600e3);
  setTimeout(() => { if (S.autoUpdateCheck && !TEST) checkUpdate(false); }, 30000);
  setInterval(() => { if (S.autoUpdateCheck && !TEST) checkUpdate(false); }, 6 * 3600e3);
  log(`started ${app.getVersion()}`);
  // automatic test on a real Windows machine (GitHub Actions): logs results, then quits
  if (process.env.AZAN_WINTEST) setTimeout(async () => {
    const lines = [];
    lines.push(`wintest: platform=${process.platform} version=${app.getVersion()} packaged=${app.isPackaged}`);
    lines.push(`wintest: selfcheck checked=${report.checked} problems=${report.problems.join(',') || 'none'} repaired=${report.repaired.join(',') || 'none'}`);
    lines.push(`wintest: tray=${!!tray} desk=${!!desk} audioWin=${!!audioWin}`);
    try { const id = powerSaveBlocker.start('prevent-app-suspension'); lines.push(`wintest: sleep_hold=${powerSaveBlocker.isStarted(id)}`); powerSaveBlocker.stop(id); } catch (e) { lines.push('wintest: sleep_hold_error ' + e.message); }
    try { lines.push(`wintest: mic_in_use=${await micInUse()}`); } catch (e) { lines.push('wintest: mic_error ' + e.message); }
    try { const out = await runPS(PS_MEDIA('pause')); lines.push(`wintest: media_script_ok paused=[${out.trim()}]`); } catch (e) { lines.push('wintest: media_error ' + e.message); }
    const inp = calcInput();
    if (inp) { const t = Calc.compute(inp, new Date()); lines.push('wintest: times ' + Calc.PRAYERS.map((p) => `${p}=${t[p] ? t[p].toISOString().slice(11, 16) : '-'}`).join(' ')); }
    try {
      const d = quranData(), Q = d && Quran.build(d.text, d.meta);
      lines.push(Q ? `wintest: quran pages=${Q.pageStart.length} verses=${Q.verses.length} suras=${d.meta.suras.length} p293=${Quran.pageVerses(Q, 293).length}` : 'wintest: quran MISSING');
      const r = await new Promise((res) => { mushafWait = res; openMain({ tab: 'quran', page: 1 }); setTimeout(() => res(null), 10000); });
      lines.push(r ? `wintest: mushaf page=${r.page} verses=${r.verses}` : 'wintest: mushaf not rendered');
    } catch (e) { lines.push('wintest: quran_error ' + e.message); }
    for (const rel of ['sounds/makkah.mp3', 'speech/fajr.m4a', 'adhkar.json', 'quran/quran-uthmani.txt', 'quran/quran-meta.json']) lines.push(`wintest: res ${rel} -> ${resPath(rel) ? 'ok' : 'MISSING'}`);
    if (process.env.AZAN_FAKE_VERSION) {
      await checkUpdate(true);
      lines.push(`wintest: update available=${upd.available ? upd.available.version : 'none'} error=${upd.error || 'none'}`);
      if (upd.available) { await installUpdate(); lines.push(`wintest: update ${upd.error && upd.error.startsWith('تجربة') ? 'dry run ok' : 'result ' + upd.error}`); }
    }
    lines.forEach(log);
    if (process.env.AZAN_WINTEST === 'show') { showPanel(); setTimeout(() => { log('wintest: done'); app.exit(0); }, 12000); }
    else { log('wintest: done'); app.exit(0); }
  }, 6000);
  const show = process.env.AZAN_SHOW;
  if (TEST && show) setTimeout(() => {
    if (show === 'panel') showPanel();
    else if (show === 'settings') openMain({ tab: 'settings', sub: process.env.AZAN_SUB });
    else if (show === 'adhkar') openMain({ tab: 'adhkar', kind: process.env.AZAN_SUB || 'morning', fresh: true });
    else if (show === 'quran') openMain({ tab: 'quran', page: Number(process.env.AZAN_PAGE) || undefined });
    else if (show.startsWith('main:')) {
      // main:<tab>[:<arg>]  e.g. main:quran:293, main:quran:index, main:adhkar:evening, main:settings:gen
      const [, tab, arg] = show.split(':');
      openMain(tab === 'quran' ? (arg === 'index' ? { tab, index: true } : { tab, page: Number(arg) || undefined })
        : tab === 'adhkar' ? { tab, kind: arg || 'morning', fresh: true } : tab === 'settings' ? { tab, sub: arg } : { tab: tab || 'home' });
    }
    else if (show.startsWith('card:')) { const k = show.slice(5), miss = k === 'missed'; showCard({ kind: k, p: process.env.AZAN_PRAYER || 'maghrib', time: new Date(Date.now() - (miss ? 1500e3 : 0)), until: miss ? new Date(Date.now() + 3600e3) : null }, !!process.env.AZAN_MEETING); }
    else if (show === 'playing') { startAdhan('maghrib'); setTimeout(showPanel, 600); }
    else if (show === 'announce') announce('fajr');
  }, 1500);
});
