// Corner card for every event (adhan, reminder, after prayer, adhkar, Friday, suhoor).
document.head.append(h('style', {}, `
  html, body, #root { width: 100%; height: 100%; }
  #root { display: flex; align-items: flex-end; padding: 8px; }
  .frame { width: 100%; border-radius: 22px; }
  .content { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
  .hd { display: flex; gap: 12px; align-items: flex-start; }
  .hd .ic { font-size: 26px; width: 34px; text-align: center; }
  .hd h2 { font-family: var(--naskh); font-weight: 700; font-size: 25px; line-height: 1.3; }
  .hd p { font-size: 14px; color: var(--sec); margin-top: 2px; }
  .hd .x { margin-inline-start: auto; }
  .acts { display: flex; flex-direction: column; gap: 8px; }
  .acts .row { display: flex; gap: 8px; flex-wrap: wrap; }
  .wird { font-family: var(--naskh); font-size: 18px; border-top: 1px solid rgba(247,235,204,.15); padding-top: 8px; }
`));
const E = JSON.parse(new URLSearchParams(location.search).get('e'));
const root = document.getElementById('root');
const frame = h('div', { class: 'frame' });
const content = h('div', { class: 'content' });
frame.append(content); root.append(frame);
const close = () => window.azan.send('card:close');

const ICONS = { update: '⬇️', pre: '⏰', after: '🤲', morningAdhkar: '🌅', eveningAdhkar: '🌇', kahf: '📖', khutbah: '🕌', suhoor: '🌙', missed: '🕰️' };
function title(s) {
  const p = E.p, ram = Calc.isRamadan(new Date(), s.hijriOffset);
  switch (E.kind) {
    case 'adhan': return p === 'sunrise' ? 'وقت الشروق' : p === 'maghrib' && ram ? 'حان موعد الإفطار' : `حان الآن موعد صلاة ${Calc.AR[p]}`;
    case 'pre': return `صلاة ${Calc.AR[p]} ${Calc.countdownLong(s.preReminder * 60, latin())}`;
    case 'after': return 'تقبّل الله منك';
    case 'morningAdhkar': return 'أذكار الصباح';
    case 'eveningAdhkar': return 'أذكار المساء';
    case 'kahf': return 'يوم الجمعة: سورة الكهف';
    case 'khutbah': return `خطبة الجمعة ${Calc.countdownLong(s.khutbahBefore * 60, latin())}`;
    case 'suhoor': return 'وقت السحور';
    case 'update': return 'نسخة جديدة من أذان';
    case 'missed': return `فاتك أذان ${Calc.AR[E.p]}`;
  }
  return 'أذان';
}
function subtitle(s) {
  switch (E.kind) {
    case 'adhan': return E.meeting ? 'أنت باجتماع، فطلع التنبيه بدون أذان' : fmtTime(new Date(E.time));
    case 'after': return `صلاة ${Calc.AR[E.p]}`;
    case 'kahf': return 'وأكثر من الصلاة على النبي ﷺ';
    case 'missed': return E.until ? `كان الأذان ${fmtTime(new Date(E.time))} · وقت الصلاة مستمر حتى ${fmtTime(new Date(E.until))}` : 'الجهاز كان نايم وقت الأذان';
    case 'update': return STATE.update && STATE.update.available ? `${STATE.update.available.version} (عندك ${STATE.version})` : null;
    case 'suhoor': { const f = new Date(E.time + s.suhoorBefore * 60000); return `الإمساك ${fmtTime(new Date(f - 600000))} · الفجر ${fmtTime(f)}`; }
  }
  return null;
}

let mounted = false;
function render() {
  if (!STATE) return;
  const s = S();
  content.replaceChildren();
  const icon = E.kind === 'adhan' ? (STATE.playing ? '🔊' : ICON[E.p] || '🕌') : ICONS[E.kind] || '🕌';
  content.append(h('div', { class: 'hd' },
    h('span', { class: 'ic' }, icon),
    h('div', {}, h('h2', {}, title(s)), subtitle(s) ? h('p', {}, subtitle(s)) : null),
    h('button', { class: 'icon-btn x', onclick: close }, '✕')));
  const acts = h('div', { class: 'acts' });
  if (E.kind === 'adhan' && STATE.playing) acts.append(h('div', { class: 'row' }, h('button', { class: 'pill gold-fill', onclick: () => window.azan.send('adhan:stop') }, '⏹ إيقاف الأذان')));
  if (E.kind === 'after') {
    if (s.adhkarAfterPrayer) acts.append(h('div', { class: 'row' }, h('button', { class: 'pill', onclick: () => { window.azan.send('open:adhkar', 'after'); close(); } }, '🤲 أذكار بعد الصلاة')));
    const k = Calc.khatma(s.khatmaDays, s.khatmaStart, s.khatmaRead, new Date(), s.khatmaBase);
    if (s.khatmaOn && s.khatmaAfterPrayer && k.portion) {
      const [a, b] = k.portion;
      acts.append(h('div', { class: 'wird' }, `وردك: صفحة ${N(a)}–${N(b)} · سورة ${Calc.surahOnPage(a)}`),
        h('div', { class: 'row' },
          h('button', { class: 'pill', onclick: () => window.azan.send('open:main', { tab: 'quran', page: a }) }, '📖 افتح المصحف'),
          h('button', { class: 'pill gold-fill', onclick: () => { window.azan.send('khatma:read', b); close(); } }, '✓ قرأت')));
    }
  }
  if (E.kind === 'morningAdhkar' || E.kind === 'eveningAdhkar') acts.append(h('div', { class: 'row' }, h('button', { class: 'pill gold-fill', onclick: () => { window.azan.send('open:adhkar', E.kind === 'morningAdhkar' ? 'morning' : 'evening'); close(); } }, '▶ ابدأ')));
  if (E.kind === 'kahf') acts.append(h('div', { class: 'row' }, h('button', { class: 'pill gold-fill', onclick: () => { window.azan.send('open:main', { tab: 'quran', page: Calc.SURAH_START[17] }); close(); } }, '📖 اقرأ سورة الكهف')));
  if (E.kind === 'update' && STATE.update && STATE.update.available) {
    const u = STATE.update;
    const notes = (u.available.notes || '').slice(0, 260);
    if (notes) acts.append(h('div', { style: { fontSize: '13px', lineHeight: '1.6' } }, notes + (u.available.notes.length > 260 ? '…' : '')));
    if (u.progress != null) acts.append(bar(u.progress), h('div', { class: 'sec', style: { fontSize: '12px' } }, u.progress < 1 ? `عم ينزّل… ${N(Math.round(u.progress * 100))}٪` : 'عم يثبّت، وبيرجع يفتح لحاله…'));
    else {
      if (u.error) acts.append(h('div', { style: { fontSize: '12px', color: '#ffb36b' } }, u.error));
      acts.append(h('div', { class: 'row' },
        h('button', { class: 'pill gold-fill', onclick: () => window.azan.send('update:install') }, '⬇ حدّث هلأ'),
        h('button', { class: 'pill', onclick: () => window.azan.send('update:snooze') }, 'لاحقاً'),
        h('button', { class: 'pill', onclick: () => window.azan.send('open:url', u.available.page) }, 'التفاصيل')));
    }
  }
  if (acts.childElementCount) content.append(acts);
  if (!mounted) { mounted = true; requestAnimationFrame(() => mountSky(frame, { moonX: 110, moonY: 30 })); }
}
onState(render);
