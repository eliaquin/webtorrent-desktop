#!/usr/bin/env node

// A profile reset is intentionally separate from ordinary build cleanup.
const fs = require('fs')
const path = require('path')
const config = require('../src/config')

if (!process.argv.includes('--confirm-profile-reset')) {
  console.error('This removes saved settings, torrent history and cached metadata; downloads are preserved.')
  console.error('Quit WebTorrent, then run npm run reset-app -- --confirm-profile-reset to proceed.')
  process.exitCode = 1
} else {
  let downloadPath = config.DEFAULT_DOWNLOAD_PATH
  const filename = path.join(config.CONFIG_PATH, 'config.json')
  try { downloadPath = JSON.parse(fs.readFileSync(filename)).prefs.downloadPath || downloadPath } catch (_) {}
  const inside = (root, candidate) => {
    const relative = path.relative(path.resolve(root), path.resolve(candidate))
    return !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)
  }
  for (const name of ['Posters', 'Torrents']) {
    const target = path.join(config.CONFIG_PATH, name)
    if (downloadPath && (inside(target, downloadPath) || inside(downloadPath, target))) continue
    fs.rmSync(target, { recursive: true, force: true })
  }
  fs.rmSync(filename, { force: true })
  fs.rmSync(filename + '.bak', { force: true })
  console.log('Reset app settings/history; preserved downloads and other profile files.')
}
