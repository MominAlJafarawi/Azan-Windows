// Floating desktop widget: drag to move, click to open the app (or stop the adhan), right-click for options.
document.head.append(h('style', {}, `
  html, body { width: 100%; height: 100%; }
  #root { position: relative; }
  .frame { position: absolute; left: 0; top: 0; border-radius: 28px; cursor: default; }
  .content { position: absolute; inset: 0; padding: var(--pad); display: flex; flex-direction: column; gap: 12px; }
  .main { display: flex; gap: 14px; flex: 1; min-height: 0; }
  .nb { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .nb .loc { font-size: 13px; color: var(--sec); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nb .hj { font-family: var(--naskh); font-weight: 700; font-size: 15px; color: var(--sec); }
  .nb .sp { flex: 1; }
  .nb .nm { font-family: var(--naskh); font-weight: 700; font-size: 38px; color: var(--gold); text-shadow: 0 0 10px rgba(235,194,102,.35); line-height: 1.2; }
  .nb .cd { font-size: 15px; font-weight: 600; }
  .nb .at { font-size: 13px; color: var(--sec); }
  .playing { align-self: flex-start; font-size: 13px; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: var(--gold); color: var(--ink); }
  .sep { width: 1px; background: rgba(247,235,204,.15); }
  .ls { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 2px; }
  .ls .r { display: flex; align-items: center; padding: 1px 9px; border-radius: 9px; border: 1px solid transparent; line-height: 1.35; }
  .ls .r.n { background: var(--gold-soft); border-color: rgba(235,194,102,.7); }
  .ls .r.p { opacity: .6; }
  .ls .r span:first-child { font-family: var(--naskh); font-size: 16px; }
  .ls .r.n span:first-child { font-weight: 700; }
  .ls .r span:last-child { margin-inline-start: auto; font-size: 14px; font-weight: 500; }
  .ls .r .tg { font-style: normal; font-size: 10px; font-weight: 700; padding: 0 6px; margin-inline-start: 6px; border-radius: 999px; background: var(--gold); color: var(--ink); line-height: 1.6; }
  .kh { padding: 14px; }
  .kh .t { display: flex; font-family: var(--naskh); font-weight: 700; font-size: 18px; margin-bottom: 8px; }
  .kh .t span:last-child { margin-inline-start: auto; font-family: var(--sans); font-size: 13px; }
  .kh .p { font-size: 13px; font-weight: 500; margin-top: 8px; }
`));

const root = document.getElementById('root');
const frame = h('div', { class: 'frame' });
const content = h('div', { class: 'content' });
frame.append(content);
root.append(frame);
const BASE = { small: [230, 230], medium: [470, 240], large: [470, 480] };
let skyFor = null;
function sizeFrame(s) {
  const [w, ht] = BASE[s.deskSize] || BASE.medium;
  frame.style.width = w + 'px'; frame.style.height = ht + 'px';
  applyZoom(s.deskScale);
  if (skyFor !== s.deskSize) {
    skyFor = s.deskSize;
    frame.querySelector('.sky')?.remove();
    requestAnimationFrame(() => mountSky(frame, { moonX: s.deskSize === 'small' ? 30 : Math.round(w * 0.56), moonY: 30 }));
  }
}

function render() {
  if (!STATE) return;
  const s = S(), now = new Date(), inp = input();
  sizeFrame(s);
  content.replaceChildren();
  if (!inp) { content.append(h('div', { class: 'naskh', style: { margin: 'auto', fontSize: '17px' } }, 'افتح الإعدادات واختار مدينتك')); return; }
  const ram = Calc.isRamadan(now, s.hijriOffset);
  const nx = Calc.next(inp, now);
  const nb = h('div', { class: 'nb' },
    h('div', { class: 'loc' }, '📍 ', s.placeName),
    h('div', { class: 'hj' }, Calc.hijri(now, s.hijriOffset, latin(), false)),
    h('div', { class: 'sp' }),
    h('div', { class: 'nm' }, nx.p === 'maghrib' && ram ? 'الإفطار' : Calc.AR[nx.p]),
    STATE.playing ? h('div', { class: 'playing' }, '🔊 الأذان شغّال · اكبس للإيقاف') : h('div', { class: 'cd' }, Calc.countdownLong((nx.t - now) / 1000, latin())),
    bar(progress(inp, now)),
    h('div', { class: 'at' }, `${isToday(nx.t) ? 'الأذان' : 'بكرة'} ${fmtTime(nx.t)}`));
  if (s.deskSize === 'small') { content.append(nb); return; }
  const t = Calc.compute(inp, now);
  // after Isha the next one is tomorrow's Fajr: its row is gold, shows tomorrow's time and "بكرة"
  const tomorrow = !isToday(nx.t);
  const ls = h('div', { class: 'ls' }, Calc.PRAYERS.map((p) => {
    const n = p === nx.p, tm = n ? nx.t : t[p];
    return h('div', { class: `r${n ? ' n' : ''}${!n && t[p] && t[p] < now ? ' p' : ''}` }, h('span', {}, Calc.AR[p]),
      n && tomorrow ? h('i', { class: 'tg' }, 'بكرة') : null, h('span', { class: 'num' }, tm ? fmtTime(tm) : '--'));
  }));
  content.append(h('div', { class: 'main' }, nb, h('div', { class: 'sep' }), ls));
  if (s.deskSize === 'large' && s.khatmaOn) {
    const k = Calc.khatma(s.khatmaDays, s.khatmaStart, s.khatmaRead, now, s.khatmaBase);
    content.append(h('div', { class: 'glass kh' },
      h('div', { class: 't' }, h('span', {}, '📖 وردي'), h('span', { class: 'num' }, `${N(s.khatmaRead)} / ${N(Calc.PAGES)}`)),
      bar(s.khatmaRead / Calc.PAGES),
      k.portion ? h('div', { class: 'p' }, `صفحة ${N(k.portion[0])}–${N(k.portion[1])} · ${Calc.surahOnPage(k.portion[0])}`) : null));
  }
}
onState(render);

// drag = move, still click = open, right click = menu
let down = null, moved = false;
enableEdgeResize(document.body);
frame.addEventListener('mousedown', (e) => { if (e.button !== 0) return; down = { x: e.screenX, y: e.screenY }; moved = false; });
window.addEventListener('mousemove', (e) => {
  if (!down) return;
  const dx = e.screenX - down.x, dy = e.screenY - down.y;
  if (!moved && Math.hypot(dx, dy) < 4) return;
  moved = true;
  window.azan.send('desk:moveBy', dx, dy);
  down = { x: e.screenX, y: e.screenY };
});
window.addEventListener('mouseup', (e) => {
  if (!down || e.button !== 0) return;
  if (moved) window.azan.send('desk:moved'); else window.azan.send('desk:click');
  down = null;
});
frame.addEventListener('contextmenu', (e) => { e.preventDefault(); window.azan.send('desk:menu'); });
