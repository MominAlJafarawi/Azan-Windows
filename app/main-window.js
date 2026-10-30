// Main window "أذان": tabs (home, adhkar, mushaf, settings) and a back button that walks the places visited here.
document.head.append(h('style', {}, `
  html, body.main { height: 100%; background: var(--bottom); }
  body.main #root { position: relative; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
  .mtop { position: relative; z-index: 1; display: flex; align-items: center; gap: 12px; padding: 20px 22px 12px; flex: none; }
  .mtop .back { display: inline-flex; align-items: center; gap: 6px; padding: 7px 15px; border-radius: 999px; border: 1px solid rgba(235,194,102,.45); background: rgba(247,235,204,.08); font-size: 15px; font-weight: 600; }
  .mtop .back[disabled] { opacity: .35; cursor: default; }
  .mtop .ttl { font-family: var(--naskh); font-size: 27px; font-weight: 700; color: var(--gold); text-shadow: 0 0 10px rgba(235,194,102,.3); }
  .mtop .sp { flex: 1; }
  .mtop .cd { font-size: 14px; color: var(--sec); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .mtop .cd b { color: var(--text); font-weight: 600; }
  .mtop .wb { display: flex; gap: 6px; margin-inline-start: 6px; }
  .mtop .upd { display: flex; flex: none; }
  .mtop .back, .mtop .ttl { white-space: nowrap; flex: none; }
  .mtabs .tab .gdot { width: 8px; height: 8px; }
  .mtabs { position: relative; z-index: 1; display: flex; gap: 8px; flex-wrap: wrap; padding: 0 22px 14px; border-bottom: 1px solid rgba(235,194,102,.2); flex: none; }
  .mtabs .tab { font-size: 15px; padding: 8px 17px; }
  .mbody { position: relative; z-index: 1; flex: 1; min-height: 0; padding: 18px 22px 20px; }
  .mbody .view { height: 100%; display: none; }
  .mbody .view.on { display: block; }
  /* reading the mushaf: plain even navy, nothing moving or shining behind the text (same as the Mac) */
  body.reading .sky .star, body.reading .sky .meteor, body.reading .sky .moon, body.reading .sky .moon-glow { display: none; }
  body.reading .sky::after { display: none; }
`));

const TABS = [['home', 'الرئيسية', '🕌'], ['adhkar', 'الأذكار', '🤲'], ['quran', 'المصحف', '📖'], ['settings', 'الإعدادات', '⚙️']];
const VIEWS = { home: HomeView, adhkar: AdhkarView, quran: MushafView, settings: SettingsView };
const rootEl = document.getElementById('root');
const backBtn = h('button', { class: 'back', title: 'رجوع للمكان اللي كنت فيه', onclick: back }, '→ رجوع');
const cdEl = h('span', { class: 'cd' });
const updEl = h('div', { class: 'upd nodrag' });
const tabsEl = h('div', { class: 'mtabs' });
const bodyEl = h('div', { class: 'mbody' });
rootEl.append(
  h('div', { class: 'mtop drag' }, backBtn, h('span', { class: 'ttl' }, 'أذان'), h('span', { class: 'sp' }), cdEl, updEl,
    h('div', { class: 'wb' },
      h('button', { class: 'icon-btn', title: 'تصغير', onclick: () => window.azan.send('win:min') }, '—'),
      h('button', { class: 'icon-btn', title: 'إغلاق', onclick: () => window.azan.send('win:close') }, '✕'))),
  tabsEl, bodyEl);

const hosts = {};
let active = null, started = false;
const trail = [];

for (const [k] of TABS) { hosts[k] = h('div', { class: 'view' }); bodyEl.append(hosts[k]); }
const opts = { navigate: (p) => nav(p), replacePlace: () => {} };
HomeView.mount(hosts.home, opts);
AdhkarView.mount(hosts.adhkar, opts);
MushafView.mount(hosts.quran, opts);
SettingsView.mount(hosts.settings, { ...opts, onSubChange: (k) => nav({ tab: 'settings', sub: k }) });

