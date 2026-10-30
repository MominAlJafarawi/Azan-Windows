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

/** whole-window zoom (text and numbers scale together) */
function applyZoom(z) { document.documentElement.style.zoom = String(z || 1); }
window.azan.on('zoom', applyZoom);

/** edge handles: drag the left/right/bottom edge or a bottom corner to resize proportionally */
function enableEdgeResize(host) {
  const st = document.createElement('style');
  st.textContent = `.edge{position:absolute;z-index:50;-webkit-app-region:no-drag}
   .edge.l{left:0;top:0;bottom:0;width:8px;cursor:ew-resize}.edge.r{right:0;top:0;bottom:0;width:8px;cursor:ew-resize}
   .edge.b{left:8px;right:8px;bottom:0;height:8px;cursor:ns-resize}
   .edge.bl{left:0;bottom:0;width:16px;height:16px;cursor:nesw-resize}.edge.br{right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize}`;
  document.head.append(st);
  for (const k of ['l', 'r', 'b', 'bl', 'br']) {
    const e = h('div', { class: 'edge ' + k });
    e.addEventListener('mousedown', (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      const sx = ev.screenX, sy = ev.screenY, w0 = window.outerWidth, aspect = window.outerWidth / window.outerHeight;
      const fromLeft = k === 'l' || k === 'bl';
      const f = (x, y) => {
        const dx = x - sx, dy = y - sy;
        const g = k === 'r' ? dx : k === 'l' ? -dx : k === 'b' ? dy * aspect : k === 'br' ? Math.max(dx, dy * aspect) : Math.max(-dx, dy * aspect);
        return Math.max(0.2, (w0 + g) / w0);
      };
      const move = (m) => window.azan.send('resize:drag', { factor: f(m.screenX, m.screenY), done: false, fromLeft });
      const up = (m) => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); window.azan.send('resize:drag', { factor: f(m.screenX, m.screenY), done: true, fromLeft }); };
      window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    });
    host.append(e);
  }
}

/** the next prayer and how to say it: after Isha it is tomorrow's Fajr */
function nextInfo(inp, now) {
  const nx = Calc.next(inp, now);
  const tomorrow = !isToday(nx.t);
  const ram = Calc.isRamadan(now, S().hijriOffset);
  const title = nx.p === 'sunrise' ? 'الشروق' : (nx.p === 'maghrib' && ram ? 'الإفطار' : `صلاة ${Calc.AR[nx.p]}`);
  const at = `${tomorrow ? 'بكرة' : nx.p === 'sunrise' ? 'الشروق' : 'الأذان'} الساعة ${fmtTime(nx.t)}`;
  return { nx, tomorrow, title, at };
}

/** the alert mode of one prayer as a readable chip; a click moves it on: adhan → silent → off → adhan */
const MODE_CHIP = { adhan: '🔊 أذان', silent: '🔔 صامت', off: '🔕 بدون' };
function modeChip(p) {
  const m = modeOf(p);
  return h('button', { class: `mchip ${m}`, title: `${MODE_AR[m]} · اكبس للتغيير`, onclick: (e) => {
    e.stopPropagation();
    const order = ['adhan', 'silent', 'off'];
    window.azan.set({ modes: { ...S().modes, [p]: order[(order.indexOf(m) + 1) % 3] } });
  } }, MODE_CHIP[m]);
}

/** today's times; the next one is gold. After Isha the Fajr row shows tomorrow's Fajr with "بكرة". */
function prayerList(inp, now, nx) {
  const t = Calc.compute(inp, now);
  const tomorrow = !isToday(nx.t);
  const list = h('div', { class: 'list glass' });
  for (const p of Calc.PRAYERS) {
    const next = p === nx.p;
    const tm = next ? nx.t : t[p];
    const past = !next && t[p] && t[p] <= now;
    list.append(h('div', { class: `row${next ? ' next' : ''}${past ? ' past' : ''}` },
      h('span', { class: 'ic' }, ICON[p]),
      h('span', { class: 'nm' }, Calc.AR[p]),
      next ? h('span', { class: 'badge' }, tomorrow ? 'بكرة' : 'التالية') : null,
      h('span', { class: 'tm num' }, tm ? fmtTime(tm) : '--'),
      modeChip(p)));
  }
  return list;
}

