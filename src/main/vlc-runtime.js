const fs = require('fs')
const os = require('os')
const path = require('path')

// Use the user's VLC installation. No player binaries or plugins are downloaded.
function findRuntime () {
  if (process.platform !== 'darwin') return null
  const candidates = [
    process.env.WEBTORRENT_VLC_PATH,
    '/Applications/VLC.app/Contents/MacOS',
    path.join(os.homedir(), 'Applications/VLC.app/Contents/MacOS')
  ].filter(Boolean)
  return candidates.find(root => fs.existsSync(path.join(root, 'lib/libvlc.dylib')) && fs.existsSync(path.join(root, 'plugins'))) || null
}

module.exports = { findRuntime }
