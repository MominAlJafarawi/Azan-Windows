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
{ // missed-adhan card after sleep (Cairo)
  const inp = { lat: 30.0444, lon: 31.2357, method: 'egyptian', school: 'shafi', highLat: 'seventh', offsets: [0, 0, 0, 0, 0, 0] };
  const t = C.compute(inp, new Date());
  check(+C.missedUntil(inp, 'asr', t.asr, new Date(+t.asr + 1800e3)) === +t.maghrib, 'missed asr card while asr time runs');
  check(C.missedUntil(inp, 'asr', t.asr, new Date(+t.maghrib + 60e3)) === null, 'no missed card after asr time ended');
  check(+C.missedUntil(inp, 'fajr', t.fajr, new Date(+t.fajr + 600e3)) === +t.sunrise, 'missed fajr ends at sunrise');
  check(C.missedUntil(inp, 'sunrise', t.sunrise, new Date(+t.sunrise + 600e3)) === null, 'no missed card for sunrise');
}
check(C.methodForCountry('EG') === 'egyptian' && C.methodForCountry('DE') === 'mwl', 'method by country');
const k = C.khatma(30, Date.now() - 2 * 86400000, 0, new Date());
check(k.dayIndex === 3 && k.target === 61 && k.chunk === 5, 'khatma plan');
{ // khatma with a base (after "رتّب الختمة من جديد") and base 0 = the old numbers
  const D = 86400000, now = new Date();
  const old = (days, start, read) => { const perDay = 604 / days, s = new Date(start), n = new Date(now); s.setHours(0, 0, 0, 0); n.setHours(0, 0, 0, 0);
    const di = Math.max(1, Math.round((n - s) / D) + 1), target = Math.min(604, Math.ceil(perDay * di)); return { target, chunk: Math.max(1, Math.ceil(perDay / 5)), behind: Math.max(0, target - read) }; };
  let same = true;
  for (const days of [7, 10, 30, 40, 365]) for (const ago of [0, 1, 5, 12, 40]) for (const read of [0, 17, 300, 603]) {
    const a = C.khatma(days, Date.now() - ago * D, read, now), b = old(days, Date.now() - ago * D, read), z = C.khatma(days, Date.now() - ago * D, read, now, 0);
    if (a.target !== b.target || a.chunk !== b.chunk || a.behind !== b.behind || z.target !== a.target || z.behind !== a.behind) same = false;
  }
  check(same, 'khatma base 0 = old plan (target, chunk, behind)');
  const t1 = C.khatma(20, Date.now(), 404, now, 404);
  check(t1.perDay === 10 && t1.dayIndex === 1 && t1.target === 414 && t1.chunk === 2 && t1.portion[0] === 405 && t1.portion[1] === 406 && t1.behind === 10 && !t1.replan, 'khatma base 404: day 1 target 414, portion 405-406, behind 10');
  const t3 = C.khatma(20, Date.now() - 2 * D, 404, now, 404);
  check(t3.target === 434 && t3.behind === 30 && t3.replan, 'khatma base 404: day 3 target 434, behind 30 -> offer re-plan');
  const t4 = C.khatma(20, Date.now() - 30 * D, 410, now, 404);
  check(t4.target === 604 && t4.behind === 194, 'khatma base: target capped at 604');
  { const d2 = C.khatma(30, Date.now() - D, 0, now), d3 = C.khatma(30, Date.now() - 2 * D, 0, now);
    check(d2.behind === 41 && !d2.replan && d3.behind === 61 && d3.replan, 'khatma re-plan only when more than two days of reading behind'); }
  const r = C.khatmaReplan(30, 0, 100);
  check(r.khatmaBase === 100 && r.khatmaDays === Math.ceil(504 / (604 / 30)), `khatma re-plan: base 100, days ${r.khatmaDays}`);
  const after = C.khatma(r.khatmaDays, Date.now(), 100, now, r.khatmaBase);
  check(Math.abs(after.perDay - 604 / 30) < 1 && after.behind === Math.ceil(after.perDay) && !after.replan, 'khatma re-plan keeps the daily pace and starts fresh');
  const r2 = C.khatmaReplan(r.khatmaDays, r.khatmaBase, 300);
  check(r2.khatmaBase === 300 && Math.abs((604 - 300) / r2.khatmaDays - after.perDay) < 1, 'khatma re-plan twice keeps the pace');
}
check(C.surahOnPage(293) === 'الكهف' && C.juzOfPage(582) === 30, 'surah/juz');
check(/هـ$/.test(C.hijri(new Date(), 0, false)), 'hijri');
const res = path.join(root, 'res');
const man = JSON.parse(fs.readFileSync(path.join(res, 'manifest.json'), 'utf8'));
let bad = Object.entries(man).filter(([f, h]) => crypto.createHash('sha256').update(fs.readFileSync(path.join(res, f))).digest('hex') !== h);
check(Object.keys(man).length >= 21 && bad.length === 0, `manifest ${Object.keys(man).length} files verified`);
for (const v of ['makkah', 'makkah_fajr', 'madinah', 'madinah_fajr', 'alafasy', 'alafasy_fajr', 'aqsa', 'abdulbasit']) check(!!man[`sounds/${v}.mp3`], `sound ${v}`);
for (const s of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha', 'iftar', 'dua']) check(!!man[`speech/${s}.m4a`], `speech ${s}`);
const ad = JSON.parse(fs.readFileSync(path.join(res, 'adhkar.json'), 'utf8'));
check(ad.morning.length > 15 && ad.evening.length > 15 && ad.after.length > 5, 'adhkar');
{ // offline mushaf: Tanzil text shipped verbatim + page data + page slicing
  const Q = require(path.join(root, 'app/quran.js'));
  const tf = path.join(res, 'quran/quran-uthmani.txt'), mf = path.join(res, 'quran/quran-meta.json');
  check(!!man['quran/quran-uthmani.txt'] && !!man['quran/quran-meta.json'], 'quran files in manifest');
  const text = fs.readFileSync(tf, 'utf8'), meta = JSON.parse(fs.readFileSync(mf, 'utf8'));
  const src = process.argv[3] && path.join(process.argv[3], 'Quran/quran-uthmani.txt');
  if (src && fs.existsSync(src)) check(Buffer.compare(fs.readFileSync(src), fs.readFileSync(tf)) === 0, 'quran text shipped verbatim (same bytes as the source)');
  check(/PLEASE DO NOT REMOVE OR CHANGE THIS COPYRIGHT BLOCK/.test(text) && /Tanzil Project/.test(text) && /tanzil\.net/.test(text) && /CHANGING IT IS NOT ALLOWED/.test(text), 'quran Tanzil copyright block present');
  const lines = text.split('\n').filter((l) => /^\d+\|\d+\|/.test(l));
  check(lines.length === 6236, `quran verses ${lines.length}`);
  check(meta.pages.length === 604 && meta.suras.length === 114 && meta.juz.length === 30, `quran meta pages=${meta.pages.length} suras=${meta.suras.length} juz=${meta.juz.length}`);
  const B = Q.build(text, meta);
  check(B.verses.length === 6236 && meta.suras.reduce((n, x) => n + x[1], 0) === 6236, 'quran verse index');
  const p = (n) => Q.pageVerses(B, n);
  check(p(1)[0][0] === 1 && p(1)[0][1] === 1 && p(1).length === 7, 'page 1 = al-Fatiha 1:1-7');
  check(p(2)[0].join('|').startsWith('2|1|') && p(2).length === 5, 'page 2 = al-Baqara 2:1-5');
  check(p(293).some(([s, a]) => s === 18 && a === 1) && p(293)[0][0] === 17 && Q.surahStartPage(B, 18) === 293, 'page 293 has the start of al-Kahf');
  check(p(604).some(([s]) => s === 114) && p(604).at(-1).join('|').startsWith('114|6|'), 'page 604 ends with an-Nas');
  check(p(50)[0][0] === 3 && p(50)[0][1] === 1, 'page 50 starts Al Imran');
  let total = 0; for (let i = 1; i <= 604; i++) total += p(i).length;
  check(total === 6236, 'all pages together = every verse once');
  check(Q.juzOfPage(B, 1) === 1 && Q.juzOfPage(B, 22) === 2 && Q.juzOfPage(B, 121) === 7 && Q.juzOfPage(B, 604) === 30, 'juz of page');
  check(Q.pageOf(B, 2, 255) === 42, 'ayat al-kursi on page 42');
  const k = Q.ref(B, '2/255'), w = Q.ref(B, '112');
  check(k.verses.length === 1 && k.from === 255 && w.verses.length === 4 && w.verses[0][1] === 1, 'adhkar refs 2/255 and 112');
  check(w.verses[0][2].startsWith(Q.BASMALA + ' ') && Q.verseText(112, 1, w.verses[0][2]) === w.verses[0][2].slice(Q.BASMALA.length + 1) && Q.verseText(112, 1, w.verses[0][2])[0] === '\u0642' && Q.verseText(1, 1, p(1)[0][2]) === Q.BASMALA, 'basmala split from verse 1');
  check(Q.norm('سورة الكهف') === Q.norm('كهف') && Q.norm('إبراهيم') === Q.norm('ابراهيم'), 'surah search normalization');
}
console.log(fails ? `SELFTEST FAILED (${fails})` : 'SELFTEST PASSED');
process.exit(fails ? 1 : 0);
