const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { findRuntime } = require('../src/main/vlc-runtime')

function buildNative () {
  if (process.platform !== 'darwin') return
  const runtime = findRuntime()
  if (!runtime || !fs.existsSync(path.join(runtime, 'include/vlc/vlc.h'))) {
    console.log('Native VLC: install VLC.app to build the optional macOS player')
    return
  }
  const arch = process.env.WEBTORRENT_NATIVE_ARCH || process.arch
  if (!['arm64', 'x64'].includes(arch)) throw new Error('Unsupported native player architecture: ' + arch)
  const output = path.resolve('build/native', `vlc-${arch}.node`)
  fs.mkdirSync(path.dirname(output), { recursive: true })
  execFileSync('clang++', [
    '-std=c++17', '-fobjc-arc', '-shared', '-undefined', 'dynamic_lookup',
    '-framework', 'Cocoa', '-DNAPI_VERSION=8', '-mmacosx-version-min=11.0',
    '-arch', arch === 'x64' ? 'x86_64' : arch,
    '-I', require('node-api-headers').include_dir, '-I', path.join(runtime, 'include'),
    path.resolve('native/vlc-player.mm'), '-o', output
  ], { stdio: 'inherit' })
  console.log('Native VLC: built ' + arch + ' Node-API bridge')
}

if (require.main === module) buildNative()
module.exports = buildNative
