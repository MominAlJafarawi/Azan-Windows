// Home tab of the main window: next prayer, today's times, Ramadan, khatma and adhkar (the tray panel, wider).
(function () {
document.head.append(h('style', {}, `
  .v-home { height: 100%; overflow-y: auto; padding: 0 2px 20px; }
  .v-home .grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 16px; align-items: start; }
  .v-home .col { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  @media (max-width: 640px) { .v-home .grid { grid-template-columns: 1fr; } }
  .v-home .dates { display: flex; align-items: center; justify-content: space-between; gap: 4px 10px; padding: 12px 16px; font-size: 14px; color: var(--sec); flex-wrap: wrap; }
  .v-home .dates .hijri { font-family: var(--naskh); font-weight: 700; font-size: 16px; }
  .v-home .head { padding: 20px 16px 18px; text-align: center; display: flex; flex-direction: column; gap: 4px; align-items: center; }
  .v-home .head .place { font-size: 14px; color: var(--sec); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .v-home .head h1 { font-family: var(--naskh); font-weight: 700; font-size: 40px; color: var(--gold); text-shadow: 0 0 12px rgba(235,194,102,.35); line-height: 1.3; }
  .v-home .head .cd { font-size: 22px; font-weight: 700; }
  .v-home .head .at { font-size: 15px; color: var(--sec); margin-top: 4px; }
  .v-home .stop { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 16px; background: var(--gold); color: var(--ink); text-align: start; width: 100%; margin-bottom: 14px; }
  .v-home .stop b { font-family: var(--naskh); font-size: 19px; display: block; }
  .v-home .stop .x { margin-inline-start: auto; font-size: 26px; }
  .v-home .list { padding: 8px; display: flex; flex-direction: column; gap: 4px; }
  .v-home .row { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 12px; border: 1.2px solid transparent; min-height: 46px; }
  .v-home .row.next { background: var(--gold-soft); border-color: rgba(235,194,102,.7); }
  .v-home .row.past { opacity: .55; }
  .v-home .row .ic { width: 24px; text-align: center; font-size: 16px; flex: none; }
  .v-home .row .nm { font-family: var(--naskh); font-size: 21px; white-space: nowrap; }
  .v-home .row.next .nm { font-weight: 700; }
  .v-home .badge { font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: var(--gold); color: var(--ink); white-space: nowrap; }
  .v-home .row .tm { margin-inline-start: auto; font-size: 18px; font-weight: 600; }
  .v-home .row.next .tm { font-weight: 700; color: var(--gold); }
  .v-home .kh { display: flex; gap: 14px; align-items: center; }
  .v-home .ring { width: 58px; height: 58px; flex: none; }
  .v-home .kh h3, .v-home .ram h3 { font-family: var(--naskh); font-size: 21px; }
  .v-home .kh .p { font-size: 15px; font-weight: 600; margin-top: 4px; }
  .v-home .kh .b { font-size: 14px; color: var(--sec); margin-top: 2px; }
  .v-home .kh .btns { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
  .v-home .kh .pill { font-size: 14px; padding: 7px 14px; }
  .v-home .ram h3 { color: var(--gold); }
  .v-home .ram .stats { display: flex; gap: 24px; margin-top: 8px; } .v-home .ram small { color: var(--sec); font-size: 13px; } .v-home .ram b { display: block; font-size: 20px; }
  .v-home .adhkar { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .v-home .adhkar button { padding: 12px 4px; display: flex; flex-direction: column; align-items: center; gap: 4px; border-radius: 16px; }
  .v-home .adhkar .em { font-size: 19px; } .v-home .adhkar .t { font-family: var(--naskh); font-weight: 700; font-size: 17px; }
  .v-home .noloc { padding: 50px 30px; text-align: center; display: flex; flex-direction: column; gap: 14px; align-items: center; }
`));

let el = null, nav = () => {};
function mount(host, { navigate } = {}) { nav = navigate || nav; el = h('div', { class: 'v-home' }); host.append(el); }

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
  const { nx, title, at } = nextInfo(inp, now);
  const t = Calc.compute(inp, now);
  // right column: next prayer (the countdown is shown here only; the window header hides its own on this tab), then the times
  const right = h('div', { class: 'col' });
  const left = h('div', { class: 'col' });
  right.append(h('div', { class: 'glass head' },
    h('div', { class: 'place' }, '📍 ', s.placeName || 'موقعك'),
    h('h1', {}, title),
    h('div', { class: 'cd' }, Calc.countdownLong((nx.t - now) / 1000, latin())),
    h('div', { class: 'at num' }, at)));
  right.append(prayerList(inp, now, nx));

  // left column: dates, Ramadan, khatma, adhkar
  left.append(h('div', { class: 'glass dates' },
    h('span', {}, Calc.gregorian(now, latin())),
    h('span', { class: 'hijri' }, Calc.hijri(now, s.hijriOffset, latin()))));
  if (ram) {
    const tom = Calc.compute(inp, new Date(+now + 86400000));
    let imsak = t.fajr && new Date(t.fajr - 600000);
    if (imsak && imsak < now) imsak = tom.fajr && new Date(tom.fajr - 600000);
    left.append(h('div', { class: 'glass card ram' }, h('h3', {}, '🌙 رمضان كريم'),
      h('div', { class: 'stats' },
        t.maghrib > now ? h('div', {}, h('small', {}, 'الإفطار بعد'), h('b', {}, Calc.countdown((t.maghrib - now) / 1000, latin()))) : null,
        imsak ? h('div', {}, h('small', {}, 'الإمساك'), h('b', {}, fmtTime(imsak))) : null)));
  }
  if (s.khatmaOn) left.append(khatmaCard((page) => nav({ tab: 'quran', page, index: false }), false));
  left.append(h('div', { class: 'adhkar' },
    [['morning', '🌅', 'الصباح'], ['evening', '🌇', 'المساء'], ['after', '🤲', 'بعد الصلاة']].map(([k, em, t2]) =>
      h('button', { class: 'glass', onclick: () => nav({ tab: 'adhkar', kind: k }) }, h('span', { class: 'em' }, em), h('span', { class: 't' }, t2)))));
  el.append(h('div', { class: 'grid' }, right, left));
  el.scrollTop = top;
}
window.HomeView = { mount, render, show: render, sub: () => null };
})();
