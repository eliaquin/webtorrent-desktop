const { ipcRenderer } = require('electron')

module.exports = {
  playerAvailable: () => ipcRenderer.invoke('native:player-available'),
  openPlayer: options => ipcRenderer.invoke('native:player-open', options),
  playerCommand: (sessionId, command, value) => ipcRenderer.invoke('native:player-command', sessionId, command, value),
  playerBounds: (sessionId, rect) => ipcRenderer.invoke('native:player-bounds', sessionId, rect),
  closePlayer: sessionId => ipcRenderer.invoke('native:player-close', sessionId),
  probeAudio: filepath => ipcRenderer.invoke('native:probe-audio', filepath),
  convertAudio: filepath => ipcRenderer.invoke('native:convert-audio', filepath),
  cancelAudioConversions: () => ipcRenderer.invoke('native:cancel-audio-conversions'),
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
