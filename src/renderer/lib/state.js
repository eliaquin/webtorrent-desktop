const { createState, getDefaultPlayState } = require('../../shared/state')
const native = require('./native-api')
const listeners = new Map()
let saveTimer

const State = module.exports = {
  getDefaultPlayState,
  on (event, listener) {
    if (!listeners.has(event)) listeners.set(event, new Set())
    listeners.get(event).add(listener)
  },
  emit (event) {
    for (const listener of listeners.get(event) || []) listener()
  },
  async load (respond) {
    try {
      const state = createState()
      state.saved = await native.loadState()
      respond(null, state)
    } catch (err) { respond(err) }
  },
  save (state) {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => saveImmediate(state), 1000)
  },
  saveImmediate
}

async function saveImmediate (state) {
  // Clean up, so that we're not saving any pending state
  const copy = Object.assign({}, state.saved)
  // Remove torrents pending addition to the list, where we haven't finished
  // reading the torrent file or file(s) to seed & don't have an infohash
  copy.torrents = copy.torrents
    .filter((x) => x.infoHash)
    .map(x => {
      const torrent = {}
      for (const key in x) {
        if (key === 'progress' || key === 'torrentKey') {
          continue // Don't save progress info or key for the webtorrent process
        }
        if (key === 'error') {
          continue // Don't save error states
        }
        torrent[key] = x[key]
      }
      return torrent
    })

  try {
    await native.saveState(JSON.parse(JSON.stringify(copy)))
    State.emit('stateSaved')
  } catch (err) {
    console.error(err)
  }
}
