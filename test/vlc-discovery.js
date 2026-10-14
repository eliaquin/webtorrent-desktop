const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const vm = require('vm')
const { EventEmitter } = require('events')
const findVlc = require('../src/main/vlc-discovery')

function filesystem (files) {
  return {
    access: async file => { if (!files.includes(file)) throw new Error('missing') },
    stat: async () => ({ isFile: () => true })
  }
}

async function main () {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'webtorrent-vlc-'))
  try {
    const bin = path.join(directory, 'path with spaces')
    fs.mkdirSync(bin)
    const command = path.join(bin, 'vlc')
    fs.writeFileSync(command, '#!/bin/sh\nexit 0\n', { mode: 0o755 })
    const access = async (file, mode) => {
      if (file !== command) throw new Error('outside test fixture')
      await fs.promises.access(file, mode)
    }
    assert.deepStrictEqual(await findVlc({ platform: 'linux', env: { PATH: bin }, access }), { command, args: [] })
    fs.chmodSync(command, 0o644)
    await assert.rejects(findVlc({ platform: 'linux', env: { PATH: bin }, access }), /VLC not found/)
    const system = '/Applications/VLC.app/Contents/MacOS/VLC'
    const user = '/Users/Example Person/Applications/VLC.app/Contents/MacOS/VLC'
    const mac = { platform: 'darwin', home: '/Users/Example Person', env: { PATH: bin } }
    assert.strictEqual((await findVlc({ ...mac, ...filesystem([system, user, command]) })).command, system)
    assert.strictEqual((await findVlc({ ...mac, ...filesystem([user]) })).command, user)
    await assert.rejects(findVlc({ ...mac, ...filesystem([system]), stat: async () => ({ isFile: () => false }) }), /VLC not found/)

    const windowsCommand = 'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe'
    const keys = []
    const readRegistry = async key => { keys.push(key); return key.includes('Wow6432Node') ? path.win32.dirname(windowsCommand) : 'C:\\missing' }
    assert.deepStrictEqual(await findVlc({ platform: 'win32', env: {}, readRegistry, ...filesystem([windowsCommand]) }), { command: windowsCommand, args: [] })
    assert.strictEqual(keys.length, 2, 'both registry locations are checked')
    assert.strictEqual((await findVlc({ platform: 'win32', env: { 'ProgramFiles(x86)': 'C:\\Program Files (x86)' }, readRegistry: async () => null, ...filesystem([windowsCommand]) })).command, windowsCommand)
    assert.strictEqual((await findVlc({ platform: 'win32', env: { Path: '"D:\\Media Tools"' }, readRegistry: async () => null, ...filesystem(['D:\\Media Tools\\vlc.exe']) })).command, 'D:\\Media Tools\\vlc.exe')

    const calls = []
    const flatpak = await findVlc({ platform: 'linux', env: { PATH: '/usr/bin' }, ...filesystem(['/usr/bin/flatpak']), run: async (...args) => { calls.push(args) } })
    assert.deepStrictEqual(flatpak, { command: '/usr/bin/flatpak', args: ['run', 'org.videolan.VLC'] })
    assert.deepStrictEqual(calls[0].slice(0, 2), ['/usr/bin/flatpak', ['info', 'org.videolan.VLC']])
    await assert.rejects(findVlc({ platform: 'linux', env: {}, ...filesystem(['/usr/bin/flatpak']), run: async () => { throw new Error('not installed') } }), /VLC not found/)
    await assert.rejects(findVlc({ platform: 'linux', env: { PATH: '.:relative' }, ...filesystem(['relative/vlc']) }), /VLC not found/)
    await testLaunch(flatpak)
    console.log('VLC discovery checks passed: executable permissions, macOS bundles, Windows registry/PATH fallbacks and Flatpak arguments')
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

async function testLaunch (flatpak) {
  const calls = []
  const events = []
  const child = new EventEmitter()
  child.kill = () => {}
  let missing = false
  const dependencies = {
    child_process: { spawn: (command, args, options) => { calls.push({ command, args: Array.from(args), options }); return child } },
    path,
    './vlc-discovery': async () => { if (missing) throw new Error('not found'); return flatpak },
    './log': () => {},
    './windows': { main: { dispatch: name => events.push(name) } }
  }
  const context = { module: { exports: {} }, require: name => dependencies[name], process: { platform: 'darwin', nextTick: process.nextTick }, setTimeout: () => 1, clearTimeout: () => {} }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/main/external-player.js'), 'utf8'), context)
  const player = context.module.exports
  player.spawn('', 'http://127.0.0.1/movie', 'Title "with quotes"')
  await new Promise(resolve => setImmediate(resolve))
  assert.strictEqual(calls[0].command, '/usr/bin/flatpak')
  assert.deepStrictEqual(calls[0].args, ['run', 'org.videolan.VLC', '--play-and-exit', '--quiet', '--meta-title=Title "with quotes"', 'http://127.0.0.1/movie'])
  assert.strictEqual(calls[0].options.shell, undefined)
  player.kill()
  player.spawn('/Media Players/Custom.app', 'http://127.0.0.1/custom')
  assert.strictEqual(calls[1].command, '/Media Players/Custom.app/Contents/MacOS/Custom')
  assert.deepStrictEqual(calls[1].args, ['http://127.0.0.1/custom'])
  player.kill()
  missing = true
  player.spawn('', 'http://127.0.0.1/missing')
  await new Promise(resolve => setImmediate(resolve))
  assert.deepStrictEqual(events, ['externalPlayerNotFound'])
}

main().catch(err => { console.error(err); process.exitCode = 1 })
