const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const vm = require('vm')
const { createRequire } = require('module')

function load (file, overrides, runtime) {
  const filename = path.join(__dirname, '..', file)
  const localRequire = createRequire(filename)
  const module = { exports: {} }
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module,
    require: name => Object.hasOwn(overrides, name) ? overrides[name] : localRequire(name),
    process: runtime,
    __dirname: path.dirname(filename),
    console
  }, { filename })
  return module.exports
}

async function main () {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'torrentcat-identity-'))
  try {
    for (const platform of ['darwin', 'win32', 'linux']) {
      const paths = platform === 'win32' ? path.win32 : path.posix
      const home = platform === 'win32' ? 'C:\\Users\\Test' : directory
      const appData = paths.join(home, platform === 'darwin' ? 'Library/Application Support' : platform === 'win32' ? 'AppData/Roaming' : '.config')
      const env = platform === 'win32' ? { LOCALAPPDATA: paths.join(home, 'AppData/Local') } : platform === 'linux' ? { XDG_CONFIG_HOME: paths.join(home, 'custom-config') } : {}
      const runtime = { platform, env, versions: { electron: '44.7.0' }, execPath: platform === 'win32' ? 'C:\\Apps\\TorrentCat.exe' : '/Applications/TorrentCat.app/Contents/MacOS/TorrentCat' }
      const writes = {}
      const app = {
        getPath: key => key === 'appData' ? appData : paths.join(home, 'Downloads'),
        setPath: (key, value) => { writes[key] = value },
        setName: value => { writes.name = value }
      }
      const overrides = { electron: { app }, os: { homedir: () => home }, path: paths, fs: { accessSync: () => { throw new Error('not portable') }, constants: fs.constants } }
      const config = load('src/config.js', overrides, runtime)
      assert.strictEqual(config.APP_NAME, 'TorrentCat')
      const profileRoot = platform === 'darwin' ? appData : platform === 'win32' ? env.LOCALAPPDATA : env.XDG_CONFIG_HOME
      assert.strictEqual(config.CONFIG_PATH, paths.join(profileRoot, 'WebTorrent'))
      assert.strictEqual(config.TORRENT_PATH, paths.join(config.CONFIG_PATH, 'Torrents'))
      assert.strictEqual(config.DEFAULT_DOWNLOAD_PATH, paths.join(home, 'Downloads'))
      load('src/main/app-identity.js', overrides, runtime)(app, config)
      assert.strictEqual(writes.name, 'TorrentCat')
      assert.strictEqual(writes.userData, paths.join(appData, 'WebTorrent'))
      assert.strictEqual(writes.sessionData, writes.userData)

      // An explicitly configured profile and test/portable profile stay isolated.
      runtime.env.WEBTORRENT_CONFIG_PATH = paths.join(home, 'Custom Profile')
      const custom = load('src/config.js', overrides, runtime)
      load('src/main/app-identity.js', overrides, runtime)(app, custom)
      assert.strictEqual(custom.CONFIG_PATH, runtime.env.WEBTORRENT_CONFIG_PATH)
      assert.strictEqual(writes.userData, custom.CONFIG_PATH)
      delete runtime.env.WEBTORRENT_CONFIG_PATH
      runtime.env.NODE_ENV = 'test'
      runtime.env.WEBTORRENT_TEST_DIR = paths.join(home, 'Portable Settings')
      const portable = load('src/config.js', overrides, runtime)
      load('src/main/app-identity.js', overrides, runtime)(app, portable)
      assert.strictEqual(portable.CONFIG_PATH, runtime.env.WEBTORRENT_TEST_DIR)
      assert.strictEqual(portable.DEFAULT_DOWNLOAD_PATH, paths.join(portable.CONFIG_PATH, 'Downloads'))
      assert.strictEqual(writes.userData, portable.CONFIG_PATH)
      assert.strictEqual(writes.temp, paths.join(portable.CONFIG_PATH, 'Temp'))
    }

    // Load and save an existing profile and verify media/cache files stay untouched.
    const home = path.join(directory, 'existing-home')
    const runtime = { platform: 'darwin', env: {}, versions: {}, execPath: process.execPath }
    const config = load('src/config.js', { electron: {}, os: { homedir: () => home } }, runtime)
    fs.mkdirSync(config.CONFIG_PATH, { recursive: true })
    const downloads = path.join(home, 'My Downloads')
    const files = [path.join(downloads, 'movie.mkv'), path.join(config.TORRENT_PATH, 'saved.torrent'), path.join(config.POSTER_PATH, 'saved.jpg'), path.join(config.CONFIG_PATH, 'AudioCache', 'playback.mkv')]
    for (const file of files) {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, 'existing content')
    }
    const saved = { version: '0.27.5', prefs: { downloadPath: downloads, startup: false, soundNotifications: false }, torrents: [{ infoHash: 'a'.repeat(40), path: downloads, torrentFileName: 'saved.torrent', status: 'paused', selections: [true], fileModtimes: [123] }] }
    fs.writeFileSync(path.join(config.CONFIG_PATH, 'config.json'), JSON.stringify(saved))
    const storage = load('src/main/state-storage.js', { '../config': config }, runtime)
    assert.deepStrictEqual(JSON.parse(JSON.stringify(await storage.read())), saved)
    await storage.write(saved)
    assert.deepStrictEqual(JSON.parse(JSON.stringify(await storage.read())), saved)
    for (const file of files) assert.strictEqual(fs.readFileSync(file, 'utf8'), 'existing content')
    assert(!fs.existsSync(path.join(home, 'Library/Application Support/TorrentCat')))

    // Linux startup replaces old launchers; Windows keeps one registry entry.
    const xdg = path.join(directory, 'xdg')
    const startupConfig = { APP_NAME: 'TorrentCat', LEGACY_APP_NAME: 'WebTorrent', ROOT_PATH: '/source', IS_PRODUCTION: true }
    for (const folder of [path.join(xdg, 'autostart'), path.join(home, '.config/autostart')]) {
      fs.mkdirSync(folder, { recursive: true })
      fs.writeFileSync(path.join(folder, 'WebTorrent.desktop'), 'old launcher')
    }
    const startup = load('src/main/startup.js', { '../config': startupConfig, os: { homedir: () => home }, electron: { app: { getPath: () => '/opt/torrentcat/TorrentCat' } } }, { platform: 'linux', env: { XDG_CONFIG_HOME: xdg } })
    await startup.install()
    const launcher = path.join(xdg, 'autostart/TorrentCat.desktop')
    assert(fs.readFileSync(launcher, 'utf8').includes('Name=TorrentCat\nExec="/opt/torrentcat/TorrentCat" "--hidden"'))
    for (const folder of [path.join(xdg, 'autostart'), path.join(home, '.config/autostart')]) assert(!fs.existsSync(path.join(folder, 'WebTorrent.desktop')))
    await startup.uninstall()
    assert(!fs.existsSync(launcher))
    const loginCalls = []
    const windows = load('src/main/startup.js', { '../config': startupConfig, electron: { app: { setLoginItemSettings: settings => loginCalls.push(settings) } } }, { platform: 'win32', env: {}, execPath: '/missing/TorrentCat.exe' })
    await windows.install()
    await windows.uninstall()
    assert.deepStrictEqual(loginCalls.map(call => [call.name, call.openAtLogin]), [['WebTorrent', true], ['WebTorrent', false]])
    console.log('Identity checks passed: historical profiles on all platforms, overrides, portable paths, saved downloads and startup entries')
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