/** where we are now: tab + its own state (adhkar list, mushaf page or index, settings section) */
function here() {
  if (!active) return null;
  const sub = VIEWS[active].sub();
  if (active === 'adhkar') return { tab: 'adhkar', kind: sub };
  if (active === 'quran') return { tab: 'quran', page: sub.page, index: sub.index };
  if (active === 'settings') return { tab: 'settings', sub };
  return { tab: 'home' };
}
const same = (a, b) => a && b && a.tab === b.tab && (a.kind || '') === (b.kind || '') && (a.sub || '') === (b.sub || '')
  && (a.tab !== 'quran' || (a.page === b.page && !!a.index === !!b.index));

function go(p) {
  active = TABS.some((t) => t[0] === p.tab) ? p.tab : 'home';
  for (const k in hosts) hosts[k].classList.toggle('on', k === active);
  document.body.classList.toggle('reading', active === 'quran');
  if (active === 'adhkar') AdhkarView.show(p.kind, p.fresh);
  else if (active === 'quran') MushafView.show(p.page, p.index);
  else if (active === 'settings') SettingsView.show(p.sub);
  else HomeView.render();
  drawChrome();
}
/** go somewhere and remember where we were */
function nav(p) {
  const cur = here();
  const target = { ...p };
  if (target.tab === 'quran' && target.page == null && !target.index) target.page = MushafView.sub().page;
  if (cur && !same(cur, { ...cur, ...target })) { trail.push(cur); if (trail.length > 60) trail.shift(); }
  go(target);
}
function back() {
  const p = trail.pop();
  if (p) go(p);
}

function drawChrome() {
  const updDot = !!(STATE && STATE.update && STATE.update.available);
  tabsEl.replaceChildren(...TABS.map(([k, t, ic]) => h('button', { class: 'tab' + (k === active ? ' on' : ''), title: k === 'settings' && updDot ? 'في نسخة جديدة' : null, onclick: () => { if (k !== active) nav({ tab: k }); } },
    ic, ' ', t, k === 'settings' && updDot ? h('i', { class: 'gdot' }) : null)));
  backBtn.disabled = trail.length === 0;
  if (!STATE) return;
  // update notice in the top bar (gold pill with the install button)
  const pill = updatePill(false);
  updEl.replaceChildren(...(pill ? [pill] : []));
  const inp = input();
  // the home tab shows the countdown big in its card, so the header does not repeat it there
  // (and in a narrow window with the update notice there is no room for it at all)
  if (!inp || active === 'home' || (pill && window.innerWidth < 660)) { cdEl.replaceChildren(); return; }
  const now = new Date(), nx = Calc.next(inp, now);
  const name = nx.p === 'maghrib' && Calc.isRamadan(now, S().hijriOffset) ? 'الإفطار' : Calc.AR[nx.p];
  // next to the update notice there is less room: short countdown only
  cdEl.replaceChildren(h('b', {}, name), ' ', pill ? Calc.countdown((nx.t - now) / 1000, latin()) : `${Calc.countdownLong((nx.t - now) / 1000, latin())} · ${fmtTime(nx.t)}`);
}

// first place: from the URL (the window was opened for something), otherwise home
const first = (() => { try { return JSON.parse(new URLSearchParams(location.search).get('nav') || 'null'); } catch (_) { return null; } })() || { tab: 'home' };
onState(() => {
  if (!started) { started = true; MushafView.init(S().quranPage); go(first); return; }
  drawChrome();
  if (active) VIEWS[active].render();
});
// another window asked for a place (khatma "open the mushaf", adhkar reminder, settings…)
window.azan.on('nav', (p) => { if (!started) { Object.assign(first, p); return; } nav(p); });

document.addEventListener('keydown', (e) => {
  if (active === 'quran' && MushafView.key(e)) { e.preventDefault(); return; }
  if (e.altKey && e.key === 'ArrowRight' && !(e.target.matches && e.target.matches('input, textarea'))) { e.preventDefault(); back(); }
});

// night sky behind everything, redrawn when the window size changes
let skyT = null, skySize = '';
function sky() {
  const sz = `${rootEl.clientWidth}x${rootEl.clientHeight}`;
  if (sz === skySize) return;
  skySize = sz;
  rootEl.querySelector(':scope > .sky')?.remove();
  mountSky(rootEl, { moonX: Math.round(rootEl.clientWidth * 0.6), moonY: 34 });
}
setTimeout(sky, 30);
window.addEventListener('resize', () => { clearTimeout(skyT); skyT = setTimeout(() => { sky(); drawChrome(); }, 250); });
