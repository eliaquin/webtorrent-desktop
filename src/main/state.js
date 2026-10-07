const storage = require('./state-storage')
const path = require('path')

const config = require('../config')
const defaultAnnounceList = config.DEFAULT_TRACKERS
const { createState: getDefaultState } = require('../shared/state')

let profile
let loading
module.exports = { load, saveImmediate }

/* If the saved state file doesn't exist yet, here's what we use instead */
async function setupStateSaved () {
  const { copyFile, mkdir, readFile } = require('fs/promises')
  const { default: parseTorrent, toMagnetURI } = await import('parse-torrent')

  const saved = {
    prefs: {
      downloadPath: config.DEFAULT_DOWNLOAD_PATH,
      isFileHandler: false,
      openExternalPlayer: false,
      externalPlayerPath: '',
      startup: false,
      soundNotifications: true,
      autoAddTorrents: false,
      torrentsFolderPath: '',
      highestPlaybackPriority: true,
      globalTrackers: defaultAnnounceList
    },
    torrents: await Promise.all(config.DEFAULT_TORRENTS.map(createTorrentObject)),
    torrentsToResume: [],
    version: config.APP_VERSION /* make sure we can upgrade gracefully later */
  }

  await mkdir(config.POSTER_PATH, { recursive: true })
  await mkdir(config.TORRENT_PATH, { recursive: true })

  await Promise.all(config.DEFAULT_TORRENTS.map(async (t, i) => {
    const infoHash = saved.torrents[i].infoHash
    await copyFile(
      path.join(config.STATIC_PATH, t.posterFileName),
      path.join(config.POSTER_PATH, infoHash + path.extname(t.posterFileName))
    )
    await copyFile(
      path.join(config.STATIC_PATH, t.torrentFileName),
      path.join(config.TORRENT_PATH, infoHash + '.torrent')
    )
  }))

  return saved

  async function createTorrentObject (t) {
    const torrent = await readFile(path.join(config.STATIC_PATH, t.torrentFileName))
    const parsedTorrent = await parseTorrent(torrent)

    return {
      status: 'paused',
      infoHash: parsedTorrent.infoHash,
      name: t.name,
      displayName: t.name,
      posterFileName: parsedTorrent.infoHash + path.extname(t.posterFileName),
      torrentFileName: parsedTorrent.infoHash + '.torrent',
      magnetURI: toMagnetURI(parsedTorrent),
      files: parsedTorrent.files,
      selections: parsedTorrent.files.map((x) => true),
      testID: t.testID
    }
  }
}

async function load () {
  loading ||= readSaved()
  const state = getDefaultState()
  state.saved = await loading
  return state
}

async function readSaved () {
  const { announceList } = await import('create-torrent')
  defaultAnnounceList.push(...announceList.flat())
  let saved = await storage.read()
  if (!saved || !saved.version) saved = await setupStateSaved()
  profile = saved
  if (process.type === 'browser') require('./migrations').run({ saved })
  return profile
}

// Write state.saved to the JSON state file
async function saveImmediate (state, cb) {
  console.log('Saving state to ' + storage.filePath)

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
    await storage.write(copy)
    if (profile) Object.assign(profile, copy)
  } catch (err) {
    console.error(err)
    throw err
  }
}
