const { ipcRenderer } = require('electron')
const native = require('../lib/native-api')
const path = require('path')
const telemetry = require('../lib/telemetry')
const Playlist = require('../lib/playlist')

// Controls local play back: the <video>/<audio> tag and VLC
// Does not control remote casting (Chromecast etc)
module.exports = class MediaController {
  constructor (state) {
    this.state = state
  }

  async checkAudioSupport (missing) {
    const state = this.state
    const support = state.playing.audioSupport
    if (missing) support.missing = true
    if (state.playing.location !== 'local') {
      if (support.converting && state.playing.location !== 'error') {
        state.playing.audioSupport = {}
        native.cancelAudioConversions().catch(() => {})
      }
      return
    }
    if (!support.missing || support.checked || support.checking || support.url) return
    const torrent = state.getPlayingTorrentSummary()
    const file = state.getPlayingFileSummary()
    if (!torrent || !file || !torrent.path) return
    const progress = torrent.progress?.files?.[state.playing.fileIndex]
    // File size alone cannot distinguish completed files from preallocated downloads.
    if (progress ? progress.numPiecesPresent !== progress.numPieces : torrent.status !== 'seeding') return
    const current = () => state.playing.audioSupport === support && state.playing.location === 'local'
    support.checking = true
    try {
      const filepath = path.join(torrent.path, file.path)
      const streams = await native.probeAudio(filepath)
      if (!current()) return
      support.checked = true
      if (!streams) {
        support.message = 'Audio could not be checked. Install FFmpeg to enable audio conversion.'
        return
      }
      if (streams.length === 0) { this.mediaSuccess(); return } // genuinely silent video
      support.converting = true
      const position = state.playing.currentTime
      const url = await native.convertAudio(filepath)
      if (!current()) return
      support.url = url
      state.playing.jumpToTime = position
    } catch (err) {
      if (current()) {
        support.checked = true
        this.mediaError('Could not prepare compatible audio. ' + err.message)
      }
    } finally {
      support.checking = false
      support.converting = false
    }
  }

  mediaSuccess () {
    telemetry.logPlayAttempt('success')
  }

  mediaStalled () {
    this.state.playing.isStalled = true
  }

  mediaError (error) {
    const state = this.state
    if (state.location.url() === 'player') {
      telemetry.logPlayAttempt('error')
      state.playing.location = 'error'
      ipcRenderer.send('checkForExternalPlayer', state.saved.prefs.externalPlayerPath)
      const support = state.playing.audioSupport
      ipcRenderer.once('checkForExternalPlayer', (e, isInstalled) => {
        if (state.playing.audioSupport !== support || state.playing.location !== 'error') return
        state.modal = {
          id: 'unsupported-media-modal',
          error,
          externalPlayerInstalled: isInstalled
        }
      })
    }
  }

  mediaVolumeChanged (volume) {
    this.state.playing.volume = volume
  }

  mediaTimeUpdate (data) {
    if (data) {
      const file = this.state.getPlayingFileSummary()
      if (Number.isFinite(data.currentTime)) this.state.playing.currentTime = data.currentTime
      if (Number.isFinite(data.duration)) this.state.playing.duration = data.duration
      if (file) { file.currentTime = this.state.playing.currentTime; file.duration = this.state.playing.duration }
    }
    this.state.playing.lastTimeUpdate = new Date().getTime()
    this.state.playing.isStalled = false
  }

  mediaMouseMoved () {
    this.state.playing.mouseStationarySince = new Date().getTime()
  }

  controlsMouseEnter () {
    this.state.playing.mouseInControls = true
    this.state.playing.mouseStationarySince = new Date().getTime()
  }

  controlsMouseLeave () {
    this.state.playing.mouseInControls = false
    this.state.playing.mouseStationarySince = new Date().getTime()
  }

  openExternalPlayer () {
    const state = this.state
    native.cancelAudioConversions().catch(() => {})
    state.playing.location = 'external'

    const onServerRunning = () => {
      state.playing.isReady = true
      telemetry.logPlayAttempt('external')

      const mediaURL = Playlist.getCurrentLocalURL(state)
      ipcRenderer.send('openExternalPlayer',
        state.saved.prefs.externalPlayerPath,
        mediaURL,
        state.window.title)
    }

    if (state.server != null) onServerRunning()
    else ipcRenderer.once('wt-server-running', onServerRunning)
  }

  externalPlayerNotFound () {
    const modal = this.state.modal
    if (modal && modal.id === 'unsupported-media-modal') {
      modal.externalPlayerNotFound = true
    }
  }
}
