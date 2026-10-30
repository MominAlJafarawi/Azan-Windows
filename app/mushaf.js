// Mushaf tab of the main window: the whole Quran offline, one Madani page at a time (Tanzil Uthmani text).
let quranPromise = null;
/** the Quran text and page data, loaded once per window */
function loadQuran() {
  if (!quranPromise) quranPromise = window.azan.quran().then((d) => (d && d.text && d.meta ? Quran.build(d.text, d.meta) : null));
  return quranPromise;
}

(function () {
document.head.append(h('style', {}, `
  .v-quran { height: 100%; display: flex; flex-direction: column; gap: 12px; }
  .v-quran .qbar { flex: none; display: flex; gap: 8px; align-items: center; position: relative; }
  .v-quran .search { flex: 1; min-width: 0; padding: 9px 14px; border-radius: 12px; background: rgba(247,235,204,.07); border: 1px solid rgba(235,194,102,.3); color: var(--text); font: inherit; font-size: 15px; outline: none; }
  .v-quran .search:focus { border-color: var(--gold); }
  .v-quran .search::placeholder { color: var(--sec); opacity: .8; }
  .v-quran .qbar .pill { font-size: 14px; padding: 8px 14px; white-space: nowrap; border: 1px solid rgba(235,194,102,.3); }
  .v-quran .qbar .pill.on { background: var(--gold); color: var(--ink); }
  .v-quran .hits { position: absolute; top: 46px; right: 0; left: 0; z-index: 20; max-height: 300px; overflow-y: auto; padding: 6px; background: #141a42; border: 1px solid rgba(235,194,102,.45); border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,.45); }
  .v-quran .hit { width: 100%; display: flex; gap: 12px; align-items: center; padding: 8px 12px; border-radius: 10px; text-align: start; font-size: 15px; }
  .v-quran .hit:hover, .v-quran .hit.sel { background: rgba(235,194,102,.18); }
  .v-quran .hit .nm { font-family: var(--naskh); font-size: 19px; font-weight: 700; }
  .v-quran .hit .pg { margin-inline-start: auto; color: var(--sec); font-size: 13px; }
  .v-quran .pagebox { position: relative; flex: 1; min-height: 0; overflow-y: auto; padding: 22px 26px; border-radius: 18px; background: rgba(9,14,38,.94); backdrop-filter: blur(18px); border: 1px solid rgba(235,194,102,.35); box-shadow: 0 4px 14px rgba(0,0,0,.22); }
  .v-quran .text { color: #fbf1d6; font-family: var(--naskh); font-size: 27px; line-height: 2.1; text-align: justify; text-align-last: start; user-select: text; }
  .v-quran .text .n { color: var(--gold); font-size: 23px; white-space: nowrap; }
  .v-quran .shdr { text-align: center; font-family: var(--naskh); font-weight: 700; font-size: 23px; color: var(--gold); border: 1px solid rgba(235,194,102,.55); border-radius: 12px; padding: 4px 0; margin: 4px 0 6px;
    background: linear-gradient(90deg, transparent, rgba(235,194,102,.1), transparent); box-shadow: inset 0 0 0 3px rgba(11,16,48,.6), inset 0 0 0 4px rgba(235,194,102,.25); }
  .v-quran .bsm { text-align: center; font-family: var(--naskh); font-size: 25px; line-height: 2; margin-bottom: 2px; }
  .v-quran .meta { flex: none; display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--sec); }
  .v-quran .meta .mk { font-size: 15px; width: 30px; height: 30px; }
  .v-quran .meta .mk.on { background: var(--gold); }
  .v-quran .nav { margin-inline-start: auto; display: flex; gap: 8px; }
  .v-quran .nav .pill { font-size: 14px; padding: 7px 15px; }
  .v-quran .nav .pill[disabled] { opacity: .35; pointer-events: none; }
  .v-quran .wird { flex: none; padding: 12px 16px; display: flex; align-items: center; gap: 14px; font-size: 15px; }
  .v-quran .wird .w { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 7px; cursor: pointer; }
  .v-quran .wird .bar { width: min(240px, 100%); }
  .v-quran .credit { flex: none; text-align: center; font-size: 12px; color: var(--sec); opacity: .85; margin-top: -4px; }
  .v-quran .credit a { color: var(--sec); }
  .v-quran .fih { display: flex; flex-direction: column; gap: 2px; }
  .v-quran .fih .row { display: flex; align-items: center; gap: 14px; padding: 8px 12px; border-radius: 12px; text-align: start; width: 100%; font-size: 14px; color: var(--sec); }
  .v-quran .fih .row:hover { background: rgba(235,194,102,.14); }
  .v-quran .fih .row.cur { background: var(--gold-soft); border: 1px solid rgba(235,194,102,.6); }
  .v-quran .fih .no { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; border: 1px solid rgba(235,194,102,.5); color: var(--gold); font-size: 13px; flex: none; }
  .v-quran .fih .nm { font-family: var(--naskh); font-size: 21px; font-weight: 700; color: var(--text); min-width: 110px; }
  .v-quran .fih .pg { margin-inline-start: auto; }
  .v-quran .fih h3 { font-family: var(--naskh); color: var(--gold); font-size: 22px; text-align: center; margin-bottom: 8px; }
  .v-quran .loading { margin: auto; text-align: center; color: var(--sec); font-size: 16px; padding: 40px; }
`));

let Q = null, page = 1, index = false, el = null, nav = () => {}, replace = () => {};
let search, hitsBox, idxBtn, bmBtn, box, metaRow, wirdRow, hits = [], hitSel = 0, sig = '';

function mount(host, { navigate, replacePlace } = {}) {
  nav = navigate || nav; replace = replacePlace || replace;
  search = h('input', { class: 'search', type: 'text', placeholder: '🔍 ابحث عن سورة أو اكتب رقم صفحة…', oninput: onSearch, onkeydown: searchKey });
  hitsBox = h('div', { class: 'hits', style: { display: 'none' } });
  idxBtn = h('button', { class: 'pill', onclick: () => nav({ tab: 'quran', page, index: !index }) }, '📑 الفهرس');
  bmBtn = h('button', { class: 'pill', onclick: goBookmark });
  box = h('div', { class: 'pagebox' }, h('div', { class: 'loading' }, 'عم يفتح المصحف…'));
  metaRow = h('div', { class: 'meta' });
  wirdRow = h('div', { class: 'glass wird', style: { display: 'none' } });
  el = h('div', { class: 'v-quran' }, h('div', { class: 'qbar' }, search, idxBtn, bmBtn, hitsBox), box, metaRow, wirdRow,
    h('div', { class: 'credit' }, 'نص المصحف: مشروع تنزيل ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); window.azan.send('open:url', 'https://tanzil.net'); } }, 'tanzil.net')));
  host.append(el);
  document.addEventListener('mousedown', (e) => { if (!hitsBox.contains(e.target) && e.target !== search) hideHits(); });
  loadQuran().then((q) => { Q = q; draw(); });
}

const sname = (s) => Calc.SURAH_NAMES[s - 1];
const verseNo = (a) => h('span', { class: 'n' }, `﴿${N(a)}﴾`);

function drawPage() {
  const parts = [];
  let para = null;
  for (const [s, a, t] of Quran.pageVerses(Q, page)) {
    if (a === 1) {
      para = null;
      parts.push(h('div', { class: 'shdr' }, `سورة ${sname(s)}`));
      if (s !== 1 && s !== 9) parts.push(h('div', { class: 'bsm' }, Quran.BASMALA));
    }
    if (!para) { para = h('div', { class: 'text' }); parts.push(para); }
    para.append(Quran.verseText(s, a, t), ' ', verseNo(a), ' ');
  }
  return parts;
}

function drawIndex() {
  const cur = Calc.surahOnPage(page);
  const rows = Q.meta.suras.map(([, ayas, type], i) => {
    const s = i + 1, start = Quran.surahStartPage(Q, s);
    return h('button', { class: 'row' + (sname(s) === cur ? ' cur' : ''), onclick: () => nav({ tab: 'quran', page: start, index: false }) },
      h('span', { class: 'no' }, N(s)), h('span', { class: 'nm' }, sname(s)),
      h('span', {}, `${type === 'Meccan' ? 'مكية' : 'مدنية'} · ${N(ayas)} آية`), h('span', { class: 'pg' }, `صفحة ${N(start)}`));
  });
  return [h('div', { class: 'fih' }, h('h3', {}, 'فهرس السور'), ...rows)];
}

function drawMeta() {
  const s = S(), bm = s.quranBookmark || 0;
  bmBtn.replaceChildren(bm ? `🔖 علامتي · ${N(bm)}` : '🔖 علامتي');
  bmBtn.title = bm ? `افتح صفحة ${N(bm)}` : 'ما في علامة بعد: حط علامة من الزر جنب رقم الصفحة';
  idxBtn.classList.toggle('on', index);
  if (index) { metaRow.replaceChildren(h('span', {}, `${N(114)} سورة · ${N(Quran.PAGES)} صفحة`)); return; }
  metaRow.replaceChildren(
    h('button', { class: 'icon-btn mk' + (bm === page ? ' on' : ''), title: bm === page ? 'هون علامتك' : 'حط علامتي على هالصفحة', onclick: () => window.azan.set({ quranBookmark: page }) }, '🔖'),
    h('span', {}, `صفحة ${N(page)} · الجزء ${N(Quran.juzOfPage(Q, page))} · سورة ${Calc.surahOnPage(page)}`),
    h('div', { class: 'nav' },
      h('button', { class: 'pill', disabled: page <= 1, onclick: () => flip(-1) }, '→ السابقة'),
      h('button', { class: 'pill', disabled: page >= Quran.PAGES, onclick: () => flip(1) }, 'التالية ←')));
}

function drawWird() {
  const s = S();
  if (!s.khatmaOn) { wirdRow.style.display = 'none'; return; }
  wirdRow.style.display = '';
  const k = Calc.khatma(s.khatmaDays, s.khatmaStart, s.khatmaRead, new Date(), s.khatmaBase);
  if (k.finished) {
    wirdRow.replaceChildren(h('div', { class: 'w' }, 'ختمت القرآن، تقبّل الله منك'),
      h('button', { class: 'pill gold-fill', onclick: () => window.azan.send('khatma:new') }, 'ابدأ ختمة جديدة'));
    return;
  }
  const [a, b] = k.portion;
  // how far into today's portion the open page is (0 when reading somewhere else)
  const v = page >= a && page <= b ? (page - a + 1) / (b - a + 1) : 0;
  wirdRow.replaceChildren(
    h('div', { class: 'w', title: `افتح صفحة ${N(a)}`, onclick: () => { if (page < a || page > b) nav({ tab: 'quran', page: a, index: false }); } },
      h('span', {}, `وردك اليوم: صفحة ${N(a)}–${N(b)}`), bar(v)),
    h('button', { class: 'pill gold-fill', onclick: () => window.azan.send('khatma:read', b) }, '✓ قرأت'));
}

function draw() {
  if (!el || !STATE) return;
  if (!Q) { drawMeta0(); return; }
  sig = sigOf();
  const top = index ? box.scrollTop : 0;
  box.replaceChildren(...(index ? drawIndex() : drawPage()));
  box.scrollTop = index ? top : 0;
  if (index && !top) {
    // centre the current sura once the Amiri font has its final size
    const centre = () => { const c = box.querySelector('.row.cur'); if (c && index) box.scrollTop = c.offsetTop - box.clientHeight / 2 + c.offsetHeight / 2; };
    centre(); document.fonts.ready.then(() => requestAnimationFrame(centre));
  }
  drawMeta();
  drawWird();
  window.azan.send('mushaf:rendered', { page, index, verses: index ? 0 : Quran.pageVerses(Q, page).length });
}
function drawMeta0() { if (!STATE) return; bmBtn.replaceChildren('🔖 علامتي'); }
const sigOf = () => { const s = S(); return [s.latinDigits, s.khatmaOn, s.khatmaDays, s.khatmaStart, s.khatmaRead, s.khatmaBase, s.quranBookmark].join('|'); };
/** state broadcasts arrive every few seconds: only redraw when something shown here changed */
function render() { if (!Q || !STATE || !el) return; if (sigOf() !== sig) { const t = box.scrollTop; draw(); if (!index) box.scrollTop = t; } }

function flip(d) {
  const p = Quran.clampPage(page + d);
  if (p === page) return;
  page = p; index = false;
  replace({ tab: 'quran', page, index: false });
  window.azan.set({ quranPage: page });
  draw();
}
function goBookmark() {
  const bm = S().quranBookmark || 0;
  if (!bm) { window.azan.set({ quranBookmark: page }); return; }
  if (bm !== page || index) nav({ tab: 'quran', page: bm, index: false });
}

// ---- search: a number jumps to that page, a name lists matching suras
let jumpT = null;
function onSearch() {
  const q = search.value.trim();
  const digits = q.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6f0));
  if (/^\d{1,3}$/.test(digits)) {
    const p = Number(digits);
    hideHits();
    // wait until the number is complete (typing 2-9-3 should not visit pages 2 and 29)
    clearTimeout(jumpT);
    jumpT = setTimeout(() => { if (p >= 1 && p <= Quran.PAGES && Q && (p !== page || index)) nav({ tab: 'quran', page: p, index: false }); }, 450);
    return;
  }
  clearTimeout(jumpT);
  const nq = Quran.norm(q);
  if (!nq || !Q) { hideHits(); return; }
  hits = Calc.SURAH_NAMES.map((n, i) => ({ s: i + 1, n })).filter((x) => Quran.norm(x.n).includes(nq) || Quran.norm(Q.meta.suras[x.s - 1][0]).includes(nq));
  hitSel = 0;
  showHits();
}
function showHits() {
  if (!hits.length) { hitsBox.replaceChildren(h('div', { class: 'hit' }, 'ما في سورة بهالاسم')); hitsBox.style.display = ''; return; }
  hitsBox.replaceChildren(...hits.map((x, i) => h('button', { class: 'hit' + (i === hitSel ? ' sel' : ''), onclick: () => pickHit(x) },
    h('span', { class: 'nm' }, `سورة ${x.n}`), h('span', { class: 'sec' }, N(x.s)), h('span', { class: 'pg' }, `صفحة ${N(Quran.surahStartPage(Q, x.s))}`))));
  hitsBox.style.display = '';
}
function hideHits() { if (hitsBox) hitsBox.style.display = 'none'; }
function pickHit(x) { hideHits(); search.value = ''; nav({ tab: 'quran', page: Quran.surahStartPage(Q, x.s), index: false }); }
function searchKey(e) {
  if (hitsBox.style.display === 'none' || !hits.length) { if (e.key === 'Escape') { search.value = ''; search.blur(); } return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); hitSel = (hitSel + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length; showHits(); }
  else if (e.key === 'Enter') pickHit(hits[hitSel]);
  else if (e.key === 'Escape') hideHits();
}

/** keyboard: left = next page, right = previous (the mushaf turns right to left) */
function key(e) {
  if (index || !Q || (e.target.matches && e.target.matches('input, select, textarea'))) return false;
  if (e.key === 'ArrowLeft') { flip(1); return true; }
  if (e.key === 'ArrowRight') { flip(-1); return true; }
  return false;
}

/** show a page or the index (called by the main window's navigation) */
function show(p, idx) {
  const np = p ? Quran.clampPage(p) : page;
  const changed = np !== page || !!idx !== index;
  page = np; index = !!idx;
  if (!index && STATE && S().quranPage !== page) window.azan.set({ quranPage: page });
  if (changed || !sig) draw(); else render();
}
function init(p) { page = Quran.clampPage(p || 1); }
window.MushafView = { mount, render, show, key, init, sub: () => ({ page, index }) };
})();
