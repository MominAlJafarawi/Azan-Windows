// Home tab of the main window: next prayer, today's times, Ramadan, khatma and adhkar (the tray panel, wider).
(function () {
document.head.append(h('style', {}, `
  .v-home { height: 100%; overflow-y: auto; padding: 0 2px 20px; }
  .v-home .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
  .v-home .col { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  @media (max-width: 640px) { .v-home .grid { grid-template-columns: 1fr; } }
  .v-home .topl { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
  .v-home .place { font-size: 14px; padding: 6px 12px; border-radius: 12px; }
  .v-home .hijri { font-family: var(--naskh); font-weight: 700; font-size: 18px; color: var(--sec); }
  .v-home .greg { margin-inline-start: auto; font-size: 14px; color: var(--sec); }
  .v-home .head { padding: 20px 16px; text-align: center; display: flex; flex-direction: column; gap: 8px; align-items: center; }
  .v-home .head h1 { font-family: var(--naskh); font-weight: 700; font-size: 42px; color: var(--gold); text-shadow: 0 0 12px rgba(235,194,102,.35); line-height: 1.25; }
  .v-home .head .cd { font-size: 19px; font-weight: 600; }
  .v-home .head .bar { width: 80%; margin-top: 4px; }
  .v-home .head .at { font-size: 14px; color: var(--sec); }
  .v-home .stop { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 16px; background: var(--gold); color: var(--ink); text-align: start; width: 100%; margin-bottom: 14px; }
  .v-home .stop b { font-family: var(--naskh); font-size: 19px; display: block; }
  .v-home .stop .x { margin-inline-start: auto; font-size: 26px; }
  .v-home .list { padding: 8px; display: flex; flex-direction: column; gap: 4px; }
  .v-home .row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 12px; border: 1.2px solid transparent; }
  .v-home .row.next { background: var(--gold-soft); border-color: rgba(235,194,102,.7); }
  .v-home .row.past { opacity: .55; }
  .v-home .row .ic { width: 24px; text-align: center; font-size: 16px; }
  .v-home .row .nm { font-family: var(--naskh); font-size: 21px; }
  .v-home .row.next .nm { font-weight: 700; }
  .v-home .badge { font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 999px; background: var(--gold); color: var(--ink); white-space: nowrap; }
  .v-home .row .tm { margin-inline-start: auto; font-size: 18px; font-weight: 500; }
  .v-home .row.next .tm { font-weight: 700; }
  .v-home .mode { width: 32px; height: 32px; border-radius: 50%; background: rgba(247,235,204,.1); font-size: 14px; flex: none; }
  .v-home .mode.off { opacity: .5; }
  .v-home .kh { display: flex; gap: 14px; align-items: center; }
  .v-home .ring { width: 58px; height: 58px; flex: none; }
  .v-home .kh h3, .v-home .ram h3 { font-family: var(--naskh); font-size: 21px; }
  .v-home .kh .p { font-size: 14px; font-weight: 600; margin-top: 4px; }
  .v-home .kh .b { font-size: 13px; color: var(--sec); margin-top: 2px; }
  .v-home .kh .btns { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
  .v-home .ram h3 { color: var(--gold); }
  .v-home .ram .stats { display: flex; gap: 24px; margin-top: 8px; } .v-home .ram small { color: var(--sec); font-size: 13px; } .v-home .ram b { display: block; font-size: 20px; }
  .v-home .adhkar { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .v-home .adhkar button { padding: 12px 0; display: flex; flex-direction: column; align-items: center; gap: 4px; border-radius: 16px; }
  .v-home .adhkar .em { font-size: 19px; } .v-home .adhkar .t { font-family: var(--naskh); font-weight: 700; font-size: 17px; }
  .v-home .noloc { padding: 50px 30px; text-align: center; display: flex; flex-direction: column; gap: 14px; align-items: center; }
`));

let el = null, nav = () => {};
function mount(host, { navigate } = {}) { nav = navigate || nav; el = h('div', { class: 'v-home' }); host.append(el); }

function ring(v) {
  const r = 24, c = 2 * Math.PI * r;
  const d = h('div');
  d.innerHTML = `<svg class="ring" viewBox="0 0 56 56"><circle cx="28" cy="28" r="${r}" fill="none" stroke="rgba(247,235,204,.14)" stroke-width="5"/>
    <circle cx="28" cy="28" r="${r}" fill="none" stroke="#ebc266" stroke-width="5" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.max(0.02, v))}" transform="rotate(-90 28 28)"/>
    <text x="28" y="33" text-anchor="middle" font-size="13" font-weight="700" fill="#f7ebcc">${N(Math.round(v * 100))}٪</text></svg>`;
  return d.firstChild;
}

function render() {
  if (!STATE || !el) return;
  const s = S(), now = new Date(), inp = input();
  const top = el.scrollTop;
  el.replaceChildren();
  if (!inp) {
    el.append(h('div', { class: 'noloc glass' },
      h('div', { style: { fontSize: '38px' } }, '📍'),
      h('h2', { class: 'naskh' }, 'محتاج أعرف مدينتك'),
      h('p', { class: 'sec', style: { fontSize: '15px' } }, STATE.locationStatus === 'locating' ? 'عم نحدد موقعك…' : 'ما قدرت أحدد موقعك تلقائياً. اختار مدينتك من الإعدادات.'),
      h('button', { class: 'pill gold-fill', onclick: () => nav({ tab: 'settings', sub: 'loc' }) }, 'اختيار المدينة')));
    return;
  }
  const ram = Calc.isRamadan(now, s.hijriOffset);
  if (STATE.playing) {
    el.append(h('button', { class: 'stop', onclick: () => window.azan.send('adhan:stop') },
      h('span', { style: { fontSize: '20px' } }, '🔊'),
      h('span', {}, h('b', {}, `أذان ${Calc.AR[STATE.playing]} شغّال`), h('small', {}, 'اكبس هون لإيقافه')),
      h('span', { class: 'x' }, '⏹')));
  }
  el.append(h('div', { class: 'topl' },
    h('span', { class: 'place glass' }, '📍 ', s.placeName || 'موقعك'),
    h('span', { class: 'hijri' }, Calc.hijri(now, s.hijriOffset, latin())),
    h('span', { class: 'greg' }, Calc.gregorian(now, latin()))));

  const nx = Calc.next(inp, now);
  const title = nx.p === 'sunrise' ? 'الشروق' : (nx.p === 'maghrib' && ram ? 'الإفطار' : `صلاة ${Calc.AR[nx.p]}`);
  const right = h('div', { class: 'col' });
  const left = h('div', { class: 'col' });
  right.append(h('div', { class: 'glass head' },
    h('h1', {}, title),
    h('div', { class: 'cd' }, Calc.countdownLong((nx.t - now) / 1000, latin())),
    bar(progress(inp, now)),
    h('div', { class: 'at' }, `الأذان الساعة ${fmtTime(nx.t)}`)));

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
  left.append(list);

  if (ram) {
    const tom = Calc.compute(inp, new Date(+now + 86400000));
    let imsak = t.fajr && new Date(t.fajr - 600000);
    if (imsak && imsak < now) imsak = tom.fajr && new Date(tom.fajr - 600000);
    right.append(h('div', { class: 'glass card ram' }, h('h3', {}, '🌙 رمضان كريم'),
      h('div', { class: 'stats' },
        t.maghrib > now ? h('div', {}, h('small', {}, 'الإفطار بعد'), h('b', {}, Calc.countdown((t.maghrib - now) / 1000, latin()))) : null,
        imsak ? h('div', {}, h('small', {}, 'الإمساك'), h('b', {}, fmtTime(imsak))) : null)));
  }
  if (s.khatmaOn) {
    const k = Calc.khatma(s.khatmaDays, s.khatmaStart, s.khatmaRead, now);
    const body = h('div', { style: { flex: '1', minWidth: '0' } }, h('h3', {}, 'وردي من القرآن'));
    if (k.finished) {
      body.append(h('div', { class: 'p' }, 'ختمت القرآن، تقبّل الله منك'),
        h('div', { class: 'btns' }, h('button', { class: 'pill gold-fill', onclick: () => window.azan.send('khatma:new') }, 'ابدأ ختمة جديدة')));
    } else {
      const [a, b] = k.portion;
      body.append(h('div', { class: 'p' }, `صفحة ${N(a)}–${N(b)} · سورة ${Calc.surahOnPage(a)}`),
        h('div', { class: 'b', style: k.behind === 0 ? { color: 'var(--gold)' } : {} }, k.behind === 0 ? 'أنت على الموعد، ما شاء الله' : `باقي عليك اليوم ${N(k.behind)} صفحة`),
        h('div', { class: 'btns' },
          h('button', { class: 'pill', onclick: () => nav({ tab: 'quran', page: a, index: false }) }, '📖 افتح المصحف'),
          h('button', { class: 'pill gold-fill', onclick: () => window.azan.send('khatma:read', b) }, '✓ قرأت')));
    }
    right.append(h('div', { class: 'glass card kh' }, ring(s.khatmaRead / Calc.PAGES), body));
  }
  left.append(h('div', { class: 'adhkar' },
    [['morning', '🌅', 'الصباح'], ['evening', '🌇', 'المساء'], ['after', '🤲', 'بعد الصلاة']].map(([k, em, t2]) =>
      h('button', { class: 'glass', onclick: () => nav({ tab: 'adhkar', kind: k }) }, h('span', { class: 'em' }, em), h('span', { class: 't' }, t2)))));
  el.append(h('div', { class: 'grid' }, right, left));
  el.scrollTop = top;
}
window.HomeView = { mount, render, show: render, sub: () => null };
})();
