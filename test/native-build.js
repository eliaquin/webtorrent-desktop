const assert = require('assert')
const cp = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const vm = require('vm')

if (process.platform === 'darwin') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'webtorrent-native-build-'))
  try {
    for (const arch of ['arm64', 'x64']) {
      const output = path.join(directory, `vlc-${arch}.node`)
      const dependencies = {
        child_process: {
          execFileSync: (command, args, options) => {
            args[args.indexOf('-o') + 1] = output
            return cp.execFileSync(command, args, options)
          }
        },
        fs: { ...fs, existsSync: () => false },
        path,
        'node-api-headers': require('node-api-headers'),
        '../src/main/vlc-runtime': { findRuntime: () => null }
      }
      const context = {
        module: { exports: {} },
        require: name => {
          assert(name in dependencies, 'Unexpected build dependency: ' + name)
          return dependencies[name]
        },
        __dirname: path.join(__dirname, '../bin'),
        process: { platform: 'darwin', arch: process.arch, env: { WEBTORRENT_NATIVE_ARCH: arch } },
        console
      }
      vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../bin/build-native.js'), 'utf8'), context)
      context.module.exports()
      assert(fs.existsSync(output), 'the bridge must be built even without VLC installed')
      const architectures = cp.execFileSync('lipo', ['-archs', output], { encoding: 'utf8' }).trim()
      assert.strictEqual(architectures, arch === 'x64' ? 'x86_64' : arch)
      const links = cp.execFileSync('otool', ['-L', output], { encoding: 'utf8' })
      assert(!/libvlc|VLC\.app/.test(links), 'the bridge must not link against an installed VLC')
      if (arch === process.arch) assert.strictEqual(typeof require(output).open, 'function')
    }
    console.log('Native build checks passed: both Mac architectures build without VLC and have no VLC linkage')
  } finally { fs.rmSync(directory, { recursive: true, force: true }) }
} else {
  console.log('Native bridge compilation checks require macOS')
}
