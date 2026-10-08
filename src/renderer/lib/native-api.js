const { ipcRenderer } = require('electron')

module.exports = {
  statPath: filepath => ipcRenderer.invoke('native:stat-path', filepath),
  filesForSeeding: paths => ipcRenderer.invoke('native:files-for-seeding', paths),
  removeTorrentCache: (torrent, poster) => ipcRenderer.invoke('native:remove-torrent-cache', torrent, poster),
  readSubtitle: filepath => ipcRenderer.invoke('native:read-subtitle', filepath),
  extractEmbeddedSubtitles: filepath => ipcRenderer.invoke('native:extract-embedded-subtitles', filepath),
  subtitleToolsAvailable: () => ipcRenderer.invoke('native:subtitle-tools-available'),
  loadState: () => ipcRenderer.invoke('native:load-state'),
  saveState: saved => ipcRenderer.invoke('native:save-state', saved),
  windowState: () => ipcRenderer.sendSync('native:window-state'),
  clipboard: {
    readText: () => ipcRenderer.sendSync('native:clipboard-read'),
    readTextAsync: () => ipcRenderer.invoke('native:clipboard-read-text'),
    writeText: text => ipcRenderer.send('native:clipboard-write', text)
  },
  choosePath: options => ipcRenderer.invoke('native:choose-path', options),
  chooseSubtitles: () => ipcRenderer.invoke('native:choose-subtitles'),
  saveTorrentAs: (filename, options) => ipcRenderer.invoke('native:save-torrent-as', filename, options),
  showTorrentMenu: summary => ipcRenderer.send('native:torrent-menu', summary)
}
