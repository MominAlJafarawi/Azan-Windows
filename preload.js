const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('azan', {
  state: () => ipcRenderer.invoke('state'),
  onState: (fn) => ipcRenderer.on('state', (_e, s) => fn(s)),
  on: (ch, fn) => ipcRenderer.on(ch, (_e, ...a) => fn(...a)),
  set: (patch) => ipcRenderer.invoke('settings:set', patch),
  adhkar: () => ipcRenderer.invoke('adhkar:data'),
  quran: () => ipcRenderer.invoke('quran:data'),
  resUrl: (rel) => ipcRenderer.invoke('res:url', rel),
  searchCity: (q) => ipcRenderer.invoke('location:search', q),
  autoLocate: () => ipcRenderer.invoke('location:auto'),
  runCheck: () => ipcRenderer.invoke('check:run'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  send: (ch, ...a) => ipcRenderer.send(ch, ...a),
  // test switch only: AZAN_NOW (an ISO time) together with AZAN_DATA runs the windows at that time
  fakeNow: process.env.AZAN_DATA && process.env.AZAN_NOW ? process.env.AZAN_NOW : null,
});
