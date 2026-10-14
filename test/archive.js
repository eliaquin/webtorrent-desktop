const assert = require('assert')
const cp = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { zipSync } = require('../bin/archive')

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'webtorrent-archive-'))
try {
  const input = path.join(directory, "App space $'quote.app")
  const output = path.join(directory, 'bundle.zip')
  fs.mkdirSync(input)
  fs.writeFileSync(path.join(input, 'run'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
  fs.writeFileSync(path.join(input, 'old'), 'remove this before rebuilding')
  fs.symlinkSync('run', path.join(input, 'link'))
  for (const platform of process.platform === 'darwin' ? ['darwin', 'linux'] : [process.platform]) {
    if (platform === 'win32') continue // Native Windows archives need a Windows runner.
    zipSync(input, output, { platform })
    const extracted = path.join(directory, 'extracted-' + platform)
    cp.execFileSync('unzip', ['-q', output, '-d', extracted])
    const bundle = path.join(extracted, path.basename(input))
    assert.strictEqual(fs.readFileSync(path.join(bundle, 'run'), 'utf8'), '#!/bin/sh\nexit 0\n')
    assert(fs.statSync(path.join(bundle, 'run')).mode & 0o111, 'executable bits survive ZIP extraction')
    assert.strictEqual(fs.readlinkSync(path.join(bundle, 'link')), 'run', 'symlinks survive ZIP extraction')
  }
  fs.unlinkSync(path.join(input, 'old'))
  zipSync(input, output)
  assert(!cp.execFileSync('unzip', ['-Z1', output], { encoding: 'utf8' }).split('\n').some(name => name.endsWith('/old')), 'rebuilding removes stale ZIP entries')
  const original = fs.readFileSync(output)
  assert.throws(() => zipSync(input, output, { run: () => { throw new Error('archive failure') } }), /archive failure/)
  assert.deepStrictEqual(fs.readFileSync(output), original, 'failed builds preserve the previous archive')
  assert.throws(() => zipSync(input, path.join(input, 'recursive.zip')), /outside/)
  zipSync(input, output, {
    platform: 'win32',
    run: (command, args, options) => {
      assert.strictEqual(command, 'powershell.exe')
      assert(!args.join(' ').includes(input), 'paths are never PowerShell source')
      assert.strictEqual(options.env.WEBTORRENT_ZIP_INPUT, input)
      assert.strictEqual(options.shell, undefined)
      fs.writeFileSync(options.env.WEBTORRENT_ZIP_OUTPUT, 'Windows command contract')
    }
  })
  assert(!fs.readdirSync(directory).some(name => name.startsWith('.webtorrent-zip-')), 'temporary archives are cleaned up')
  console.log('Archive checks passed: contents, executable modes, symlinks, replacement, rollback and shell-free Windows paths')
} finally {
  fs.rmSync(directory, { recursive: true, force: true })
}
