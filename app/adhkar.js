// Adhkar tab of the main window (Hisn al-Muslim): tap a card to count. Quran passages are written out from the offline mushaf.
(function () {
document.head.append(h('style', {}, `
  .v-adhkar { height: 100%; display: flex; flex-direction: column; }
  .v-adhkar .atop { flex: none; display: flex; align-items: center; gap: 14px; padding-bottom: 14px; flex-wrap: wrap; }
  .v-adhkar .sub { display: flex; gap: 6px; }
  .v-adhkar .sub button { padding: 7px 15px; border-radius: 999px; font-size: 15px; background: rgba(247,235,204,.08); border: 1px solid transparent; }
  .v-adhkar .sub button.on { background: rgba(235,194,102,.25); color: var(--gold); font-weight: 700; border-color: rgba(235,194,102,.45); }
  .v-adhkar .prog { margin-inline-start: auto; display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--sec); }
  .v-adhkar .prog .bar { width: 120px; }
  .v-adhkar .list { flex: 1; overflow-y: auto; padding: 0 2px 20px; display: flex; flex-direction: column; gap: 12px; }
  .v-adhkar .dk { padding: 16px 18px; text-align: start; display: flex; flex-direction: column; gap: 10px; transition: opacity .2s; cursor: pointer; }
  .v-adhkar .dk.done { opacity: .6; border-color: rgba(235,194,102,.5); }
  .v-adhkar .dk .tx { font-family: var(--naskh); font-size: 22px; line-height: 2; user-select: text; }
  .v-adhkar .dk .tt { display: flex; align-items: center; gap: 10px; font-family: var(--naskh); font-weight: 700; font-size: 21px; color: var(--gold); }
  .v-adhkar .dk .tt .times { margin-inline-start: auto; font-family: var(--sans); font-weight: 500; font-size: 13px; color: var(--sec); }
  .v-adhkar .dk .bsm { font-family: var(--naskh); font-size: 19px; text-align: center; color: var(--sec); }
  .v-adhkar .dk .ayah { font-family: var(--naskh); font-size: 23px; line-height: 2.05; text-align: justify; user-select: text; }
  .v-adhkar .dk .ayah .n { color: var(--gold); font-size: 20px; white-space: nowrap; }
  .v-adhkar .dk .ft { display: flex; align-items: center; gap: 10px; }
  .v-adhkar .dk .nt { font-size: 13px; color: var(--sec); }
  .v-adhkar .dk .go { font-size: 12px; padding: 4px 10px; }
  .v-adhkar .cnt { margin-inline-start: auto; width: 40px; height: 40px; position: relative; display: grid; place-items: center; font-weight: 700; font-size: 14px; flex: none; }
  .v-adhkar .cnt svg { position: absolute; inset: 0; }
  .v-adhkar .src { text-align: center; font-size: 12px; color: var(--sec); padding-top: 6px; }
`));
const KINDS = [['morning', 'الصباح', '🌅'], ['evening', 'المساء', '🌇'], ['after', 'بعد الصلاة', '✨']];
let kind = 'morning', book = null, Q = null, el = null, top = null, list = null, nav = () => {};
const done = { morning: {}, evening: {}, after: {} };

function mount(host, { navigate } = {}) {
  nav = navigate || nav;
  top = h('div', { class: 'atop' });
  list = h('div', { class: 'list' });
  el = h('div', { class: 'v-adhkar' }, top, list);
  host.append(el);
  window.azan.adhkar().then((b) => { book = b; render(); });
  loadQuran().then((q) => { Q = q; render(); });
}

function counter(left, total) {
  const r = 17, c = 2 * Math.PI * r, v = (total - left) / total;
  const d = h('div', { class: 'cnt' });
  d.innerHTML = `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="${r}" fill="none" stroke="rgba(247,235,204,.15)" stroke-width="3"/><circle cx="20" cy="20" r="${r}" fill="none" stroke="#ebc266" stroke-width="3" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v)}" transform="rotate(-90 20 20)"/></svg>`;
  d.append(left === 0 ? h('span', { class: 'gold' }, '✓') : h('span', {}, N(left)));
  return d;
}
const timesText = (n) => (n === 1 ? 'مرة واحدة' : n === 2 ? 'مرتين' : `${N(n)} مرات`);

/** Quran passage inside a card: the verses, then "البقرة ٢٥٥" */
function passage(d) {
  const r = Q && Quran.ref(Q, d.ref);
  if (!r) return { body: [h('div', { class: 'nt' }, 'عم يحمّل نص المصحف…')], label: null, page: null };
  const whole = r.from === 1 && r.to === Q.meta.suras[r.s - 1][1];
  const box = h('div', { class: 'ayah' });
  r.verses.forEach(([s, a, t]) => box.append(Quran.verseText(s, a, t), ' ', h('span', { class: 'n' }, `﴿${N(a)}﴾`), ' '));
  const name = Calc.SURAH_NAMES[r.s - 1];
  return {
    body: [whole && r.s !== 1 && r.s !== 9 ? h('div', { class: 'bsm' }, Quran.BASMALA) : null, box],
    label: r.from === r.to ? `${name} ${N(r.from)}` : `${name} ${N(r.from)}–${N(r.to)}`,
    page: Quran.pageOf(Q, r.s, r.from),
  };
}

function render() {
  if (!STATE || !el) return;
  const items = (book && book[kind]) || [];
  const dn = done[kind];
  const fin = items.filter((d, i) => (dn[i] || 0) >= d.count).length;
  top.replaceChildren(
    h('div', { class: 'sub' }, KINDS.map(([k, t, ic]) => h('button', { class: k === kind ? 'on' : '', onclick: () => { if (k !== kind) nav({ tab: 'adhkar', kind: k }); } }, ic, ' ', t))),
    h('div', { class: 'prog' }, `${N(fin)} من ${N(items.length)}`, bar(items.length ? fin / items.length : 0)));
  const scroll = list.scrollTop;
  list.replaceChildren(
    ...items.map((d, i) => {
      const n = dn[i] || 0, complete = n >= d.count;
      const card = h('div', { class: 'glass dk' + (complete ? ' done' : ''), onclick: () => { if (!complete && !String(window.getSelection())) { dn[i] = n + 1; render(); } } });
      let foot = d.note ? h('span', { class: 'nt' }, d.note) : null;
      if (d.text) card.append(h('div', { class: 'tx' }, d.text));
      else {
        const p = passage(d);
        card.append(h('div', { class: 'tt' }, d.title, h('span', { class: 'times' }, timesText(d.count))), ...p.body.filter(Boolean));
        if (p.label) foot = h('span', { class: 'nt' }, p.label, d.note ? ` · ${d.note}` : '');
        if (p.page) card.append(h('div', { class: 'ft' }, foot, h('button', { class: 'pill go', title: 'افتح الصفحة بالمصحف', onclick: (e) => { e.stopPropagation(); nav({ tab: 'quran', page: p.page, index: false }); } }, '📖 بالمصحف'), counter(d.count - n, d.count)));
        else card.append(h('div', { class: 'ft' }, foot, counter(d.count - n, d.count)));
        return card;
      }
      card.append(h('div', { class: 'ft' }, foot, counter(d.count - n, d.count)));
      return card;
    }),
    book && book.source ? h('div', { class: 'src' }, 'المصدر: ' + book.source) : h('div'));
  list.scrollTop = scroll;
}

/** show a list (called by the main window's navigation); fresh = opened from a reminder, counting starts again */
function show(k, fresh) {
  const nk = KINDS.some((x) => x[0] === k) ? k : kind;
  if (nk !== kind) { kind = nk; if (list) list.scrollTop = 0; }
  if (fresh) { done[kind] = {}; if (list) list.scrollTop = 0; }
  render();
}
window.AdhkarView = { mount, render, show, sub: () => kind };
})();
