const { ipcRenderer } = require('electron')
let state
let changed

function init (appState, callback) {
  state = appState
  changed = callback
  ipcRenderer.on('wt-cast-state', (event, snapshot) => {
    const sameMedia = state.playing.infoHash === snapshot.playing.infoHash && state.playing.fileIndex === snapshot.playing.fileIndex
    // Discovery/status can arrive after the user changes files. Casting owns
    // remote playback fields, never the UI's file/type/subtitle selection.
    if (sameMedia && (state.playing.location !== 'local' || snapshot.playing.location !== 'local')) {
      for (const key of ['location', 'castName', 'isPaused', 'currentTime', 'volume', 'jumpToTime']) {
        if (key in snapshot.playing) state.playing[key] = snapshot.playing[key]
      }
    }
    for (const [type, value] of Object.entries(snapshot.devices)) {
      state.devices[type] = { getDevices: () => value.items, device: value.items[value.selected] }
    }
    state.devices.castMenu = sameMedia ? snapshot.menu : null
    if (snapshot.errors.length) state.errors.push(...snapshot.errors)
    changed()
  })
  command('discover')
}

function command (action, ...args) {
  if (!state) return
  ipcRenderer.send('wt-cast-command', action, {
    playing: state.playing,
    server: state.server,
    torrents: state.saved.torrents.map(t => ({ infoHash: t.infoHash, name: t.name, files: t.files }))
  }, ...args)
}

module.exports = {
  init,
  toggleMenu: type => command('toggleMenu', type),
  selectDevice: index => command('selectDevice', index),
  stop: () => command('stop'),
  play: () => command('play'),
  pause: () => command('pause'),
  seek: time => command('seek', time),
  setVolume: volume => command('setVolume', volume),
  setRate: rate => { command('setRate', rate); return state && state.playing.location === 'airplay' }
}
