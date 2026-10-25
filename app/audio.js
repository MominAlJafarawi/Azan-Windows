// Plays the adhan, the silent-alert announcement (takbir then the recorded sentence) and previews.
let adhan = null, extra = [], timers = [];
function clearAll() {
  timers.forEach(clearTimeout); timers = [];
  for (const a of [adhan, ...extra]) if (a) { a.pause(); a.src = ''; }
  adhan = null; extra = [];
}
function fade(a, to, ms, done) {
  const from = a.volume, steps = 20; let i = 0;
  const id = setInterval(() => { i++; a.volume = Math.max(0, Math.min(1, from + (to - from) * i / steps)); if (i >= steps) { clearInterval(id); done && done(); } }, ms / steps);
}
function playSpeech(src, times, volume) {
  let n = 0;
  const one = () => {
    if (n++ >= Math.max(1, Math.min(5, times))) return;
    const a = new Audio(src); a.volume = volume; extra.push(a);
    a.onended = () => timers.push(setTimeout(one, 1000));
    a.play().catch(() => {});
  };
  timers.push(setTimeout(one, 400));
}
window.azan.on('audio', (cmd) => {
  if (cmd.type === 'stop') { clearAll(); return; }
  if (cmd.type === 'adhan' || cmd.type === 'preview') {
    if (cmd.type === 'preview' && adhan && !adhan.paused) { clearAll(); return; }
    clearAll();
    if (!cmd.src) { window.azan.send('audio:ended', cmd.type); return; }
    adhan = new Audio(cmd.src);
    adhan.volume = cmd.type === 'adhan' ? 0 : cmd.volume;
    adhan.onended = () => { adhan = null; window.azan.send('audio:ended', cmd.type, true); };
    adhan.onerror = () => window.azan.send('audio:ended', cmd.type, false);
    adhan.play().then(() => { if (cmd.type === 'adhan') fade(adhan, cmd.volume, 2500); }).catch(() => window.azan.send('audio:ended', cmd.type, false));
    return;
  }
  // dua after the adhan (times with a 2 s pause); the preview toggles
  if (cmd.type === 'dua' || cmd.type === 'duaPreview') {
    const wasPlaying = extra.some((a) => a.dataset && a.dataset.dua && !a.paused) || timers.length > 0;
    clearAll();
    if (cmd.type === 'duaPreview' && wasPlaying) return;
    const total = Math.max(1, Math.min(3, cmd.times || 1));
    let n = 0;
    const done = () => { if (cmd.type === 'dua') window.azan.send('audio:ended', 'dua', true); };
    if (!cmd.src) { done(); return; }
    const one = () => {
      timers = [];
      const a = new Audio(cmd.src); a.volume = cmd.volume; a.dataset.dua = '1'; extra.push(a);
      a.onended = () => { if (++n < total) timers.push(setTimeout(one, 2000)); else { timers = []; done(); } };
      a.onerror = done;
      a.play().catch(done);
    };
    one();
    return;
  }
  if (cmd.type === 'announce') {
    clearAll();
    if (!cmd.takbir) { if (cmd.speech) playSpeech(cmd.speech, cmd.times, cmd.volume); return; }
    const t = new Audio(cmd.takbir); t.volume = cmd.volume; extra.push(t);
    const next = () => { if (cmd.speech) playSpeech(cmd.speech, cmd.times, cmd.volume); };
    t.play().catch(next);
    timers.push(setTimeout(() => fade(t, 0, 600, () => { t.pause(); next(); }), Math.max(1000, (cmd.takbirEnd - 0.3) * 1000)));
  }
});
