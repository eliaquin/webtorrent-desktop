const os = require('os')
const path = require('path')
const { app } = require('electron')

const APP_NAME = 'WebTorrent'
const APP_TEAM = 'WebTorrent, LLC'
const APP_VERSION = require('../package.json').version

const IS_TEST = isTest()
const PORTABLE_PATH = IS_TEST
  ? (process.env.WEBTORRENT_TEST_DIR || path.join(process.platform === 'win32' ? 'C:\\Windows\\Temp' : '/tmp', 'WebTorrentTest'))
  : path.join(path.dirname(process.execPath), 'Portable Settings')
const IS_PRODUCTION = isProduction()
const IS_PORTABLE = isPortable()

const UI_HEADER_HEIGHT = 38
const UI_TORRENT_HEIGHT = 100

module.exports = {

  APP_COPYRIGHT: `Copyright © 2014-${new Date().getFullYear()} ${APP_TEAM}`,
  APP_FILE_ICON: path.join(__dirname, '..', 'static', 'WebTorrentFile'),
  APP_ICON: path.join(__dirname, '..', 'static', 'WebTorrent'),
  APP_NAME,
  APP_TEAM,
  APP_VERSION,
  APP_WINDOW_TITLE: APP_NAME,

  CONFIG_PATH: getConfigPath(),

  DEFAULT_TORRENTS: [
    {
      testID: 'bbb',
      name: 'Big Buck Bunny',
      posterFileName: 'bigBuckBunny.jpg',
      torrentFileName: 'bigBuckBunny.torrent'
    },
    {
      testID: 'cosmos',
      name: 'Cosmos Laundromat (Preview)',
      posterFileName: 'cosmosLaundromat.jpg',
      torrentFileName: 'cosmosLaundromat.torrent'
    },
    {
      testID: 'sintel',
      name: 'Sintel',
      posterFileName: 'sintel.jpg',
      torrentFileName: 'sintel.torrent'
    },
    {
      testID: 'tears',
      name: 'Tears of Steel',
      posterFileName: 'tearsOfSteel.jpg',
      torrentFileName: 'tearsOfSteel.torrent'
    },
    {
      testID: 'wired',
      name: 'The WIRED CD - Rip. Sample. Mash. Share',
      posterFileName: 'wiredCd.jpg',
      torrentFileName: 'wiredCd.torrent'
    }
  ],

  DELAYED_INIT: 3000 /* 3 seconds */,

  DEFAULT_DOWNLOAD_PATH: getDefaultDownloadPath(),
  DEFAULT_TRACKERS: [], // Filled from create-torrent during main-process state initialization.

  GITHUB_URL: 'https://github.com/eliaquin/webtorrent-desktop',
  GITHUB_URL_ISSUES: 'https://github.com/eliaquin/webtorrent-desktop/issues',
  GITHUB_URL_RAW: 'https://raw.githubusercontent.com/eliaquin/webtorrent-desktop/main',
  GITHUB_URL_RELEASES: 'https://github.com/eliaquin/webtorrent-desktop/releases',

  HOME_PAGE_URL: 'https://webtorrent.io',
  TWITTER_PAGE_URL: 'https://twitter.com/WebTorrentApp',

  IS_PORTABLE,
  IS_PRODUCTION,
  IS_TEST,

  OS_SYSARCH: process.arch,

  POSTER_PATH: path.join(getConfigPath(), 'Posters'),
  ROOT_PATH: path.join(__dirname, '..'),
  STATIC_PATH: path.join(__dirname, '..', 'static'),
  TORRENT_PATH: path.join(getConfigPath(), 'Torrents'),

  WINDOW_ABOUT: 'file://' + path.join(__dirname, '..', 'static', 'about.html'),
  WINDOW_MAIN: 'file://' + path.join(__dirname, '..', 'static', 'main.html'),

  WINDOW_INITIAL_BOUNDS: {
    width: 500,
    height: UI_HEADER_HEIGHT + (UI_TORRENT_HEIGHT * 6) // header + 6 torrents
  },
  WINDOW_MIN_HEIGHT: UI_HEADER_HEIGHT + (UI_TORRENT_HEIGHT * 2), // header + 2 torrents
  WINDOW_MIN_WIDTH: 425,

  UI_HEADER_HEIGHT,
  UI_TORRENT_HEIGHT
}

function getConfigPath () {
  if (process.env.WEBTORRENT_CONFIG_PATH) return process.env.WEBTORRENT_CONFIG_PATH
  if (IS_PORTABLE) {
    return PORTABLE_PATH
  } else {
    if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', APP_NAME)
    if (process.platform === 'win32') return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'Local Settings', 'Application Data'), APP_NAME)
    return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), APP_NAME)
  }
}

function getDefaultDownloadPath () {
  if (IS_PORTABLE) {
    return path.join(getConfigPath(), 'Downloads')
  } else {
    return getPath('downloads')
  }
}

function getPath (key) {
  if (process.type === 'utility') return process.env.WEBTORRENT_DOWNLOAD_PATH || ''
  if (!process.versions.electron) {
    // Node.js process
    return ''
  } else {
    // Electron main process
    return app.getPath(key)
  }
}

function isTest () {
  return process.env.NODE_ENV === 'test'
}

function isPortable () {
  if (IS_TEST) {
    return true
  }

  if (process.platform !== 'win32' || !IS_PRODUCTION) {
    // Fast path: Non-Windows platforms should not check for path on disk
    return false
  }

  const fs = require('fs')

  try {
    // This line throws if the "Portable Settings" folder does not exist, and does
    // nothing otherwise.
    fs.accessSync(PORTABLE_PATH, fs.constants.R_OK | fs.constants.W_OK)
    return true
  } catch (err) {
    return false
  }
}

function isProduction () {
  if (!process.versions.electron) {
    // Node.js process
    return false
  }
  if (process.platform === 'darwin') {
    return !/\/Electron\.app\//.test(process.execPath)
  }
  if (process.platform === 'win32') {
    return !/\\electron\.exe$/.test(process.execPath)
  }
  if (process.platform === 'linux') {
    return !/\/electron$/.test(process.execPath)
  }
}
