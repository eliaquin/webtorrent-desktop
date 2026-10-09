const path = require('path')
const config = require('../config')
const defaultAnnounceList = config.DEFAULT_TRACKERS

module.exports = { createState: getDefaultState, getDefaultPlayState }

function getDefaultState () {
  const LocationHistory = require('location-history')

  return {
    /*
     * Temporary state disappears once the program exits.
     * It can contain complex objects like open connections, etc.
     */
    client: null, /* the WebTorrent client */
    server: null, /* local WebTorrent-to-HTTP server */
    prev: { /* used for state diffing in updateElectron() */
      title: null,
      progress: -1,
      badge: null
    },
    location: new LocationHistory(),
    window: {
      bounds: null, /* {x, y, width, height } */
      isFocused: true,
      isFullScreen: false,
      title: config.APP_WINDOW_TITLE
    },
    selectedInfoHash: null, /* the torrent we've selected to view details. see state.torrents */
    playing: getDefaultPlayState(), /* the media (audio or video) that we're currently playing */
    devices: {}, /* playback devices like Chromecast and AppleTV */
    dock: {
      badge: 0,
      progress: 0
    },
    modal: null, /* modal popover */
    errors: [], /* user-facing errors */
    nextTorrentKey: 1, /* identify torrents for IPC between the main and webtorrent windows */

    /*
     * Saved state is read from and written to a file every time the app runs.
     * It should be simple and minimal and must be JSON.
     * It must never contain absolute paths since we have a portable app.
     *
     * Config path:
     *
     * Mac                  ~/Library/Application Support/WebTorrent/config.json
     * Linux (XDG)          $XDG_CONFIG_HOME/WebTorrent/config.json
     * Linux (Legacy)       ~/.config/WebTorrent/config.json
     * Windows (> Vista)    %LOCALAPPDATA%/WebTorrent/config.json
     *
     * Managed atomically by the main process state-storage module.
     */
    saved: {},

    /*
     * Getters, for convenience
     */
    getPlayingTorrentSummary,
    getPlayingFileSummary,
    getExternalPlayerName,
    getGlobalTrackers,
    shouldHidePlayerControls
  }
}

/* Whenever we stop playing video or audio, here's what we reset state.playing to */
function getDefaultPlayState () {
  return {
    infoHash: null, /* the info hash of the torrent we're playing */
    fileIndex: null, /* the zero-based index within the torrent */
    fileName: null, /* name of the file that is playing */
    location: 'local', /* 'local', 'chromecast', 'airplay' */
    type: null, /* 'audio' or 'video', could be 'other' if ever support eg streaming to VLC */
    engine: 'chromium',
    nativeSession: null,
    currentTime: 0, /* seconds */
    duration: 1, /* seconds */
    isReady: false,
    isPaused: true,
    isStalled: false,
    lastTimeUpdate: 0, /* Unix time in ms */
    mouseStationarySince: 0, /* Unix time in ms */
    playbackRate: 1,
    volume: 1,
    subtitles: {
      tracks: [], /* subtitle tracks, each {label, language, ...} */
      selectedIndex: -1, /* current subtitle track */
      showMenu: false, /* popover menu, above the video */
      showInstallNotice: false,
      showInstallSteps: false,
      embeddedMessage: ''
    },
    audioSupport: {},
    audioTracks: {
      tracks: [],
      selectedIndex: 0, /* current audio track */
      showMenu: false /* popover menu, above the video */
    },
    aspectRatio: 0 /* aspect ratio of the video */
  }
}

function getPlayingTorrentSummary () {
  const infoHash = this.playing.infoHash
  return this.saved.torrents.find((x) => x.infoHash === infoHash)
}

function getPlayingFileSummary () {
  const torrentSummary = this.getPlayingTorrentSummary()
  if (!torrentSummary) return null
  return torrentSummary.files[this.playing.fileIndex]
}

function getExternalPlayerName () {
  const playerPath = this.saved.prefs.externalPlayerPath
  if (!playerPath) return 'VLC'
  return path.basename(playerPath).split('.')[0]
}

function shouldHidePlayerControls () {
  return this.location.url() === 'player' &&
    this.playing.mouseStationarySince !== 0 &&
    new Date().getTime() - this.playing.mouseStationarySince > 2000 &&
    !this.playing.mouseInControls &&
    !this.playing.subtitles.showMenu &&
    !this.playing.isPaused &&
    this.playing.location === 'local'
}

function getGlobalTrackers () {
  const trackers = this.saved.prefs.globalTrackers
  if (!trackers) {
    return defaultAnnounceList
  }
  return trackers
}
