// Adhkar window (Hisn al-Muslim): tap a card to count, Quran passages open on quran.com.
document.head.append(h('style', {}, `
  html, body { height: 100%; background: var(--bottom); }
  #root { position: relative; height: 100%; }
  .page { position: absolute; inset: 0; display: flex; flex-direction: column; }
  .top { padding: 16px 22px 10px; display: flex; flex-direction: column; align-items: center; gap: 10px; position: relative; }
  .top .x { position: absolute; top: 14px; left: 16px; }
  .top h1 { font-family: var(--naskh); font-size: 30px; }
  .top .c { font-size: 12px; color: var(--sec); }
  .top .bar { width: 220px; }
  .list { flex: 1; overflow-y: auto; padding: 4px 22px 22px; display: flex; flex-direction: column; gap: 10px; }
  .dk { padding: 16px; text-align: start; display: flex; flex-direction: column; gap: 10px; transition: opacity .2s; }
  .dk.done { opacity: .6; border-color: rgba(235,194,102,.5); }
  .dk .tx { font-family: var(--naskh); font-size: 21px; line-height: 2; }
  .dk .tt { display: flex; align-items: center; font-family: var(--naskh); font-weight: 700; font-size: 21px; }
  .dk .tt .pill { margin-inline-start: auto; font-family: var(--sans); font-weight: 500; font-size: 12px; }
  .dk .ft { display: flex; align-items: center; }
  .dk .nt { font-size: 12px; color: var(--sec); }
  .cnt { margin-inline-start: auto; width: 36px; height: 36px; position: relative; display: grid; place-items: center; font-weight: 700; font-size: 13px; }
  .cnt svg { position: absolute; inset: 0; }
  .src { text-align: center; font-size: 11px; color: var(--sec); padding-top: 6px; }
`));
const KINDS = [['morning', 'الصباح', '🌅', 'أذكار الصباح'], ['evening', 'المساء', '🌇', 'أذكار المساء'], ['after', 'بعد الصلاة', '🤲', 'أذكار بعد الصلاة']];
let kind = new URLSearchParams(location.search).get('kind') || 'morning';
let book = null, done = {};
const root = document.getElementById('root');
const page = h('div', { class: 'page content' });
root.append(page);
setTimeout(() => mountSky(root, { moonX: 110, moonY: 40 }), 30);
window.azan.adhkar().then((b) => { book = b; render(); });
window.azan.on('adhkar-kind', (k) => { kind = k; done = {}; render(); });

function counter(left, total) {
  const r = 15, c = 2 * Math.PI * r, v = (total - left) / total;
  const d = h('div', { class: 'cnt' });
  d.innerHTML = `<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="${r}" fill="none" stroke="rgba(247,235,204,.15)" stroke-width="3"/><circle cx="18" cy="18" r="${r}" fill="none" stroke="#ebc266" stroke-width="3" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v)}" transform="rotate(-90 18 18)"/></svg>`;
  d.append(left === 0 ? h('span', { class: 'gold' }, '✓') : h('span', {}, N(left)));
  return d;
}

function render() {
  if (!STATE) return;
  const items = (book && book[kind]) || [];
  const key = (d, i) => `${i}`;
  const fin = items.filter((d, i) => (done[key(d, i)] || 0) >= d.count).length;
  const meta = KINDS.find((k) => k[0] === kind);
  const scroll = page.querySelector('.list')?.scrollTop || 0;
  page.replaceChildren(
    h('div', { class: 'top drag' },
      h('button', { class: 'icon-btn x', onclick: () => window.azan.send('win:close') }, '✕'),
      h('div', { class: 'tabs' }, KINDS.map(([k, t, ic]) => h('button', { class: 'tab' + (k === kind ? ' on' : ''), onclick: () => { kind = k; done = {}; render(); } }, ic, ' ', t))),
      h('h1', {}, meta[3]),
      h('div', { class: 'c' }, `${N(fin)} من ${N(items.length)}`),
      bar(items.length ? fin / items.length : 0)),
    h('div', { class: 'list' },
      items.map((d, i) => {
        const n = done[key(d, i)] || 0, complete = n >= d.count;
        const card = h('div', { class: 'glass dk' + (complete ? ' done' : ''), onclick: () => { if (!complete) { done[key(d, i)] = n + 1; render(); } } });
        if (d.text) card.append(h('div', { class: 'tx' }, d.text));
        else card.append(h('div', { class: 'tt' }, d.title, d.ref ? h('button', { class: 'pill', onclick: (e) => { e.stopPropagation(); window.azan.send('open:url', `https://quran.com/${d.ref}`); } }, '📖 اقرأها في المصحف') : null));
        card.append(h('div', { class: 'ft' }, d.note ? h('span', { class: 'nt' }, d.note) : null, counter(d.count - n, d.count)));
        return card;
      }),
      book && book.source ? h('div', { class: 'src' }, 'المصدر: ' + book.source) : null));
  page.querySelector('.list').scrollTop = scroll;
}
onState(() => { if (book) render(); });
