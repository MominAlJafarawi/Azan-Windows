// Prayer engine + resources self-test (runs in build.sh before every build).
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const root = process.argv[2];
const C = require(path.join(root, 'app/calc.js'));
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok: ' : 'FAIL: ') + what); if (!ok) fails++; };
const { execFileSync } = require('child_process');
const cases = [
  ['Europe/Berlin', 52.3759, 9.732, 'mwl', '2026-10-21', '06:03 07:57 13:06 15:42 18:14 20:01'],
  ['Europe/Berlin', 52.3759, 9.732, 'mwl', '2026-06-21', '03:57 04:59 13:23 17:48 21:47 22:49'],
  ['Asia/Riyadh', 21.4225, 39.8262, 'ummAlQura', '2026-10-21', '05:02 06:19 12:05 15:25 17:52 19:22'],
  ['Africa/Cairo', 30.0444, 31.2357, 'egyptian', '2026-10-21', '05:34 07:01 12:40 15:53 18:18 19:36'],
];
for (const [tz, lat, lon, m, day, ref] of cases) {
  const out = execFileSync(process.execPath, ['-e', `
    const C=require(${JSON.stringify(path.join(root, 'app/calc.js'))});
    const [y,mo,d]='${day}'.split('-').map(Number);
    const t=C.compute({lat:${lat},lon:${lon},method:'${m}',school:'shafi',highLat:'seventh',offsets:[0,0,0,0,0,0]},new Date(y,mo-1,d,12));
    console.log(C.PRAYERS.map(p=>t[p].toTimeString().slice(0,5)).join(' '))`], { env: { ...process.env, TZ: tz } }).toString().trim();
  const diff = Math.max(...out.split(' ').map((v, i) => { const a = v.split(':').map(Number), b = ref.split(' ')[i].split(':').map(Number); return Math.abs(a[0] * 60 + a[1] - b[0] * 60 - b[1]); }));
  check(diff <= 1, `times ${tz} ${day} (max diff ${diff} min)`);
}
check(C.methodForCountry('EG') === 'egyptian' && C.methodForCountry('DE') === 'mwl', 'method by country');
const k = C.khatma(30, Date.now() - 2 * 86400000, 0, new Date());
check(k.dayIndex === 3 && k.target === 61 && k.chunk === 5, 'khatma plan');
check(C.surahOnPage(293) === 'الكهف' && C.juzOfPage(582) === 30, 'surah/juz');
check(/هـ$/.test(C.hijri(new Date(), 0, false)), 'hijri');
const res = path.join(root, 'res');
const man = JSON.parse(fs.readFileSync(path.join(res, 'manifest.json'), 'utf8'));
let bad = Object.entries(man).filter(([f, h]) => crypto.createHash('sha256').update(fs.readFileSync(path.join(res, f))).digest('hex') !== h);
check(Object.keys(man).length >= 18 && bad.length === 0, `manifest ${Object.keys(man).length} files verified`);
for (const v of ['makkah', 'makkah_fajr', 'madinah', 'madinah_fajr', 'alafasy', 'alafasy_fajr', 'aqsa', 'abdulbasit']) check(!!man[`sounds/${v}.mp3`], `sound ${v}`);
for (const s of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha', 'iftar']) check(!!man[`speech/${s}.m4a`], `speech ${s}`);
const ad = JSON.parse(fs.readFileSync(path.join(res, 'adhkar.json'), 'utf8'));
check(ad.morning.length > 15 && ad.evening.length > 15 && ad.after.length > 5, 'adhkar');
console.log(fails ? `SELFTEST FAILED (${fails})` : 'SELFTEST PASSED');
process.exit(fails ? 1 : 0);
