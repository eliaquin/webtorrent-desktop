const cp = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

function packageMac (appPath, outputBase, dmg = true) {
  require('./archive').zipSync(appPath, outputBase + '.zip')
  if (!dmg) return
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'webtorrent-dmg-'))
  try {
    cp.execFileSync('ditto', [appPath, path.join(staging, 'WebTorrent.app')])
    fs.symlinkSync('/Applications', path.join(staging, 'Applications'))
    cp.execFileSync('hdiutil', ['create', '-volname', 'WebTorrent', '-srcfolder', staging, '-ov', '-format', 'UDZO', outputBase + '.dmg'], { stdio: 'inherit' })
  } finally {
    fs.rmSync(staging, { recursive: true, force: true })
  }
}

module.exports = { packageMac }
