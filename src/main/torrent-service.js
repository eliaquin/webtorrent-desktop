const { app, utilityProcess } = require('electron')
const path = require('path')
const { EventEmitter } = require('events')
const events = new EventEmitter()
const config = require('../config')
const windows = require('./windows')

const commands = new Set([
  'wt-set-global-trackers', 'wt-start-torrenting', 'wt-stop-torrenting',
  'wt-create-torrent', 'wt-save-torrent-file', 'wt-generate-torrent-poster',
  'wt-cast-command', 'wt-get-audio-metadata', 'wt-start-server', 'wt-stop-server', 'wt-select-files', 'wt-subtitle-task'
])
let worker
let ready = false
const queued = []

function init () {
  worker = utilityProcess.fork(path.join(__dirname, '../engine/torrent-service.js'), [], {
    serviceName: 'WebTorrent networking',
    env: { ...process.env, WEBTORRENT_CONFIG_PATH: config.CONFIG_PATH, WEBTORRENT_DOWNLOAD_PATH: config.DEFAULT_DOWNLOAD_PATH },
    stdio: 'pipe'
  })
  worker.stdout.on('data', chunk => console.log('[torrent]', chunk.toString().trim()))
  worker.stderr.on('data', chunk => console.error('[torrent]', chunk.toString().trim()))
  worker.on('message', ({ name, args }) => {
    events.emit(name, ...args)
    if (name === 'ipcReadyWebTorrent') {
      ready = true
      for (const message of queued.splice(0)) worker.postMessage(message)
    } else if (typeof name === 'string' && name.startsWith('wt-') && Array.isArray(args)) {
      windows.main.send(name, ...args)
    }
  })
  worker.on('exit', code => {
    ready = false
    worker = null
    if (!app.isQuitting) windows.main.send('wt-error', null, 'Torrent service stopped (exit ' + code + '). Restart the app to reconnect.')
  })
  app.once('will-quit', () => { if (worker) worker.kill() })
}

function send (name, ...args) {
  if (!commands.has(name)) return
  if (ready && worker) worker.postMessage({ name, args })
  else queued.push({ name, args })
}

let sequence = 0
function subtitleTask (action, filePath) {
  const id = ++sequence
  return new Promise((resolve, reject) => {
    const event = 'wt-subtitle-result-' + id
    const timeout = setTimeout(() => { events.removeAllListeners(event); reject(new Error('Subtitle processing timed out')) }, 180000)
    events.once(event, (error, result) => {
      clearTimeout(timeout)
      if (error) reject(new Error(error))
      else resolve(result)
    })
    send('wt-subtitle-task', id, action, filePath)
  })
}

module.exports = { init, send, events, subtitleTask }
