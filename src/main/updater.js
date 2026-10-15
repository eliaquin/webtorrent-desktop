const semver = require('semver')

const RELEASES_URL = 'https://github.com/eliaquin/webtorrent-desktop/releases'
const API_URL = 'https://api.github.com/repos/eliaquin/webtorrent-desktop/releases/latest'
const CHECK_INTERVAL = 6 * 60 * 60 * 1000

function availableUpdate (release, currentVersion, platform, arch) {
  const version = semver.valid(release?.tag_name)
  if (!version || release.draft || release.prerelease || semver.prerelease(version) ||
      !semver.gt(version, currentVersion)) return null
  const prefix = `WebTorrent-v${version}`
  const names = platform === 'darwin'
    ? [`${prefix}-darwin-${arch}.dmg`, `${prefix}-darwin-${arch}.zip`]
    : platform === 'win32' && arch === 'x64'
      ? [`WebTorrentSetup-v${version}.exe`, `${prefix}-win.zip`]
      : platform === 'linux' ? [`${prefix}-linux-${arch}.zip`] : []
  const assets = Array.isArray(release.assets) ? release.assets : []
  const usable = asset => asset.state === 'uploaded' && asset.size > 0
  const asset = names.map(name => assets.find(asset => asset.name === name && usable(asset))).find(Boolean)
  const releaseURL = `${RELEASES_URL}/tag/${encodeURIComponent(release.tag_name)}`
  if (asset) {
    const downloadURL = `${RELEASES_URL}/download/${encodeURIComponent(release.tag_name)}/${encodeURIComponent(asset.name)}`
    // Never open an arbitrary URL supplied by release metadata.
    if (asset.browser_download_url !== downloadURL) return null
    return { version, downloadURL, releaseURL, directDownload: true }
  }
  // Linux users choose the package format for their distribution.
  if (platform === 'linux' && assets.some(asset => usable(asset) &&
      [`${prefix}-linux-${arch}.deb`, `${prefix}-linux-${arch}.rpm`].includes(asset.name))) {
    return { version, downloadURL: releaseURL, releaseURL, directDownload: false }
  }
  return null // Don't announce releases without a download for this computer.
}

function createUpdater ({
  currentVersion, platform, arch,
  fetch: request = globalThis.fetch,
  notify = () => {}, log = () => {},
  setInterval: schedule = setInterval, clearInterval: cancel = clearInterval
}) {
  let inFlight
  let timer
  function check () {
    if (inFlight) return inFlight
    inFlight = (async () => {
      try {
        const response = await request(API_URL, {
          headers: { Accept: 'application/vnd.github+json' },
          signal: AbortSignal.timeout(10000)
        })
        if (response.status === 404) return { status: 'current' }
        if (!response.ok) throw new Error('GitHub release check returned ' + response.status)
        const update = availableUpdate(await response.json(), currentVersion, platform, arch)
        return update ? { status: 'available', ...update } : { status: 'current' }
      } catch (error) {
        log('Update check: ' + error.message)
        return { status: 'error' }
      }
    })().finally(() => { inFlight = null })
    return inFlight
  }
  async function backgroundCheck () {
    const result = await check()
    if (result.status === 'available') notify(result)
  }
  return {
    check,
    start () {
      if (timer) return
      backgroundCheck()
      timer = schedule(backgroundCheck, CHECK_INTERVAL)
      timer.unref?.()
    },
    stop () {
      if (timer) cancel(timer)
      timer = null
    }
  }
}

let updater
function getUpdater () {
  if (!updater) {
    updater = createUpdater({
      currentVersion: require('../config').APP_VERSION,
      platform: process.platform,
      arch: process.arch,
      notify: update => require('./windows').main.dispatch('updateAvailable', update),
      log: require('./log')
    })
  }
  return updater
}

function init () {
  const { app } = require('electron')
  const start = () => getUpdater().start()
  if (app.ipcReady) start()
  else app.once('ipcReady', start)
  app.once('will-quit', () => getUpdater().stop())
}

module.exports = { init, check: () => getUpdater().check(), createUpdater, availableUpdate, CHECK_INTERVAL }
