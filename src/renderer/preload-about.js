const { ipcRenderer } = require('electron')
const { config, version, architecture } = ipcRenderer.sendSync('native:bootstrap')
window.addEventListener('DOMContentLoaded', () => {
  document.querySelector('#app-version').textContent = config.APP_VERSION
  document.querySelector('#torrent-version').textContent = version
  document.querySelector('#app-arch').textContent = architecture
  document.querySelector('#app-copyright').textContent = config.APP_COPYRIGHT
}, { once: true })
