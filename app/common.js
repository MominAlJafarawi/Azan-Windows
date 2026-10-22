// Shared helpers for every window: element builder, night sky, state, prayer data.
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
};

const ICON = { fajr: '🌄', sunrise: '🌅', dhuhr: '☀️', asr: '🌤️', maghrib: '🌇', isha: '🌙' };
const MODE_ICON = { adhan: '🔊', silent: '🔔', off: '🔕' };
const MODE_AR = { adhan: 'أذان', silent: 'تنبيه صامت', off: 'بدون' };

/** night sky: stars (a few golden), breathing crescent, a shooting star */
function mountSky(el, { moonX = 34, moonY = 60 } = {}) {
  const sky = h('div', { class: 'sky' });
  const w = el.clientWidth || 400, ht = el.clientHeight || 300;
  let seed = 987654321;
  const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) % 10000) / 10000; };
  const n = Math.round((w * ht) / 1500);
  for (let i = 0; i < n; i++) {
    const d = 0.8 + rnd() * 2;
    sky.append(h('i', { class: 'star' + (i % 7 === 0 ? ' g' : ''), style: { width: d + 'px', height: d + 'px', left: rnd() * w + 'px', top: rnd() * ht + 'px', '--d': 1.4 + rnd() * 3 + 's', '--o': -rnd() * 4 + 's' } }));
  }
  sky.append(h('div', { class: 'moon-glow', style: { left: moonX - 60 + 'px', top: moonY - 60 + 'px' } }));
  sky.append(h('div', { class: 'moon', style: { left: moonX - 13 + 'px', top: moonY - 13 + 'px' } }));
  sky.append(h('div', { class: 'meteor' }));
  el.prepend(sky);
}

let STATE = null;
const listeners = [];
function onState(fn) { listeners.push(fn); if (STATE) fn(STATE); }
window.azan.state().then((s) => { STATE = s; listeners.forEach((f) => f(s)); });
window.azan.onState((s) => { STATE = s; listeners.forEach((f) => f(s)); });

const S = () => STATE.settings;
const latin = () => !!STATE.settings.latinDigits;
function input(ramadan) {
  const s = S();
  if (s.lat == null || s.lon == null) return null;
  return { lat: s.lat, lon: s.lon, method: STATE.effMethod, school: s.school, highLat: s.highLat, offsets: s.offsets, ramadan: ramadan ?? Calc.isRamadan(new Date(), s.hijriOffset) };
}
const modeOf = (p) => S().modes[p] || (p === 'sunrise' ? 'off' : 'adhan');
const fmtTime = (d) => Calc.time(d, latin(), S().use24h);
const N = (n) => Calc.num(n, latin());
function progress(inp, now) {
  const a = Calc.previous(inp, now).t, b = Calc.next(inp, now).t;
  return Math.min(1, Math.max(0, (now - a) / (b - a)));
}
const isToday = (d) => d.toDateString() === new Date().toDateString();
const bar = (v) => h('div', { class: 'bar' }, h('i', { style: { width: Math.max(2, v * 100) + '%' } }));
