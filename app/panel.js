// Main window: next prayer, today's times, khatma, adhkar. Same layout as the Mac panel.
document.head.append(h('style', {}, `
  body.panel { padding: 0; }
  /* short screens: the window is capped to the screen height, so the content scrolls instead of being cut */
  html, body.panel { height: 100%; overflow-y: auto; overflow-x: hidden; scrollbar-width: none; }
  body.panel::-webkit-scrollbar { display: none; }
  #root { width: 400px; }
  .wrap { padding: var(--pad); display: flex; flex-direction: column; gap: 14px; }
  .top { display: flex; align-items: center; gap: 8px; }
  .place { font-size: 13px; padding: 5px 10px; border-radius: 12px; }
  .hijri { font-family: var(--naskh); font-weight: 700; font-size: 16px; color: var(--sec); margin-inline-start: auto; }
  .head { text-align: center; display: flex; flex-direction: column; gap: 6px; align-items: center; }
  .head h1 { font-family: var(--naskh); font-weight: 700; font-size: 44px; color: var(--gold); text-shadow: 0 0 12px rgba(235,194,102,.35); line-height: 1.25; }
  .head .cd { font-size: 18px; font-weight: 600; }
  .head .bar { width: 76%; margin-top: 4px; }
  .head .at { font-size: 13px; color: var(--sec); }
  .stop { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 16px; background: var(--gold); color: var(--ink); text-align: start; width: 100%; }
  .stop b { font-family: var(--naskh); font-size: 18px; display: block; }
  .stop .x { margin-inline-start: auto; font-size: 26px; }
  .list { padding: 8px; display: flex; flex-direction: column; gap: 4px; }
  .row { display: flex; align-items: center; gap: 12px; padding: 7px 12px; border-radius: 12px; border: 1.2px solid transparent; }
  .row.next { background: var(--gold-soft); border-color: rgba(235,194,102,.7); }
  .row.past { opacity: .55; }
  .row .ic { width: 24px; text-align: center; font-size: 15px; }
  .row .nm { font-family: var(--naskh); font-size: 20px; }
  .row.next .nm { font-weight: 700; }
  .badge { font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 999px; background: var(--gold); color: var(--ink); }
  .row .tm { margin-inline-start: auto; font-size: 17px; font-weight: 500; }
  .row.next .tm { font-weight: 700; }
  .mode { width: 30px; height: 30px; border-radius: 50%; background: rgba(247,235,204,.1); font-size: 13px; }
  .mode.off { opacity: .5; }
  .kh { display: flex; gap: 14px; align-items: center; }
  .ring { width: 56px; height: 56px; flex: none; }
  .kh h3 { font-family: var(--naskh); font-size: 20px; }
  .kh .p { font-size: 13px; font-weight: 600; margin-top: 4px; }
  .kh .b { font-size: 12px; color: var(--sec); margin-top: 2px; }
  .kh .btns { display: flex; gap: 8px; margin-top: 8px; }
  .adhkar { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .adhkar button { padding: 12px 0; display: flex; flex-direction: column; align-items: center; gap: 4px; border-radius: 16px; }
  .adhkar .em { font-size: 18px; } .adhkar .t { font-family: var(--naskh); font-weight: 700; font-size: 16px; }
  .foot { display: flex; align-items: center; gap: 6px; color: var(--sec); font-size: 13px; padding: 2px 4px 0; }
  .foot .d { margin: 0 auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fb { padding: 4px 8px; border-radius: 999px; font-size: 12px; font-weight: 700; background: rgba(247,235,204,.1); border: 1px solid rgba(235,194,102,.35); white-space: nowrap; }
  .ram h3 { font-family: var(--naskh); color: var(--gold); font-size: 20px; }
  .ram .stats { display: flex; gap: 24px; margin-top: 8px; } .ram small { color: var(--sec); font-size: 12px; } .ram b { display: block; font-size: 20px; }
  .noloc { padding: 40px 30px; text-align: center; display: flex; flex-direction: column; gap: 12px; align-items: center; }
`));

const root = document.getElementById('root');
const frame = h('div', { class: 'frame drag' });
const content = h('div', { class: 'content' });
frame.append(content);
root.append(frame);
let skyMounted = false;

