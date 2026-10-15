const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function buildNative () {
  if (process.platform !== 'darwin') return
  // Always ship the bridge. VLC itself is discovered and loaded at runtime.
  const arch = process.env.WEBTORRENT_NATIVE_ARCH || process.arch
  if (!['arm64', 'x64'].includes(arch)) throw new Error('Unsupported native player architecture: ' + arch)
  const output = path.resolve('build/native', `vlc-${arch}.node`)
  fs.mkdirSync(path.dirname(output), { recursive: true })
  execFileSync('clang++', [
    '-std=c++17', '-fobjc-arc', '-shared', '-undefined', 'dynamic_lookup',
    '-framework', 'Cocoa', '-DNAPI_VERSION=8', '-mmacosx-version-min=11.0',
    '-arch', arch === 'x64' ? 'x86_64' : arch,
    '-I', require('node-api-headers').include_dir, '-I', path.resolve(__dirname, '../native/vendor/libvlc/include'),
    path.resolve('native/vlc-player.mm'), '-o', output
  ], { stdio: 'inherit' })
  console.log('Native VLC: built ' + arch + ' Node-API bridge')
}

if (require.main === module) buildNative()
module.exports = buildNative