/** gold "new version" notice with the install button; stays until the update is installed (null when none) */
function updatePill(long) {
  const u = STATE && STATE.update;
  if (!u || !u.available) return null;
  const v = String(u.available.version).split('.').map((x) => (/^\d+$/.test(x) ? N(Number(x)) : x)).join('.');
  if (u.progress != null) {
    return h('div', { class: 'upd-pill busy' }, h('i', { class: 'gdot' }),
      h('span', { class: 'tx' }, u.progress < 1 ? `عم ينزّل… ${N(Math.round(u.progress * 100))}٪` : 'عم يثبّت، وبيرجع يفتح لحاله…'));
  }
  const err = u.error && !u.checking;
  return h('div', { class: 'upd-pill' + (err ? ' err' : ''), title: err ? u.error : `نسخة جديدة من أذان: ${v} (عندك ${STATE.version})` }, h('i', { class: 'gdot' }),
    h('span', { class: 'tx' }, err ? u.error : `نسخة جديدة ${v}${long ? ' جاهزة' : ''}`),
    h('button', { onclick: () => window.azan.send('update:install') }, err ? 'جرّب تاني' : 'حدّث هلأ'));
}

/** khatma card (home and panel). openPage(p) opens the mushaf on that page. */
function khatmaCard(openPage, withRing = true) {
  const s = S();
  const k = Calc.khatma(s.khatmaDays, s.khatmaStart, s.khatmaRead, new Date(), s.khatmaBase);
  const body = h('div', { style: { flex: '1', minWidth: '0' } }, h('h3', {}, 'وردي من القرآن'));
  if (k.finished) {
    body.append(h('div', { class: 'p' }, 'ختمت القرآن، تقبّل الله منك'),
      h('div', { class: 'btns' }, h('button', { class: 'pill gold-fill', onclick: () => window.azan.send('khatma:new') }, 'ابدأ ختمة جديدة')));
  } else {
    const [a, b] = k.portion;
    body.append(h('div', { class: 'p' }, `صفحة ${N(a)}–${N(b)} · سورة ${Calc.surahOnPage(a)}`),
      h('div', { class: 'b', style: k.behind === 0 ? { color: 'var(--gold)' } : {} }, k.behind === 0 ? 'أنت على الموعد، ما شاء الله' : `باقي عليك اليوم ${N(k.behind)} صفحة`),
      h('div', { class: 'btns' },
        h('button', { class: 'pill gold-fill', onclick: () => window.azan.send('khatma:read', b) }, '✓ قرأت'),
        h('button', { class: 'pill', onclick: () => openPage(a) }, '📖 افتح المصحف'),
        k.replan ? h('button', { class: 'pill replan', title: `خطة جديدة من اليوم: نفس الورد (${N(Math.ceil(k.perDay))} صفحة باليوم) من الصفحة ${N(s.khatmaRead + 1)}`, onclick: () => window.azan.send('khatma:replan') }, '↻ رتّب الختمة من جديد') : null));
  }
  return h('div', { class: 'glass card kh' }, withRing ? ring(s.khatmaRead / Calc.PAGES) : null, body);
}
function ring(v) {
  const r = 24, c = 2 * Math.PI * r;
  const d = h('div');
  d.innerHTML = `<svg class="ring" viewBox="0 0 56 56"><circle cx="28" cy="28" r="${r}" fill="none" stroke="rgba(247,235,204,.14)" stroke-width="5"/>
    <circle cx="28" cy="28" r="${r}" fill="none" stroke="#ebc266" stroke-width="5" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.max(0.02, v))}" transform="rotate(-90 28 28)"/>
    <text x="28" y="33" text-anchor="middle" font-size="13" font-weight="700" fill="#f7ebcc">${N(Math.round(v * 100))}٪</text></svg>`;
  return d.firstChild;
}
