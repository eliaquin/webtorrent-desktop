/* globals ResizeObserver */
const React = require('react')
const { ipcRenderer } = require('electron')
const native = require('../lib/native-api')
const Playlist = require('../lib/playlist')
const { dispatch, dispatcher } = require('../lib/dispatcher')

let sequence = 0

// The surface is Cocoa; this transparent DOM element owns events and layout.
module.exports = class NativeMedia extends React.Component {
  constructor (props) {
    super(props)
    this.element = React.createRef()
    this.requestId = 'native-video-' + (++sequence)
    this.last = {}
    this.loadedSubtitles = new Set()
  }

  componentDidMount () {
    this.active = true
    this.playing = this.props.state.playing
    this.fileKey = this.playing.infoHash + ':' + this.playing.fileIndex
    this.onState = (event, snapshot) => this.receive(snapshot)
    ipcRenderer.on('native:player-state', this.onState)
    this.resize = new ResizeObserver(() => this.updateBounds())
    this.resize.observe(this.element.current)
    navigator.mediaSession.metadata = new window.MediaMetadata({ title: this.playing.fileName })
    navigator.mediaSession.setActionHandler('play', () => { if (this.playing.isPaused) dispatch('playPause') })
    navigator.mediaSession.setActionHandler('pause', () => { if (!this.playing.isPaused) dispatch('playPause') })
    navigator.mediaSession.setActionHandler('nexttrack', Playlist.hasNext(this.props.state) ? () => dispatch('nextTrack') : null)
    navigator.mediaSession.setActionHandler('previoustrack', Playlist.hasPrevious(this.props.state) ? () => dispatch('previousTrack') : null)
    this.start()
  }

  async start () {
    const state = this.props.state
    const playing = this.playing
    const volume = Number.isFinite(playing.setVolume) ? playing.setVolume : Number.isFinite(state.previousVolume) ? state.previousVolume : playing.volume
    const position = Math.max(0, Math.min(1e9, playing.jumpToTime || 0))
    const paused = playing.isPaused
    const rate = playing.playbackRate
    const setVolume = playing.setVolume
    try {
      const opened = await native.openPlayer({
        requestId: this.requestId,
        url: Playlist.getCurrentLocalURL(state),
        position,
        paused,
        volume,
        rate
      })
      if (!opened) return
      if (!this.isCurrent()) { await native.closePlayer(opened.sessionId); return }
      this.sessionId = opened.sessionId
      playing.nativeSession = this.sessionId
      if (playing.jumpToTime === position) playing.jumpToTime = null
      if (playing.setVolume === setVolume) playing.setVolume = null
      state.previousVolume = null
      playing.volume = volume
      this.last = { paused, volume, rate }
      this.updateBounds()
      this.sync()
    } catch (err) { this.fail(err.message) }
  }

  componentDidUpdate () { this.sync() }

  componentWillUnmount () {
    this.active = false
    this.resize.disconnect()
    ipcRenderer.removeListener('native:player-state', this.onState)
    if (this.sessionId) native.closePlayer(this.sessionId).catch(() => {})
    navigator.mediaSession.metadata = null
  }

  fail (message) {
    if (!this.isCurrent()) return
    if (this.sessionId) native.closePlayer(this.sessionId).catch(() => {})
    this.playing.nativeSession = null
    this.playing.nativeError = 'Native VLC could not play this file. Using the built-in player. ' + message
    this.playing.engine = 'chromium'
    this.playing.subtitles.tracks = []
    this.playing.subtitles.selectedIndex = -1
    this.playing.subtitles.checkedEmbedded = false
    this.playing.audioTracks.tracks = []
    if (!Number.isFinite(this.playing.jumpToTime)) this.playing.jumpToTime = this.playing.currentTime
  }

  command (command, value) {
    native.playerCommand(this.sessionId, command, value).catch(err => {
      if (!this.isCurrent()) return
      if (command === 'subtitle-file') dispatch('error', 'Could not load subtitle file. ' + err.message)
      else this.fail(err.message)
    })
  }

  sync () {
    if (!this.isCurrent() || !this.sessionId) return
    const state = this.props.state
    const p = this.playing
    navigator.mediaSession.playbackState = p.isPaused ? 'paused' : 'playing'
    if (this.last.paused !== p.isPaused) {
      this.last.paused = p.isPaused
      this.command('pause', Number(p.isPaused))
    }
    if (Number.isFinite(p.jumpToTime) && this.seekable) {
      const end = Number.isFinite(p.duration) && p.duration > 0 ? p.duration : 1e9
      this.command('seek', Math.max(0, Math.min(end, p.jumpToTime)))
      p.jumpToTime = null
    }
    if (Number.isFinite(p.setVolume)) { p.volume = p.setVolume; p.setVolume = null }
    if (this.last.volume !== p.volume) {
      this.last.volume = p.volume
      this.command('volume', p.volume)
    }
    if (this.last.rate !== p.playbackRate) {
      this.last.rate = p.playbackRate
      this.command('rate', p.playbackRate)
    }
    const audio = p.audioTracks.tracks[p.audioTracks.selectedIndex]
    if (audio && this.last.audio !== audio.nativeId) {
      this.last.audio = audio.nativeId
      this.command('audio-track', audio.nativeId)
    }
    const subtitles = p.subtitles
    const selected = subtitles.tracks[subtitles.selectedIndex]
    const id = selected?.nativeId ?? -1
    if (subtitles.userSelected && this.last.subtitle !== id) {
      this.last.subtitle = id
      this.command('subtitle-track', id)
    }
    const file = state.getPlayingFileSummary()
    if (file && subtitles.userSelected) {
      const saved = selected?.filePath || (selected && { engine: 'vlc', trackId: selected.nativeId })
      if (JSON.stringify(file.selectedSubtitle) !== JSON.stringify(saved)) {
        if (saved) file.selectedSubtitle = saved
        else delete file.selectedSubtitle
      }
    }
    if (this.metadataReady) {
      for (const file of subtitles.nativeFiles || []) {
        if (this.loadedSubtitles.has(file.path)) continue
        this.loadedSubtitles.add(file.path)
        this.command('subtitle-file', file)
      }
    }
  }

  receive (snapshot) {
    if (!this.isCurrent() || snapshot.requestId !== this.requestId) return
    if (snapshot.error || snapshot.state === 7) { this.fail(snapshot.error || 'VLC reported a media error.'); return }
    this.seekable = snapshot.seekable
    this.metadataReady = snapshot.state === 3 || snapshot.state === 4
    if (this.metadataReady) this.last.paused = snapshot.state === 4
    const p = this.playing
    const state = this.props.state
    if (snapshot.duration > 0) dispatch('mediaTimeUpdate', { currentTime: snapshot.currentTime, duration: snapshot.duration })
    p.isStalled = snapshot.state === 1 || snapshot.state === 2
    p.nativeStats = { decodedFrames: snapshot.decodedFrames, displayedFrames: snapshot.displayedFrames, lostFrames: snapshot.lostFrames, version: snapshot.version }
    if (snapshot.width && snapshot.height && !this.dimensions) {
      this.dimensions = true
      dispatch('setDimensions', { width: snapshot.width, height: snapshot.height })
    }
    const audio = snapshot.audioTracks || []
    const subtitles = snapshot.subtitleTracks || []
    if (JSON.stringify(audio) !== this.audioSignature) {
      this.audioSignature = JSON.stringify(audio)
      p.audioTracks.tracks = audio.map(track => ({ nativeId: track.id, label: track.label }))
    }
    if (!p.audioTracks.userSelected) {
      p.audioTracks.selectedIndex = audio.findIndex(track => track.id === snapshot.audioTrack)
    }
    this.last.audio = snapshot.audioTrack
    if (JSON.stringify(subtitles) !== this.subtitleSignature) {
      this.subtitleSignature = JSON.stringify(subtitles)
      p.subtitles.tracks = subtitles.map(track => ({ nativeId: track.id, label: track.label, embedded: !track.filePath, filePath: track.filePath }))
    }
    const saved = state.getPlayingFileSummary()?.selectedSubtitle
    if (!this.restoredSubtitle && saved?.engine === 'vlc' && subtitles.some(track => track.id === saved.trackId)) {
      this.restoredSubtitle = true
      p.subtitles.selectedIndex = subtitles.findIndex(track => track.id === saved.trackId)
      p.subtitles.userSelected = true
    } else if (!p.subtitles.userSelected) {
      p.subtitles.selectedIndex = subtitles.findIndex(track => track.id === snapshot.subtitleTrack)
    }
    this.last.subtitle = snapshot.subtitleTrack
    if (p.subtitles.persistNativeSelection && subtitles.some(track => track.id === snapshot.subtitleTrack && track.filePath)) {
      p.subtitles.persistNativeSelection = false
      p.subtitles.userSelected = true
    }
    if (snapshot.state === 6 && !this.ended) {
      this.ended = true
      if (Playlist.hasNext(state)) dispatch('nextTrack')
      else { p.isPaused = true; if (state.window.isFullScreen) dispatch('toggleFullScreen') }
    }
    this.sync()
  }

  updateBounds () {
    if (!this.isCurrent() || !this.sessionId) return
    const rect = this.element.current.getBoundingClientRect()
    native.playerBounds(this.sessionId, { x: rect.x, y: rect.y, width: rect.width, height: rect.height }).catch(err => this.fail(err.message))
  }

  render () {
    return <div ref={this.element} className='native-video-surface' aria-label='Native VLC video' onClick={dispatcher('playPause')} onDoubleClick={dispatcher('toggleFullScreen')} />
  }

  isCurrent () {
    const playing = this.props.state.playing
    return this.active && playing.engine === 'vlc' && playing.location === 'local' && this.fileKey === playing.infoHash + ':' + playing.fileIndex
  }
}
