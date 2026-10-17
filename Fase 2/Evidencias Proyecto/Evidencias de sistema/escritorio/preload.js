const { contextBridge } = require('electron');

// Expone únicamente información pública y no concede acceso general a Node.js.
contextBridge.exposeInMainWorld('desktopApp', Object.freeze({
  appName: 'Punto Único de Información',
  runtime: 'Electron'
}));
