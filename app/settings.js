// Settings tab of the main window: same sections and options as the Mac version.
(function () {
document.head.append(h('style', {}, `
  .v-settings { height: 100%; display: flex; flex-direction: column; }
  .v-settings .stabs { flex: none; padding: 0 0 14px; justify-content: flex-start; }
  .v-settings .body { flex: 1; overflow-y: auto; padding: 0 2px 24px; user-select: text; }
  .v-settings .sec { margin-bottom: 20px; color: var(--text); }
  .v-settings .sec h3 { font-size: 16px; font-weight: 700; margin: 0 4px 8px; color: var(--gold); }
  .v-settings .box { background: var(--glass); border: 1px solid rgba(255,255,255,.12); border-radius: 14px; }
  .v-settings .it { display: flex; align-items: center; gap: 12px; padding: 11px 16px; border-bottom: 1px solid rgba(255,255,255,.07); font-size: 15px; min-height: 48px; }
  .v-settings .it:last-child { border-bottom: 0; }
  .v-settings .it .v { margin-inline-start: auto; color: var(--sec); }
  .v-settings .note { font-size: 13px; color: var(--sec); padding: 8px 16px 10px; line-height: 1.6; }
  .v-settings .note.gold { color: var(--gold); }
  .v-settings .sw { margin-inline-start: auto; width: 40px; height: 22px; border-radius: 22px; background: rgba(247,235,204,.2); position: relative; transition: .2s; flex: none; }
  .v-settings .sw::after { content: ''; position: absolute; top: 3px; right: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: .2s; }
  .v-settings .sw.on { background: var(--gold); } .v-settings .sw.on::after { right: 21px; }
  .v-settings select, .v-settings input[type=text] { margin-inline-start: auto; background: rgba(0,0,0,.25); color: var(--text); border: 1px solid rgba(235,194,102,.35); border-radius: 8px; padding: 6px 10px; font: inherit; font-size: 14px; max-width: 60%; }
  .v-settings select option { background: #161c45; }
  .v-settings input[type=text] { margin: 0; flex: 1; max-width: none; }
  .v-settings input[type=range] { margin-inline-start: auto; width: 55%; accent-color: var(--gold); }
  .v-settings .step { margin-inline-start: auto; display: flex; align-items: center; gap: 8px; }
  .v-settings .step button { width: 28px; height: 28px; border-radius: 50%; background: rgba(247,235,204,.12); }
  .v-settings .res { padding: 6px 16px 10px; display: flex; flex-direction: column; gap: 4px; }
  .v-settings .res button { text-align: start; color: var(--gold); font-size: 15px; padding: 4px 0; }
  .v-settings .ok { color: var(--gold); } .v-settings .bad { color: #ffb36b; }
`));

const TABS = [['loc', 'الموقع والحساب', '📍'], ['adhan', 'الأذان', '🔊'], ['khatma', 'الختمة', '📖'], ['rem', 'التذكيرات', '🔔'], ['gen', 'عام', '⚙']];
let tab = 'loc', results = [], searchQ = '', searching = false;
let el = null, hc = null, body = null, onSub = () => {};
function mount(host, { onSubChange } = {}) {
  onSub = onSubChange || onSub;
  hc = h('div', { class: 'tabs stabs' });
  body = h('div', { class: 'body' });
  el = h('div', { class: 'v-settings' }, hc, body);
  host.append(el);
  // re-render on changes, but not while the user is typing or dragging a slider
  body.addEventListener('focusin', (e) => { if (e.target.matches('input[type=text], input[type=range], select')) typing = true; });
  body.addEventListener('focusout', () => { typing = false; });
}
const set = (patch) => window.azan.set(patch);
const sw = (key, label) => h('div', { class: 'it' }, label, h('button', { class: 'sw' + (S()[key] ? ' on' : ''), onclick: () => set({ [key]: !S()[key] }) }));
const sel = (key, label, opts, conv = (x) => x) => h('div', { class: 'it' }, label,
  h('select', { onchange: (e) => set({ [key]: conv(e.target.value) }) }, opts.map(([v, t]) => h('option', { value: v, selected: String(S()[key]) === String(v) }, t))));
const section = (title, ...items) => h('div', { class: 'sec' }, h('h3', {}, title), h('div', { class: 'box' }, ...items));
const note = (t, gold) => h('div', { class: 'note' + (gold ? ' gold' : '') }, t);

function tabs() {
  hc.replaceChildren(...TABS.map(([k, t, ic]) => h('button', { class: 'tab' + (tab === k ? ' on' : ''), onclick: () => { if (tab !== k) onSub(k); } }, ic, ' ', t)));
}

function locTab() {
  const s = S();
  const out = [];
  const locItems = [sw('autoLocation', 'تحديد الموقع تلقائياً (من الإنترنت)'),
    h('div', { class: 'it' }, 'المدينة الحالية', h('span', { class: 'v' }, s.placeName || 'غير محدد'))];
  if (STATE.locationStatus === 'locating') locItems.push(note('عم نحدد موقعك…'));
  if (STATE.locationStatus === 'failed') locItems.push(note('ما قدرت أحدد الموقع تلقائياً (في نت؟). اختار مدينتك بالبحث تحت.', true));
  const inp = h('input', { type: 'text', placeholder: 'اكتب اسم المدينة (مثلاً القاهرة)', value: searchQ, oninput: (e) => { searchQ = e.target.value; }, onkeydown: (e) => { if (e.key === 'Enter') doSearch(); } });
  locItems.push(h('div', { class: 'it' }, inp, h('button', { class: 'pill gold-fill', onclick: doSearch }, searching ? '…' : 'بحث')));
  if (results.error) locItems.push(note('البحث بحاجة نت: ' + results.error, true));
  else if (results.length) locItems.push(h('div', { class: 'res' }, results.map((r) => h('button', { onclick: () => pick(r) }, '📍 ' + r.name))));
  out.push(section('الموقع', ...locItems));
  out.push(section('طريقة الحساب',
    sw('autoMethod', 'اختيار الطريقة تلقائياً حسب البلد'),
    s.autoMethod ? h('div', { class: 'it' }, 'الطريقة المستعملة', h('span', { class: 'v' }, STATE.methods[STATE.effMethod]))
      : sel('method', 'الطريقة', Object.entries(STATE.methods)),
    sel('school', 'مذهب العصر', [['shafi', 'الجمهور (شافعي، مالكي، حنبلي)'], ['hanafi', 'الحنفي']]),
    sel('highLat', 'خطوط العرض العالية', [['auto', 'تلقائي (مستحسن)'], ['middle', 'منتصف الليل'], ['seventh', 'سُبع الليل'], ['angle', 'حسب الزاوية'], ['none', 'بدون']]),
    note('بالبلاد الشمالية (مثل ألمانيا) بالصيف ما بيغيب الشفق تماماً، فهالقاعدة بتحدد وقت الفجر والعشاء هناك.')));
  out.push(section('تعديل بالدقائق (لتطابق مسجدك)', Calc.PRAYERS.map((p, i) => {
    const v = Number(s.offsets[i] || 0);
    const ch = (d) => { const o = [...s.offsets]; o[i] = Math.max(-30, Math.min(30, v + d)); set({ offsets: o }); };
    return h('div', { class: 'it' }, Calc.AR[p], h('div', { class: 'step' }, h('button', { onclick: () => ch(-1) }, '−'),
      h('span', { class: 'num', style: { minWidth: '54px', textAlign: 'center', color: 'var(--sec)' } }, v === 0 ? 'بدون' : `${v > 0 ? '+' : ''}${N(v)} د`), h('button', { onclick: () => ch(1) }, '+')));
  })));
  out.push(section('التاريخ الهجري',
    h('div', { class: 'it' }, 'تعديل اليوم', h('div', { class: 'step' },
      h('button', { onclick: () => set({ hijriOffset: Math.max(-2, s.hijriOffset - 1) }) }, '−'),
      h('span', { class: 'naskh', style: { minWidth: '150px', textAlign: 'center' } }, Calc.hijri(new Date(), s.hijriOffset, latin())),
      h('button', { onclick: () => set({ hijriOffset: Math.min(2, s.hijriOffset + 1) }) }, '+'))),
    note('إذا أعلنوا رؤية الهلال بيوم مختلف، عدّل هون.')));
  return out;
}
async function doSearch() {
  if (!searchQ.trim()) return;
  searching = true; render(true);
  results = await window.azan.searchCity(searchQ.trim());
  searching = false; render(true);
}
function pick(r) { results = []; set({ autoLocation: false, lat: Math.round(r.lat * 1e4) / 1e4, lon: Math.round(r.lon * 1e4) / 1e4, placeName: r.city, countryCode: r.cc }); }

const VOICE_AR = { makkah: 'مكة (علي ملا)', makkah_fajr: 'فجر الحرم المكي', madinah: 'الحرم المدني', madinah_fajr: 'فجر الحرم المدني', alafasy: 'مشاري العفاسي', alafasy_fajr: 'فجر مشاري العفاسي', aqsa: 'المسجد الأقصى', abdulbasit: 'عبد الباسط عبد الصمد' };
function voiceRow(key, label) {
  return h('div', { class: 'it' }, label,
    h('select', { onchange: (e) => set({ [key]: e.target.value }) }, STATE.voices.map((v) => h('option', { value: v, selected: S()[key] === v }, VOICE_AR[v] || v))),
    h('button', { class: 'icon-btn', title: 'استماع / إيقاف', onclick: () => window.azan.send('voice:preview', S()[key]) }, '▶'));
}
function adhanTab() {
  const s = S();
  return [
    section('الصوت', voiceRow('voice', 'صوت الأذان'), voiceRow('fajrVoice', 'صوت أذان الفجر'),
      h('div', { class: 'it' }, 'علو الصوت', h('input', { type: 'range', min: 0.1, max: 1, step: 0.05, value: s.volume, onchange: (e) => set({ volume: Number(e.target.value) }) }))),
    section('لكل صلاة', Calc.PRAYERS.map((p) => h('div', { class: 'it' }, Calc.AR[p],
      h('select', { onchange: (e) => set({ modes: { ...s.modes, [p]: e.target.value } }) }, ['adhan', 'silent', 'off'].map((m) => h('option', { value: m, selected: modeOf(p) === m }, MODE_AR[m])))))),
    section('التنبيه قبل الأذان', sel('preReminder', 'قبلها بـ', [[0, 'بدون'], ...[5, 10, 15, 20, 30].map((m) => [m, `${N(m)} دقائق`])], Number)),
    section('الأذان الذكي',
      sw('smartPause', 'إيقاف الموسيقى والفيديو وقت الأذان ثم إرجاعها'),
      sw('meetingSilent', 'وقت الاجتماعات (المايك شغّال): تنبيه صامت بدل الأذان'),
      note('ويندوز بيسجّل مين عم يستعمل المايك، والبرنامج بيقرأ هالسجل وقت الأذان بس.')),
    section('التنبيه الصامت بالكلام',
      sw('speakOn', 'بدل الأذان: صوت بيقول "حان الآن موعد أذان …"'),
      ...(s.speakOn ? [
        sw('speakTakbir', 'ابدأ بـ"الله أكبر" بصوت الشيخ المختار'),
        sel('speakRepeats', 'عدد مرات الجملة', [1, 2, 3].map((n) => [n, N(n)]), Number),
        h('div', { class: 'it' }, 'علو الصوت', h('input', { type: 'range', min: 0.1, max: 1, step: 0.05, value: s.speakVolume, onchange: (e) => set({ speakVolume: Number(e.target.value) }) })),
        sw('speakInMeeting', 'حتى وقت الاجتماعات'),
        h('div', { class: 'it' }, 'الصوت: ماجد (مسجّل داخل البرنامج)', h('button', { class: 'pill', style: { marginInlineStart: 'auto' }, onclick: () => window.azan.send('announce:test') }, '🔈 اسمع التنبيه')),
      ] : []),
      note('بيشتغل للصلوات اللي حاططها "تنبيه صامت"، ووقت الاجتماعات.')),
    section('تجربة', h('div', { class: 'it' }, 'جرّب الأذان كامل متل ما بيطلع وقت الصلاة',
      h('button', { class: 'pill gold-fill', style: { marginInlineStart: 'auto' }, onclick: () => window.azan.send('adhan:test') }, '▶ تجربة الأذان'))),
  ];
}
function khatmaTab() {
  const s = S(), k = Calc.khatma(s.khatmaDays, s.khatmaStart, s.khatmaRead, new Date());
  return [
    section('خطة الختمة', sw('khatmaOn', 'تفعيل ورد القرآن'),
      sel('khatmaDays', 'أختم خلال', [7, 10, 15, 20, 30, 40, 60, 90, 120, 365].map((d) => [d, `${N(d)} يوم`]), Number),
      h('div', { class: 'it' }, 'ورد اليوم تقريباً', h('span', { class: 'v' }, `${N(Math.ceil(k.perDay))} صفحة، يعني ${N(k.chunk)} بعد كل صلاة`)),
      h('div', { class: 'it' }, 'وصلت لصفحة', h('span', { class: 'v' }, `${N(s.khatmaRead)} (سورة ${Calc.surahOnPage(Math.max(1, s.khatmaRead))})`)),
      s.khatmaCount ? h('div', { class: 'it' }, 'ختمات مكتملة', h('span', { class: 'v' }, N(s.khatmaCount))) : null,
      sw('khatmaAfterPrayer', 'ذكّرني بوردي بعد كل صلاة')),
    section('تعديل يدوي',
      h('div', { class: 'it' }, 'آخر صفحة قرأتها', h('div', { class: 'step' },
        h('button', { onclick: () => set({ khatmaRead: Math.max(0, s.khatmaRead - 1) }) }, '−'),
        h('span', { class: 'num', style: { minWidth: '50px', textAlign: 'center' } }, N(s.khatmaRead)),
        h('button', { onclick: () => set({ khatmaRead: Math.min(Calc.PAGES, s.khatmaRead + 1) }) }, '+'))),
      h('div', { class: 'it' }, h('button', { class: 'pill', style: { marginInlineStart: 'auto' }, onclick: () => window.azan.send('khatma:new') }, 'ابدأ ختمة جديدة من اليوم'))),
  ];
}
function remTab() {
  return [
    section('الأذكار', sw('adhkarMorning', 'أذكار الصباح (بعد الشروق)'), sw('adhkarEvening', 'أذكار المساء (بعد العصر)'), sw('adhkarAfterPrayer', 'أذكار بعد الصلاة (بعد الأذان بـ٢٠ دقيقة)')),
    section('يوم الجمعة', sw('jumuah', 'تذكير بسورة الكهف (الساعة ١٠ الصبح) وبالخطبة'),
      sel('khutbahBefore', 'الخطبة: ذكّرني قبل الظهر بـ', [15, 30, 45, 60].map((m) => [m, `${N(m)} دقيقة`]), Number)),
    section('رمضان', sel('suhoorBefore', 'السحور: ذكّرني قبل الفجر بـ', [30, 45, 60, 90].map((m) => [m, `${N(m)} دقيقة`]), Number),
      note('وضع رمضان بيشتغل لحاله لما يبلش الشهر حسب التاريخ الهجري.')),
  ];
}
function genTab() {
  const r = STATE.report;
  return [
    section('العرض', sel('latinDigits', 'الأرقام', [[false, '١٢٣ عربية'], [true, '123 لاتينية']], (v) => v === 'true'),
      sel('use24h', 'الساعة', [[true, '٢٤ ساعة'], [false, '١٢ ساعة']], (v) => v === 'true')),
    section('ويدجت سطح المكتب المتحرك', sw('deskOn', 'إظهار الويدجت العائم على سطح المكتب'),
      sel('deskSize', 'الحجم', [['small', 'صغير'], ['medium', 'متوسط'], ['large', 'كبير']]),
      h('div', { class: 'it' }, 'حجم الويدجت', h('input', { type: 'range', min: 0.6, max: 2, step: 0.05, value: S().deskScale, onchange: (e) => set({ deskScale: Number(e.target.value) }) }), h('span', { class: 'num', style: { minWidth: '44px' } }, N(Math.round(S().deskScale * 100)) + '٪')),
      h('div', { class: 'it' }, 'حجم نافذة البرنامج', h('input', { type: 'range', min: 0.8, max: 1.5, step: 0.05, value: S().panelScale, onchange: (e) => set({ panelScale: Number(e.target.value) }) }), h('span', { class: 'num', style: { minWidth: '44px' } }, N(Math.round(S().panelScale * 100)) + '٪')),
      sw('deskOnTop', 'فوق كل النوافذ'), note('اسحبه بالماوس لأي مكان، واسحب أي طرف منه لتكبّره أو تصغّره (الكلام والأرقام بيكبروا معه). كبسة يمين فيها خيارات الحجم والساعة.')),
    section('فحص الملفات',
      h('div', { class: 'it ' + (r.problems.length ? 'bad' : 'ok') }, r.problems.length ? `في ملفات ناقصة: ${r.problems.join('، ')}` : `✓ كل الملفات سليمة (${N(r.checked)} ملف)`),
      r.repaired.length ? note('صلّحت لحالي: ' + r.repaired.join('، ')) : null,
      h('div', { class: 'it' }, `آخر فحص: ${fmtTime(new Date(r.date))}`, h('button', { class: 'pill', style: { marginInlineStart: 'auto' }, onclick: () => window.azan.runCheck() }, '🩺 افحص وصلّح الآن'))),
    (() => { const u = STATE.update || {}; return section('التحديثات', sw('autoUpdateCheck', 'افحص مرة باليوم إذا في نسخة جديدة'),
      h('div', { class: 'it' }, h('span', {}, `نسختك: ${STATE.version}`, u.available ? h('span', { class: 'ok' }, ` · في نسخة جديدة: ${u.available.version}`) : null),
        u.available ? h('button', { class: 'pill gold-fill', style: { marginInlineStart: 'auto' }, onclick: () => window.azan.send('update:install') }, u.progress != null ? 'عم ينزّل…' : '⬇ حدّث هلأ')
          : h('button', { class: 'pill', style: { marginInlineStart: 'auto' }, onclick: () => window.azan.checkUpdate() }, u.checking ? 'عم يفحص…' : '↻ افحص الآن')),
      u.error ? note(u.error, true) : null,
      note('الفحص بيسأل GitHub عن آخر نسخة بس، وما بيبعت أي معلومات عنك.')); })(),
    section('التشغيل', sw('launchAtLogin', 'يشتغل لحاله لما يفتح ويندوز')),
    section('حول', h('div', { class: 'it' }, 'الإصدار', h('span', { class: 'v' }, STATE.version)),
      note('أصوات الأذان من مستودع Kiwifu/adhan-mp3 للاستعمال الشخصي. الأذكار من حصن المسلم. نص المصحف: مشروع تنزيل tanzil.net (برخصة CC BY 3.0، بدون أي تعديل). الخط Amiri برخصة OFL. تطوير: مؤمن الجعفراوي.')),
  ];
}

let typing = false, rendered = false;
function render(force) {
  if (!STATE || !el) return;
  if (!force && rendered && typing && document.hasFocus()) return;
  rendered = true;
  tabs();
  const top = body.scrollTop;
  body.replaceChildren(...({ loc: locTab, adhan: adhanTab, khatma: khatmaTab, rem: remTab, gen: genTab }[tab])());
  body.scrollTop = top;
  const focus = body.querySelector('input[type=text]');
  if (focus && document.activeElement === document.body && searchQ) { focus.focus(); focus.setSelectionRange(searchQ.length, searchQ.length); }
}
/** show a sub tab (called by the main window's navigation) */
function show(sub) {
  const k = TABS.some((t) => t[0] === sub) ? sub : tab;
  if (k !== tab) { tab = k; if (body) body.scrollTop = 0; }
  render(true);
}
window.SettingsView = { mount, render, show, sub: () => tab };
})();
