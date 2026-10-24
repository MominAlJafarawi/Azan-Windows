// Prayer time math, Hijri date, Quran pages and khatma plan.
// Same algorithm as the Mac version (Shared/PrayerCalc.swift). Works in Node (main) and the browser (renderer).
(function (root) {
  const PRAYERS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const AR = { fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };

  const METHODS = {
    mwl:       { ar: 'رابطة العالم الإسلامي', fajr: 18, isha: 17 },
    ummAlQura: { ar: 'أم القرى (مكة)', fajr: 18.5, ishaMin: 90 },
    diyanet:   { ar: 'الشؤون الدينية التركية', fajr: 18, isha: 17, off: [0, -7, 5, 4, 7, 0] },
    egyptian:  { ar: 'الهيئة المصرية العامة للمساحة', fajr: 19.5, isha: 17.5 },
    jordan:    { ar: 'وزارة الأوقاف الأردنية', fajr: 18, isha: 18, off: [0, 0, 0, 0, 5, 0] },
    dubai:     { ar: 'دبي', fajr: 18.2, isha: 18.2, off: [0, -3, 3, 3, 3, 0] },
    gulf:      { ar: 'قطر والخليج', fajr: 18, ishaMin: 90 },
    kuwait:    { ar: 'الكويت', fajr: 18, isha: 17.5 },
    isna:      { ar: 'أمريكا الشمالية (ISNA)', fajr: 15, isha: 15 },
    karachi:   { ar: 'جامعة العلوم الإسلامية بكراتشي', fajr: 18, isha: 18 },
    singapore: { ar: 'سنغافورة وماليزيا وإندونيسيا', fajr: 20, isha: 18, off: [0, 0, 1, 0, 0, 0] },
    morocco:   { ar: 'المغرب', fajr: 19, isha: 17, off: [0, -3, 5, 0, 5, 0] },
    tunisia:   { ar: 'تونس', fajr: 18, isha: 18 },
    france:    { ar: 'فرنسا (UOIF)', fajr: 12, isha: 12 },
    russia:    { ar: 'روسيا', fajr: 16, isha: 15 },
  };

  function methodForCountry(cc) {
    switch ((cc || '').toUpperCase()) {
      case 'SA': case 'YE': return 'ummAlQura';
      case 'TR': return 'diyanet';
      case 'EG': case 'SY': case 'LB': case 'IQ': case 'SD': case 'LY': return 'egyptian';
      case 'JO': case 'PS': return 'jordan';
      case 'AE': return 'dubai';
      case 'QA': case 'BH': case 'OM': return 'gulf';
      case 'KW': return 'kuwait';
      case 'US': case 'CA': return 'isna';
      case 'PK': case 'IN': case 'BD': case 'AF': return 'karachi';
      case 'MY': case 'SG': case 'BN': case 'ID': return 'singapore';
      case 'MA': return 'morocco';
      case 'TN': return 'tunisia';
      case 'FR': return 'france';
      case 'RU': return 'russia';
      default: return 'mwl';
    }
  }

  const rad = (d) => d * Math.PI / 180, deg = (r) => r * 180 / Math.PI;
  const dsin = (d) => Math.sin(rad(d)), dcos = (d) => Math.cos(rad(d)), dtan = (d) => Math.tan(rad(d));
  const fix = (a, b) => { const r = a - b * Math.floor(a / b); return r < 0 ? r + b : r; };

  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    const a = Math.floor(y / 100), b = 2 - a + Math.floor(a / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5;
  }

  function sunPosition(jd) {
    const D = jd - 2451545.0;
    const g = fix(357.529 + 0.98560028 * D, 360);
    const q = fix(280.459 + 0.98564736 * D, 360);
    const L = fix(q + 1.915 * dsin(g) + 0.020 * dsin(2 * g), 360);
    const e = 23.439 - 0.00000036 * D;
    const ra = fix(deg(Math.atan2(dcos(e) * dsin(L), dcos(L))) / 15, 24);
    let eqt = q / 15 - ra;
    if (eqt > 12) eqt -= 24;
    if (eqt < -12) eqt += 24;
    return { decl: deg(Math.asin(dsin(e) * dsin(L))), eqt };
  }

  // input: {lat, lon, method, school:'shafi'|'hanafi', highLat:'auto'|..., offsets:[6], ramadan}
  // day: a Date on the wanted local day. Returns {fajr: Date, ...}
  function compute(input, day) {
    const y = day.getFullYear(), m = day.getMonth() + 1, d = day.getDate();
    const base = Date.UTC(y, m - 1, d);
    const lat = input.lat, lng = input.lon;
    const M = METHODS[input.method] || METHODS.mwl;
    const jd0 = julian(y, m, d) - lng / 360;
    const midDay = (t) => fix(12 - sunPosition(jd0 + t / 24).eqt, 24);
    const angleTime = (angle, t, ccw) => {
      const decl = sunPosition(jd0 + t / 24).decl, noon = midDay(t);
      const arg = (-dsin(angle) - dsin(decl) * dsin(lat)) / (dcos(decl) * dcos(lat));
      if (arg < -1 || arg > 1) return NaN;
      const h = deg(Math.acos(arg)) / 15;
      return noon + (ccw ? -h : h);
    };
    const asrTime = (factor, t) => {
      const decl = sunPosition(jd0 + t / 24).decl;
      const angle = -deg(Math.atan(1 / (factor + dtan(Math.abs(lat - decl)))));
      return angleTime(angle, t, false);
    };
    const asrFactor = input.school === 'hanafi' ? 2 : 1;
    let t = [5, 6, 12, 13, 18, 18, 18];
    for (let i = 0; i < 2; i++) {
      const f = t.map((v) => (isNaN(v) ? 12 : v));
      t = [angleTime(M.fajr, f[0], true), angleTime(0.833, f[1], true), midDay(f[2]), asrTime(asrFactor, f[3]),
        angleTime(0.833, f[4], false), angleTime(0.833, f[5], false), angleTime(M.isha || 18, f[6], false)];
    }
    t = t.map((v) => v - lng / 15);
    let [fajr, sunrise, dhuhr, asr, sunset, , isha] = t;
    if (!M.isha) isha = sunset + ((input.ramadan && input.method === 'ummAlQura') ? 120 : M.ishaMin) / 60;

    let rule = input.highLat || 'auto';
    if (rule === 'auto') rule = Math.abs(lat) > 48 ? 'seventh' : 'middle';
    if (rule !== 'none' && !isNaN(sunrise) && !isNaN(sunset)) {
      const night = 24 - (sunset - sunrise);
      const portion = (a) => rule === 'seventh' ? night / 7 : rule === 'angle' ? a / 60 * night : night / 2;
      const safeFajr = sunrise - portion(M.fajr);
      if (isNaN(fajr) || fajr < safeFajr) fajr = safeFajr;
      if (M.isha) { const safeIsha = sunset + portion(M.isha); if (isNaN(isha) || isha > safeIsha) isha = safeIsha; }
    }
    const builtIn = M.off || [0, 0, 0, 0, 0, 0];
    const user = (input.offsets && input.offsets.length === 6) ? input.offsets : [0, 0, 0, 0, 0, 0];
    const raw = [fajr, sunrise, dhuhr, asr, sunset, isha];
    const out = {};
    PRAYERS.forEach((p, i) => {
      if (isNaN(raw[i])) return;
      const minutes = Math.round(raw[i] * 60 + builtIn[i] + (Number(user[i]) || 0));
      out[p] = new Date(base + minutes * 60000);
    });
    return out;
  }

  function next(input, now, includeSunrise = true) {
    for (let k = 0; k < 3; k++) {
      const d = new Date(now.getTime() + k * 86400000);
      const t = compute(input, d);
      for (const p of PRAYERS) if ((includeSunrise || p !== 'sunrise') && t[p] && t[p] > now) return { p, t: t[p] };
    }
    return { p: 'fajr', t: new Date(now.getTime() + 86400000) };
  }
  // end of a prayer's time (next event, sunrise for fajr) for a missed-adhan card, or null when the card is no longer useful
  function missedUntil(input, p, adhanTime, now) {
    if (!input || p === 'sunrise') return null;
    const end = next(input, new Date(+adhanTime + 1000)).t;
    return +now < +end - 60000 ? end : null;
  }
  function previous(input, now) {
    for (let k = 0; k < 3; k++) {
      const d = new Date(now.getTime() - k * 86400000);
      const t = compute(input, d);
      for (const p of [...PRAYERS].reverse()) if (t[p] && t[p] <= now) return { p, t: t[p] };
    }
    return { p: 'isha', t: new Date(now.getTime() - 3600000) };
  }

  // ---------- formatting ----------
  const loc = (latin) => (latin ? 'ar-u-nu-latn' : 'ar-u-nu-arab');
  const num = (n, latin) => new Intl.NumberFormat(loc(latin)).format(n);
  const time = (d, latin, h24) => new Intl.DateTimeFormat(loc(latin), { hour: h24 ? '2-digit' : 'numeric', minute: '2-digit', hour12: !h24 }).format(d);
  const shift = (d, off) => new Date(d.getTime() + (off || 0) * 86400000);
  const hijri = (d, off, latin, withYear = true) =>
    new Intl.DateTimeFormat(`ar-SA-u-ca-islamic-umalqura-nu-${latin ? 'latn' : 'arab'}`, withYear ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long' })
      .format(shift(d, off)).replace(/\s?هـ$/, '') + (withYear ? ' هـ' : '');
  const hijriMonth = (d, off) => Number(new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { month: 'numeric' }).format(shift(d, off)));
  const isRamadan = (d, off) => hijriMonth(d, off) === 9;
  const gregorian = (d, latin) => new Intl.DateTimeFormat(loc(latin), { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  function mins(x, latin) {
    if (x === 1) return 'دقيقة';
    if (x === 2) return 'دقيقتين';
    if (x >= 3 && x <= 10) return `${num(x, latin)} دقائق`;
    return `${num(x, latin)} دقيقة`;
  }
  function countdownLong(sec, latin) {
    const m = Math.max(0, Math.ceil(sec / 60));
    if (m < 60) return `بعد ${mins(m, latin)}`;
    const h = Math.floor(m / 60), r = m % 60;
    const hs = h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : `${num(h, latin)} ساعات`;
    return r === 0 ? `بعد ${hs}` : `بعد ${hs} و${mins(r, latin)}`;
  }
  function countdown(sec, latin) {
    const m = Math.max(0, Math.ceil(sec / 60));
    if (m < 60) return `${num(m, latin)} د`;
    const h = Math.floor(m / 60), r = m % 60;
    return r === 0 ? `${num(h, latin)} س` : `${num(h, latin)} س ${num(r, latin)} د`;
  }

  // ---------- Quran / khatma ----------
  const PAGES = 604;
  const SURAH_START = [1, 2, 50, 77, 106, 128, 151, 177, 187, 208, 221, 235, 249, 255, 262, 267, 282, 293, 305, 312, 322, 332, 342, 350, 359, 367, 377, 385, 396, 404, 411, 415, 418, 428, 434, 440, 446, 453, 458, 467, 477, 483, 489, 496, 499, 502, 507, 511, 515, 518, 520, 523, 526, 528, 531, 534, 537, 542, 545, 549, 551, 553, 554, 556, 558, 560, 562, 564, 566, 568, 570, 572, 574, 575, 577, 578, 580, 582, 583, 585, 586, 587, 587, 589, 590, 591, 591, 592, 593, 594, 595, 595, 596, 596, 597, 597, 598, 598, 599, 599, 600, 600, 601, 601, 601, 602, 602, 602, 603, 603, 603, 604, 604, 604];
  const SURAH_NAMES = 'الفاتحة|البقرة|آل عمران|النساء|المائدة|الأنعام|الأعراف|الأنفال|التوبة|يونس|هود|يوسف|الرعد|إبراهيم|الحجر|النحل|الإسراء|الكهف|مريم|طه|الأنبياء|الحج|المؤمنون|النور|الفرقان|الشعراء|النمل|القصص|العنكبوت|الروم|لقمان|السجدة|الأحزاب|سبأ|فاطر|يس|الصافات|ص|الزمر|غافر|فصلت|الشورى|الزخرف|الدخان|الجاثية|الأحقاف|محمد|الفتح|الحجرات|ق|الذاريات|الطور|النجم|القمر|الرحمن|الواقعة|الحديد|المجادلة|الحشر|الممتحنة|الصف|الجمعة|المنافقون|التغابن|الطلاق|التحريم|الملك|القلم|الحاقة|المعارج|نوح|الجن|المزمل|المدثر|القيامة|الإنسان|المرسلات|النبأ|النازعات|عبس|التكوير|الانفطار|المطففين|الانشقاق|البروج|الطارق|الأعلى|الغاشية|الفجر|البلد|الشمس|الليل|الضحى|الشرح|التين|العلق|القدر|البينة|الزلزلة|العاديات|القارعة|التكاثر|العصر|الهمزة|الفيل|قريش|الماعون|الكوثر|الكافرون|النصر|المسد|الإخلاص|الفلق|الناس'.split('|');
  function surahOnPage(p) { let idx = 0; SURAH_START.forEach((s, i) => { if (s <= p) idx = i; }); return SURAH_NAMES[idx]; }
  const juzOfPage = (p) => (p < 22 ? 1 : Math.min(30, Math.floor((p - 2) / 20) + 1));

  function khatma(days, start, lastRead, now) {
    const perDay = PAGES / Math.max(1, days);
    const s = new Date(start); s.setHours(0, 0, 0, 0);
    const n = new Date(now); n.setHours(0, 0, 0, 0);
    const dayIndex = Math.max(1, Math.round((n - s) / 86400000) + 1);
    const target = Math.min(PAGES, Math.ceil(perDay * dayIndex));
    const chunk = Math.max(1, Math.ceil(perDay / 5));
    const finished = lastRead >= PAGES;
    const portion = finished ? null : [lastRead + 1, Math.min(PAGES, lastRead + chunk)];
    return { perDay, dayIndex, target, chunk, finished, portion, behind: Math.max(0, target - lastRead) };
  }

  const api = { PRAYERS, AR, METHODS, methodForCountry, compute, next, missedUntil, previous, num, time, hijri, isRamadan, gregorian,
    countdownLong, countdown, PAGES, SURAH_NAMES, SURAH_START, surahOnPage, juzOfPage, khatma, sunPosition };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Calc = api;
})(typeof window !== 'undefined' ? window : globalThis);
