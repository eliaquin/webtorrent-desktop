const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')
const { findRuntime } = require('./vlc-runtime')
const config = require('../config')

class NativePlayer {
  constructor ({ window, send, runtime = findRuntime, load = () => require(path.join(config.ROOT_PATH, 'build/native', `vlc-${process.arch}.node`)) }) {
    this.window = window
    this.send = send
    this.runtime = runtime
    this.load = load
    this.queue = Promise.resolve()
    this.generation = 0
    this.session = null
    this.stream = null
  }

  availability () {
    if (!this.runtime()) return { available: false, message: 'Native VLC needs VLC 3 installed in Applications on macOS.' }
    try {
      this.bridge ||= this.load()
      return { available: true }
    } catch (_) {
      return { available: false, message: 'Native VLC was not built for this Mac. Install VLC and rebuild WebTorrent.' }
    }
  }

  enqueue (action) {
    const result = this.queue.then(action)
    this.queue = result.catch(() => {})
    return result
  }

  validateURL (url) {
    const target = new URL(url)
    const base = this.stream && new URL(this.stream.localURL)
    if (!base || target.protocol !== 'http:' || target.origin !== base.origin ||
      !['localhost', '127.0.0.1'].includes(target.hostname) || target.username || target.password ||
      target.search || target.hash || !target.pathname.startsWith(base.pathname + '/')) {
      throw new Error('Native playback requires the active torrent media URL')
    }
    return target.href
  }

  open (options) {
    if (!options || typeof options.requestId !== 'string' || options.requestId.length > 200 || typeof options.url !== 'string') throw new Error('Invalid native playback request')
    const url = this.validateURL(options.url)
    const position = options.position ?? 0
    const volume = options.volume ?? 1
    const rate = options.rate ?? 1
    if (!Number.isFinite(position) || position < 0 || position > 1e9 ||
      !Number.isFinite(volume) || volume < 0 || volume > 1 ||
      !Number.isFinite(rate) || rate < 0.25 || rate > 16 || typeof options.paused !== 'boolean') throw new Error('Invalid native playback settings')
    const generation = ++this.generation
    return this.enqueue(async () => {
      await this.closeCurrent()
      if (generation !== this.generation) return null
      const availability = this.availability()
      if (!availability.available) throw new Error(availability.message)
      const win = this.window()
      if (!win || win.isDestroyed()) throw new Error('The player window was closed')
      this.validateURL(url)
      try {
        win.setBackgroundColor('#00000000')
        this.bridge.open(win.getNativeWindowHandle(), this.runtime(), url, position, volume, rate, options.paused)
      } catch (err) {
        await this.bridge.close()
        win.setBackgroundColor('#282828')
        throw err
      }
      const session = this.session = { id: crypto.randomUUID(), requestId: options.requestId, externalSubtitles: new Map(), pendingSubtitles: [] }
      this.timer = setInterval(() => this.poll(), 250)
      this.poll()
      return { sessionId: session.id }
    })
  }

  poll () {
    const session = this.session
    if (!session) return
    try {
      const snapshot = this.bridge.snapshot()
      for (const pending of session.pendingSubtitles) {
        const added = (snapshot.subtitleTracks || []).find(track => !pending.previous.has(track.id) && !session.externalSubtitles.has(track.id))
        if (added) { session.externalSubtitles.set(added.id, pending.path); pending.done = true }
      }
      session.pendingSubtitles = session.pendingSubtitles.filter(pending => !pending.done)
      for (const track of snapshot.subtitleTracks || []) {
        if (session.externalSubtitles.has(track.id)) track.filePath = session.externalSubtitles.get(track.id)
      }
      this.send({ ...snapshot, sessionId: session.id, requestId: session.requestId })
    } catch (err) {
      this.send({ sessionId: session.id, requestId: session.requestId, error: err.message })
      this.close(session.id).catch(() => {})
    }
  }

  command (sessionId, command, value) {
    if (!this.session || this.session.id !== sessionId) return false
    const numeric = {
      pause: v => v === 0 || v === 1,
      seek: v => v >= 0 && v <= 1e9,
      volume: v => v >= 0 && v <= 1,
      rate: v => v >= 0.25 && v <= 16,
      'audio-track': v => Number.isInteger(v) && v >= -1 && v <= 2147483647,
      'subtitle-track': v => Number.isInteger(v) && v >= -1 && v <= 2147483647
    }
    if (command === 'subtitle-file') {
      const filename = value?.path
      if (typeof filename !== 'string' || typeof value.select !== 'boolean' || !path.isAbsolute(filename) || !['.srt', '.vtt', '.ass', '.ssa', '.sub'].includes(path.extname(filename).toLowerCase()) || !fs.statSync(filename).isFile()) throw new Error('Invalid subtitle file')
      const previous = new Set((this.bridge.snapshot().subtitleTracks || []).map(track => track.id))
      this.bridge.command(command, pathToFileURL(filename).href, value.select)
      this.session.pendingSubtitles.push({ path: filename, previous })
    } else if (!numeric[command] || !Number.isFinite(value) || !numeric[command](value)) {
      throw new Error('Invalid native playback command')
    } else {
      this.bridge.command(command, value)
    }
    return true
  }

  bounds (sessionId, rect) {
    if (!this.session || this.session.id !== sessionId) return false
    if (!rect || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(rect[key]) && rect[key] >= 0 && rect[key] <= 100000)) throw new Error('Invalid native video bounds')
    this.bridge.bounds(rect.x, rect.y, rect.width, rect.height)
    return true
  }

  close (sessionId) {
    if (sessionId) return this.enqueue(() => this.session?.id === sessionId ? this.closeCurrent() : undefined)
    ++this.generation
    return this.enqueue(() => this.closeCurrent())
  }

  async closeCurrent () {
    clearInterval(this.timer)
    this.session = null
    if (this.bridge) await this.bridge.close()
    const win = this.window()
    if (win && !win.isDestroyed()) win.setBackgroundColor('#282828')
  }
}

let instance
function getPlayer () {
  instance ||= new NativePlayer({
    window: () => require('./windows').main.win,
    send: state => require('./windows').main.send('native:player-state', state)
  })
  return instance
}

module.exports = { NativePlayer, getPlayer }