function ring(v) {
  const r = 24, c = 2 * Math.PI * r;
  const svg = `<svg class="ring" viewBox="0 0 56 56"><circle cx="28" cy="28" r="${r}" fill="none" stroke="rgba(247,235,204,.14)" stroke-width="5"/>
    <circle cx="28" cy="28" r="${r}" fill="none" stroke="#ebc266" stroke-width="5" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.max(0.02, v))}" transform="rotate(-90 28 28)"/>
    <text x="28" y="33" text-anchor="middle" font-size="13" font-weight="700" fill="#f7ebcc">${N(Math.round(v * 100))}٪</text></svg>`;
  const d = h('div'); d.innerHTML = svg; return d.firstChild;
}

function render() {
  if (!STATE) return;
  const s = S(), now = new Date(), inp = input();
  content.replaceChildren();
  if (!inp) {
    content.append(h('div', { class: 'noloc' },
      h('div', { style: { fontSize: '36px' } }, '📍'),
      h('h2', { class: 'naskh' }, 'محتاج أعرف مدينتك'),
      h('p', { class: 'sec', style: { fontSize: '14px' } }, STATE.locationStatus === 'locating' ? 'عم نحدد موقعك…' : 'ما قدرت أحدد موقعك تلقائياً. اختار مدينتك من الإعدادات.'),
      h('button', { class: 'pill gold-fill', onclick: () => window.azan.send('open:settings') }, 'اختيار المدينة')));
    sendHeight(); return;
  }
  const ram = Calc.isRamadan(now, s.hijriOffset);
  const wrap = h('div', { class: 'wrap' });
  if (STATE.playing) {
    wrap.append(h('button', { class: 'stop', onclick: () => window.azan.send('adhan:stop') },
      h('span', { style: { fontSize: '20px' } }, '🔊'),
      h('span', {}, h('b', {}, `أذان ${Calc.AR[STATE.playing]} شغّال`), h('small', {}, 'اكبس هون لإيقافه')),
      h('span', { class: 'x' }, '⏹')));
  }
  // header
  const nx = Calc.next(inp, now);
  const title = nx.p === 'sunrise' ? 'الشروق' : (nx.p === 'maghrib' && ram ? 'الإفطار' : `صلاة ${Calc.AR[nx.p]}`);
  wrap.append(h('div', { class: 'top' },
    h('span', { class: 'place glass' }, '📍 ', s.placeName || 'موقعك'),
    h('span', { class: 'hijri' }, Calc.hijri(now, s.hijriOffset, latin())),
    h('button', { class: 'icon-btn', title: 'إغلاق', onclick: () => window.azan.send('panel:close') }, '✕')));
  wrap.append(h('div', { class: 'head' },
    h('h1', {}, title),
    h('div', { class: 'cd' }, Calc.countdownLong((nx.t - now) / 1000, latin())),
    bar(progress(inp, now)),
    h('div', { class: 'at' }, `الأذان الساعة ${fmtTime(nx.t)}`)));
  // prayers
  const t = Calc.compute(inp, now);
  const list = h('div', { class: 'list glass' });
  for (const p of Calc.PRAYERS) {
    const next = p === nx.p && isToday(nx.t);
    const past = t[p] && t[p] <= now && !next;
    const m = modeOf(p);
    list.append(h('div', { class: `row${next ? ' next' : ''}${past ? ' past' : ''}` },
      h('span', { class: 'ic' }, ICON[p]),
      h('span', { class: 'nm' }, Calc.AR[p]),
      next ? h('span', { class: 'badge' }, 'التالية') : null,
      h('span', { class: 'tm num' }, t[p] ? fmtTime(t[p]) : '--'),
      h('button', { class: `mode${m === 'off' ? ' off' : ''}`, title: MODE_AR[m], onclick: () => {
        const order = ['adhan', 'silent', 'off'];
        window.azan.set({ modes: { ...s.modes, [p]: order[(order.indexOf(m) + 1) % 3] } });
      } }, MODE_ICON[m])));
  }
  wrap.append(list);
  // ramadan
  if (ram) {
    const tom = Calc.compute(inp, new Date(+now + 86400000));
    let imsak = t.fajr && new Date(t.fajr - 600000);
    if (imsak && imsak < now) imsak = tom.fajr && new Date(tom.fajr - 600000);
    wrap.append(h('div', { class: 'glass card ram' }, h('h3', {}, '🌙 رمضان كريم'),
      h('div', { class: 'stats' },
        t.maghrib > now ? h('div', {}, h('small', {}, 'الإفطار بعد'), h('b', {}, Calc.countdown((t.maghrib - now) / 1000, latin()))) : null,
        imsak ? h('div', {}, h('small', {}, 'الإمساك'), h('b', {}, fmtTime(imsak))) : null)));
  }
  // khatma
  if (s.khatmaOn) {
    const k = Calc.khatma(s.khatmaDays, s.khatmaStart, s.khatmaRead, now);
    const body = h('div', { style: { flex: '1' } }, h('h3', {}, 'وردي من القرآن'));
    if (k.finished) {
      body.append(h('div', { class: 'p' }, 'ختمت القرآن، تقبّل الله منك'),
        h('div', { class: 'btns' }, h('button', { class: 'pill gold-fill', onclick: () => window.azan.send('khatma:new') }, 'ابدأ ختمة جديدة')));
    } else {
      const [a, b] = k.portion;
      body.append(h('div', { class: 'p' }, `صفحة ${N(a)}–${N(b)} · سورة ${Calc.surahOnPage(a)}`),
        h('div', { class: 'b', style: k.behind === 0 ? { color: 'var(--gold)' } : {} }, k.behind === 0 ? 'أنت على الموعد، ما شاء الله' : `باقي عليك اليوم ${N(k.behind)} صفحة`),
        h('div', { class: 'btns' },
          h('button', { class: 'pill', onclick: () => window.azan.send('open:url', Calc.pageUrl(a)) }, '📖 افتح المصحف'),
          h('button', { class: 'pill gold-fill', onclick: () => window.azan.send('khatma:read', b) }, '✓ قرأت')));
    }
    wrap.append(h('div', { class: 'glass card kh' }, ring(s.khatmaRead / Calc.PAGES), body));
  }
  // adhkar
  wrap.append(h('div', { class: 'adhkar' },
    [['morning', '🌅', 'الصباح'], ['evening', '🌇', 'المساء'], ['after', '🤲', 'بعد الصلاة']].map(([k, em, t2]) =>
      h('button', { class: 'glass', onclick: () => window.azan.send('open:adhkar', k) }, h('span', { class: 'em' }, em), h('span', { class: 't' }, t2)))));
  const zoomBy = (d) => window.azan.set({ panelScale: Math.min(1.5, Math.max(0.8, Math.round((s.panelScale + d) * 10) / 10)) });
  wrap.append(h('div', { class: 'foot' },
    h('button', { title: 'الإعدادات', style: { fontSize: '16px' }, onclick: () => window.azan.send('open:settings') }, '⚙'),
    h('span', { class: 'd' }, Calc.gregorian(now, latin())),
    h('button', { class: 'fb', title: 'الساعة: ٢٤ أو ١٢', onclick: () => window.azan.set({ use24h: !s.use24h }) }, s.use24h ? '٢٤س' : '١٢س'),
    h('button', { class: 'fb', title: 'تصغير النافذة', onclick: () => zoomBy(-0.1) }, 'A−'),
    h('button', { class: 'fb', title: 'تكبير النافذة', onclick: () => zoomBy(0.1) }, 'A+'),
    h('button', { title: 'إغلاق النافذة', onclick: () => window.azan.send('panel:close') }, '⏻')));
  content.append(wrap);
  sendHeight();
}

let lastH = 0;
function sendHeight() {
  requestAnimationFrame(() => {
    const ht = frame.offsetHeight;   // natural height, before zoom
    if (Math.abs(ht - lastH) > 1) { lastH = ht; window.azan.send('panel:height', ht); }
    if (!skyMounted && ht > 100) { skyMounted = true; mountSky(frame, { moonX: 40, moonY: 105 }); }
  });
}
onState((s) => { applyZoom(s.settings.panelScale); render(); });
window.azan.on('shown', render);
enableEdgeResize(document.body);
