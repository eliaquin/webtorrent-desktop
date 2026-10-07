const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const version = require('../package.json').version
const prefix = 'WebTorrent-v' + version + '-'

// Run explicitly after merging, tagging and validating distribution builds.
const artifacts = fs.readdirSync('dist').filter(name => name.startsWith(prefix) && /\.(zip|dmg|exe|deb|rpm|nupkg|txt)$/.test(name)).map(name => path.join('dist', name))
if (!artifacts.length) throw new Error('No artifacts for v' + version + '; run the package and checksums commands first')
execFileSync('gh', ['release', 'create', 'v' + version, '--repo', 'eliaquin/webtorrent-desktop', '--draft', '--generate-notes', '--verify-tag', ...artifacts], { stdio: 'inherit' })
