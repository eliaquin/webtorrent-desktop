const semver = require('semver')
const config = require('../config')
const log = require('./log')
const windows = require('./windows')

// Personal builds only check personal releases. Installation remains explicit
// until signed update artifacts and a trusted update feed are configured.
async function init () {
  try {
    const response = await fetch('https://api.github.com/repos/eliaquin/webtorrent-desktop/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(10000)
    })
    if (response.status === 404) return // No public release yet.
    if (!response.ok) throw new Error('GitHub release check returned ' + response.status)
    const release = await response.json()
    const version = semver.valid(release.tag_name)
    if (version && !release.prerelease && semver.gt(version, config.APP_VERSION)) {
      windows.main.dispatch('updateAvailable', version)
    }
  } catch (err) {
    log('Update check: ' + err.message)
  }
}

module.exports = { init }
