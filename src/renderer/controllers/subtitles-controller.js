const native = require('../lib/native-api')
const path = require('path')

const { dispatch } = require('../lib/dispatcher')

module.exports = class SubtitlesController {
  constructor (state) {
    this.state = state
  }

  async openSubtitles () {
    const filenames = await native.chooseSubtitles()
    if (!Array.isArray(filenames)) return
    this.addSubtitles(filenames, true)
  }

  selectSubtitle (ix) {
    this.state.playing.subtitles.selectedIndex = ix
    this.state.playing.subtitles.userSelected = true
  }

  toggleSubtitlesMenu () {
    const subtitles = this.state.playing.subtitles
    subtitles.showMenu = !subtitles.showMenu
    clearTimeout(this.toolsTimer)
    if (subtitles.showMenu && subtitles.showInstallSteps) this.watchSubtitleTools(subtitles)
  }

  async findEmbeddedSubtitles () {
    const subtitles = this.state.playing.subtitles
    if (subtitles.loadingEmbedded || subtitles.checkingTools) return
    subtitles.requestedEmbedded = true
    subtitles.showMenu = true
    if (subtitles.tracks.some(track => track.embedded)) {
      subtitles.embeddedMessage = 'Embedded subtitles are ready.'
      return
    }
    await this.checkSubtitleTools()
  }

  async checkSubtitleTools () {
    const subtitles = this.state.playing.subtitles
    if (subtitles.checkingTools) return
    subtitles.checkingTools = true
    try {
      const available = await native.subtitleToolsAvailable()
      if (this.state.playing.subtitles !== subtitles) return
      subtitles.toolsAvailable = available
      if (!available) {
        subtitles.showInstallNotice = !this.state.saved.prefs.ffmpegNoticeDismissed && !subtitles.showInstallSteps
        subtitles.embeddedMessage = 'Embedded subtitle discovery needs FFmpeg.'
        return
      }
      clearTimeout(this.toolsTimer)
      subtitles.showInstallNotice = false
      subtitles.showInstallSteps = false
      subtitles.requestedEmbedded = true
      subtitles.embeddedMessage = 'Subtitles will be checked when this video finishes downloading.'
      subtitles.checkedEmbedded = false
      this.checkForEmbeddedSubtitles()
    } catch (_) {
      if (this.state.playing.subtitles === subtitles) subtitles.embeddedMessage = 'Could not check for FFmpeg. Try Check again.'
    } finally {
      subtitles.checkingTools = false
    }
  }

  showInstallSteps () {
    const subtitles = this.state.playing.subtitles
    subtitles.showInstallNotice = false
    subtitles.showInstallSteps = true
    this.watchSubtitleTools(subtitles)
  }

  watchSubtitleTools (subtitles) {
    clearTimeout(this.toolsTimer)
    const current = () => this.state.playing.subtitles === subtitles && subtitles.showMenu && subtitles.showInstallSteps
    const check = async () => {
      if (!current()) return
      await this.checkSubtitleTools()
      if (current()) this.toolsTimer = setTimeout(check, 2000)
    }
    this.toolsTimer = setTimeout(check, 2000)
  }

  dismissInstallNotice () {
    const subtitles = this.state.playing.subtitles
    subtitles.showInstallNotice = false
    subtitles.showInstallSteps = false
    subtitles.embeddedMessage = ''
    this.state.saved.prefs.ffmpegNoticeDismissed = true
    clearTimeout(this.toolsTimer)
    dispatch('stateSave')
  }

  copyInstallCommand () {
    native.clipboard.writeText('brew install ffmpeg')
    this.state.playing.subtitles.commandCopied = true
  }

  async addSubtitles (files, autoSelect) {
    // Subtitles are only supported when playing video files
    if (this.state.playing.type !== 'video') return
    if (files.length === 0) return
    const subtitles = this.state.playing.subtitles

    try {
      const tracks = await Promise.all(files.map(file => native.readSubtitle(file.path || file)))
      if (this.state.playing.subtitles !== subtitles) return
      // No dupes allowed
      tracks.forEach((track, i) => {
        let trackIndex = subtitles.tracks.findIndex((t) =>
          track.filePath === t.filePath)

        // Add the track
        if (trackIndex === -1) {
          trackIndex = subtitles.tracks.push(track) - 1
        }

        // If we're auto-selecting a track, try to find one in the user's language
        if (autoSelect && (i === 0 || isSystemLanguage(track.language))) {
          subtitles.selectedIndex = trackIndex
        }
      })

      // Finally, make sure no two tracks have the same label
      relabelSubtitles(subtitles)
    } catch (err) { dispatch('error', err) }
  }

  checkForSubtitles () {
    this.checkForEmbeddedSubtitles()
    if (this.state.playing.type !== 'video') return
    const torrentSummary = this.state.getPlayingTorrentSummary()
    if (!torrentSummary || !torrentSummary.progress) return

    torrentSummary.progress.files.forEach((fp, ix) => {
      if (fp.numPieces !== fp.numPiecesPresent) return // ignore incomplete files
      const file = torrentSummary.files[ix]
      if (!this.isSubtitle(file.name)) return
      const filePath = path.join(torrentSummary.path, file.path)
      this.addSubtitles([filePath], false)
    })
  }

  checkForEmbeddedSubtitles () {
    const state = this.state
    if (state.playing.type !== 'video' || state.playing.location !== 'local') return
    const subtitles = state.playing.subtitles
    if (subtitles.loadingEmbedded || subtitles.checkedEmbedded) return
    const torrent = state.getPlayingTorrentSummary()
    const file = state.getPlayingFileSummary()
    if (!torrent || !file || !torrent.path) return
    const progress = torrent.progress && torrent.progress.files && torrent.progress.files[state.playing.fileIndex]
    // Reading an incomplete, preallocated MKV can yield corrupt subtitle packets.
    if (progress ? progress.numPiecesPresent !== progress.numPieces : torrent.status !== 'seeding') return
    const filePath = path.join(torrent.path, file.path)
    subtitles.loadingEmbedded = true
    if (subtitles.requestedEmbedded) subtitles.embeddedMessage = 'Looking for embedded subtitles…'
    native.extractEmbeddedSubtitles(filePath).then(tracks => {
      if (state.playing.subtitles !== subtitles) return // another file is now playing
      subtitles.checkedEmbedded = true
      subtitles.tracks.push(...tracks)
      if (subtitles.requestedEmbedded) subtitles.embeddedMessage = tracks.length ? 'Embedded subtitles are ready.' : 'No embedded subtitles found in this video.'
      const saved = file.selectedSubtitle
      let selected = tracks.findIndex(track => saved && typeof saved === 'object' && saved.filePath === track.filePath && saved.streamIndex === track.streamIndex)
      if (selected < 0) selected = tracks.findIndex(track => !track.forced && isSystemLanguage(track.language))
      if (selected < 0) selected = tracks.findIndex(track => track.default)
      if (selected < 0 && tracks.length) selected = 0
      if (selected >= 0 && subtitles.selectedIndex === -1 && !subtitles.userSelected) {
        subtitles.selectedIndex = subtitles.tracks.length - tracks.length + selected
      }
      relabelSubtitles(subtitles)
    }).catch(err => {
      if (state.playing.subtitles !== subtitles) return
      subtitles.checkedEmbedded = true
      dispatch('error', err)
    }).finally(() => { subtitles.loadingEmbedded = false })
  }

  isSubtitle (file) {
    const name = typeof file === 'string' ? file : file.name
    const ext = path.extname(name).toLowerCase()
    return ext === '.srt' || ext === '.vtt'
  }
}

// Checks whether a language name like 'English' or 'German' matches the system
// language, aka the current locale
function isSystemLanguage (language) {
  const iso639 = require('iso-639-1')
  const osLangISO = window.navigator.language.split('-')[0] // eg 'en'
  const langIso = iso639.getCode(language) // eg 'de' if language is 'German'
  return langIso === osLangISO
}

// Make sure we don't have two subtitle tracks with the same label
// Labels each track by language, eg 'German', 'English', 'English 2', ...
function relabelSubtitles (subtitles) {
  const counts = {}
  subtitles.tracks.forEach(track => {
    const lang = track.embedded ? track.baseLabel || track.label : track.language
    if (track.embedded) track.baseLabel = lang
    counts[lang] = (counts[lang] || 0) + 1
    track.label = counts[lang] > 1 ? (lang + ' ' + counts[lang]) : lang
  })
}
