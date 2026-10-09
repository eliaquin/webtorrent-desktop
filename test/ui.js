/* globals document, window */

// Exercise the React UI in Electron's real DOM without a WebDriver dependency.
process.env.NODE_ENV = 'test'
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { pathToFileURL } = require('url')

const projectRoot = path.join(__dirname, '..')
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webtorrent-ui-'))
const fixture = path.join(tempDir, 'index.html')
const stylesheet = pathToFileURL(path.join(projectRoot, 'static', 'main.css')).href
fs.writeFileSync(fixture, `<!doctype html><link rel="stylesheet" href="${stylesheet}"><div id="body"></div>`)

const timeout = setTimeout(() => {
  console.error('UI tests timed out')
  finish(1)
}, 30000)

function finish (code) {
  clearTimeout(timeout)
  fs.rmSync(tempDir, { recursive: true, force: true })
  app.exit(code)
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 800,
    webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false }
  })
  await win.loadFile(fixture)
  console.log(await win.webContents.executeJavaScript(`(${runPlaybackRegressions.toString()})(${JSON.stringify(projectRoot)}, ${JSON.stringify(tempDir)})`))
  console.log(await win.webContents.executeJavaScript(`(${runAudioRegressions.toString()})(${JSON.stringify(projectRoot)})`))
  const result = await win.webContents.executeJavaScript(`(${runUI.toString()})(${JSON.stringify(projectRoot)})`)
  console.log(result)
  if (process.env.UI_SCREENSHOT_PATH) {
    // Allow the compositor to paint and the app's fade-in animation to finish.
    await new Promise(resolve => setTimeout(resolve, 700))
    const image = await win.webContents.capturePage()
    fs.writeFileSync(process.env.UI_SCREENSHOT_PATH, image.toPNG())
  }
  finish(0)
}).catch(err => {
  console.error(err)
  finish(1)
})

async function runPlaybackRegressions (projectRoot, directory) {
  const assert = require('assert')
  const fs = require('fs')
  const path = require('path')
  const { ipcRenderer } = require('electron')
  const native = require(projectRoot + '/build/renderer/lib/native-api')
  const dispatcher = require(projectRoot + '/build/renderer/lib/dispatcher')
  const TorrentListController = require(projectRoot + '/build/renderer/controllers/torrent-list-controller')
  const SubtitlesController = require(projectRoot + '/build/renderer/controllers/subtitles-controller')
  const { createStore } = require(projectRoot + '/build/renderer/lib/store')
  const { extractEmbeddedSubtitles } = require(projectRoot + '/build/engine/embedded-subtitles')
  const { readSubtitle } = require(projectRoot + '/build/engine/subtitles')
  const originals = { send: ipcRenderer.send, statPath: native.statPath, extract: native.extractEmbeddedSubtitles, access: fs.accessSync, tools: native.subtitleToolsAvailable, copy: native.clipboard.writeText }
  let subtitleController
  const events = []
  const commands = []
  const state = createStore({
    saved: {
      prefs: { downloadPath: directory },
      torrents: [{ torrentKey: 1, infoHash: 'resume-test', status: 'paused', path: directory, files: [{ path: 'not-downloaded.mp4' }] }],
      torrentsToResume: []
    }
  }).state
  const torrent = state.saved.torrents[0]
  const controller = new TorrentListController(state)
  const settle = () => new Promise(resolve => setTimeout(resolve, 0))
  try {
    ipcRenderer.send = (...args) => commands.push(args)
    native.statPath = filepath => fs.promises.stat(filepath)
    dispatcher.setDispatch((...args) => events.push(args))
    state.nextTorrentKey = 2
    for (const empty of ['', ' \n ', null]) assert.strictEqual(controller.addTorrent(empty), false)
    assert.strictEqual(commands.length, 0, 'empty addresses never reach the torrent service')
    assert.strictEqual(state.nextTorrentKey, 2, 'empty addresses do not allocate torrent keys')

    // Default torrents already have metadata but may never have written a file.
    controller.toggleTorrent(torrent.infoHash)
    await settle()
    assert.strictEqual(commands.at(-1)?.[0], 'wt-start-torrenting')
    assert(!torrent.error, 'resuming an unwritten download does not mark its path missing')
    controller.toggleTorrent(torrent.infoHash)
    controller.resumeAllTorrents()
    await settle()
    assert.strictEqual(commands.at(-1)[0], 'wt-start-torrenting', 'Resume All restarts an unwritten download')
    controller.prioritizeTorrent('another-torrent')
    controller.resumePausedTorrents()
    await settle()
    assert(!torrent.error, 'playback priority can pause and resume an unwritten download')
    torrent.status = 'new'
    await controller.startTorrentingSummary(1)
    assert(!torrent.error, 'startup can resume metadata without data files')
    assert.deepStrictEqual(events, [])

    // Keep the moved/deleted data safeguard for completed downloads.
    torrent.fileModtimes = [Date.now()]
    const starts = commands.length
    await controller.startTorrentingSummary(1)
    assert.strictEqual(torrent.error, 'path-missing')
    assert.strictEqual(commands.length, starts, 'missing completed data is not redownloaded silently')
    fs.writeFileSync(path.join(directory, torrent.files[0].path), 'restored data')
    await controller.startTorrentingSummary(1)
    assert(!torrent.error, 'restoring the data clears the old path error')

    // An outstanding filesystem check must respect later UI actions.
    let finishStat
    native.statPath = () => new Promise(resolve => { finishStat = resolve })
    const pending = controller.startTorrentingSummary(1)
    controller.pauseTorrent(torrent, false)
    const pausedCommands = commands.length
    finishStat({})
    await pending
    assert.strictEqual(commands.length, pausedCommands, 'a late stat cannot undo Pause')
    torrent.status = 'new'
    const removed = controller.startTorrentingSummary(1)
    state.saved.torrents = []
    finishStat({})
    await removed
    assert.strictEqual(commands.length, pausedCommands, 'a late stat cannot restart a removed torrent')

    const external = path.join(directory, 'external.srt')
    fs.writeFileSync(external, '1\n00:00:00,000 --> 00:00:06,000\nExternal subtitles still work\n')
    const converted = await readSubtitle(external)
    const vtt = Buffer.from(converted.buffer.split(',')[1], 'base64').toString()
    assert(vtt.startsWith('WEBVTT') && vtt.includes('00:00:00.000 --> 00:00:06.000'), 'legacy SRT streams convert successfully')
    const webvtt = path.join(directory, 'external.vtt')
    fs.writeFileSync(webvtt, vtt)
    assert.strictEqual((await readSubtitle(webvtt)).buffer, converted.buffer, 'WebVTT is preserved without a duplicate header')
    await assert.rejects(readSubtitle(path.join(directory, 'missing.srt')), { code: 'ENOENT' }, 'subtitle read errors reach the caller')

    // Simulate either optional tool being absent, regardless of the host PATH.
    const subtitles = { tracks: [], selectedIndex: -1 }
    const playback = {
      saved: { prefs: {} },
      playing: { type: 'video', location: 'local', fileIndex: 0, subtitles, isPaused: false },
      getPlayingTorrentSummary: () => ({ path: directory, status: 'seeding' }),
      getPlayingFileSummary: () => torrent.files[0]
    }
    subtitleController = new SubtitlesController(playback)
    native.extractEmbeddedSubtitles = extractEmbeddedSubtitles
    events.length = 0
    for (const missing of ['ffmpeg', 'ffprobe', 'both']) {
      fs.accessSync = candidate => {
        const tool = path.basename(candidate).replace(/\.exe$/, '')
        if (missing === 'both' || tool === missing) throw new Error('Tool unavailable')
      }
      playback.playing.subtitles = { tracks: [], selectedIndex: -1 }
      subtitleController.checkForEmbeddedSubtitles()
      await settle()
      assert(playback.playing.subtitles.checkedEmbedded, 'discovery finishes without ' + missing)
      assert(!playback.playing.subtitles.loadingEmbedded)
      assert.deepStrictEqual(playback.playing.subtitles.tracks, [])
      subtitleController.checkForEmbeddedSubtitles()
    }
    assert.deepStrictEqual(events, [], 'missing optional subtitle tools do not open an error window')
    assert.strictEqual(playback.playing.type, 'video')
    fs.accessSync = originals.access
    let toolsAvailable = false
    native.subtitleToolsAvailable = async () => toolsAvailable
    await subtitleController.findEmbeddedSubtitles()
    assert(playback.playing.subtitles.showInstallNotice, 'only an explicit search shows the optional installation notice')
    assert.strictEqual(playback.playing.isPaused, false, 'the installation notice keeps video playing')
    subtitleController.dismissInstallNotice()
    assert(playback.saved.prefs.ffmpegNoticeDismissed)
    playback.playing.subtitles = { tracks: [], selectedIndex: -1 }
    await subtitleController.findEmbeddedSubtitles()
    assert.strictEqual(playback.playing.subtitles.showInstallNotice, false, 'the full notice stays dismissed for another video')
    const copied = []
    native.clipboard.writeText = text => copied.push(text)
    subtitleController.showInstallSteps()
    subtitleController.copyInstallCommand()
    assert.deepStrictEqual(copied, ['brew install ffmpeg'])
    native.extractEmbeddedSubtitles = async filePath => [{ embedded: true, filePath, streamIndex: 1, language: 'English', label: 'English' }]
    toolsAvailable = true
    const deadline = Date.now() + 5000
    while (!playback.playing.subtitles.tracks.length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25))
    assert.strictEqual(playback.playing.subtitles.tracks.length, 1, 'installation is detected and discovery retries automatically')
    assert.strictEqual(playback.playing.subtitles.showInstallSteps, false)
    assert.strictEqual(playback.playing.isPaused, false)
    let finishTools
    native.subtitleToolsAvailable = () => new Promise(resolve => { finishTools = resolve })
    playback.playing.subtitles = { tracks: [], selectedIndex: -1 }
    const stale = subtitleController.findEmbeddedSubtitles()
    playback.playing.subtitles = { tracks: [], selectedIndex: -1 }
    finishTools(false)
    await stale
    assert(!playback.playing.subtitles.showInstallNotice, 'late availability checks cannot affect another video')
    return 'Playback regression tests passed: unwritten downloads, stale checks, SRT/VTT readers, optional tools, requested installation notice, remembered dismissal and automatic installation detection'
  } finally {
    ipcRenderer.send = originals.send
    native.statPath = originals.statPath
    native.extractEmbeddedSubtitles = originals.extract
    fs.accessSync = originals.access
    native.subtitleToolsAvailable = originals.tools
    native.clipboard.writeText = originals.copy
    clearTimeout(subtitleController?.toolsTimer)
  }
}

async function runAudioRegressions (projectRoot) {
  const assert = require('assert')
  const native = require(projectRoot + '/build/renderer/lib/native-api')
  const MediaController = require(projectRoot + '/build/renderer/controllers/media-controller')
  const originals = { probe: native.probeAudio, convert: native.convertAudio, cancel: native.cancelAudioConversions }
  const torrent = { path: '/downloads', status: 'downloading', progress: { files: [{ numPieces: 2, numPiecesPresent: 1 }] } }
  const state = {
    playing: { audioSupport: {}, location: 'local', fileIndex: 0, currentTime: 60, isPaused: true },
    getPlayingTorrentSummary: () => torrent,
    getPlayingFileSummary: () => ({ path: 'video.mkv' })
  }
  const controller = new MediaController(state)
  let probes = 0
  let conversions = 0
  let error
  controller.mediaError = message => { error = message }
  native.probeAudio = async () => { probes++; return [{ codec_name: 'ac3' }] }
  native.convertAudio = async () => { conversions++; return 'file:///cache/compatible.mkv' }
  try {
    await controller.checkAudioSupport(true)
    assert.strictEqual(probes, 0, 'preallocated incomplete downloads are never probed')
    torrent.progress.files[0].numPiecesPresent = 2
    await controller.checkAudioSupport()
    assert.strictEqual(state.playing.audioSupport.url, 'file:///cache/compatible.mkv')
    assert.strictEqual(state.playing.jumpToTime, 60, 'conversion preserves the playback position')
    assert(state.playing.isPaused, 'conversion preserves the user pause state')
    await controller.checkAudioSupport()
    assert.strictEqual(conversions, 1, 'repeated updates do not reconvert')
    state.playing.audioSupport = {}
    native.probeAudio = async () => []
    await controller.checkAudioSupport(true)
    assert.strictEqual(conversions, 1, 'silent video does not trigger conversion or fallback')
    assert(!error)
    state.playing.audioSupport = {}
    native.probeAudio = async () => null
    await controller.checkAudioSupport(true)
    assert(state.playing.audioSupport.message.includes('FFmpeg'), 'missing tools show actionable help')
    let finishProbe
    state.playing.audioSupport = {}
    native.probeAudio = () => new Promise(resolve => { finishProbe = resolve })
    const staleProbe = controller.checkAudioSupport(true)
    state.playing.audioSupport = {}
    finishProbe([{ codec_name: 'ac3' }])
    await staleProbe
    assert.strictEqual(conversions, 1, 'late probe cannot convert a different file')
    let finishConversion
    native.probeAudio = async () => [{ codec_name: 'ac3' }]
    native.convertAudio = () => new Promise(resolve => { finishConversion = resolve })
    const staleConversion = controller.checkAudioSupport(true)
    await new Promise(resolve => setTimeout(resolve, 0))
    assert(state.playing.audioSupport.converting)
    state.playing.audioSupport = {}
    finishConversion('file:///cache/stale.mkv')
    await staleConversion
    assert(!state.playing.audioSupport.url, 'late conversion cannot replace a different file')
    native.cancelAudioConversions = async () => {}
    const castingConversion = controller.checkAudioSupport(true)
    await new Promise(resolve => setTimeout(resolve, 0))
    state.playing.location = 'chromecast'
    await controller.checkAudioSupport()
    finishConversion('file:///cache/casting.mkv')
    await castingConversion
    assert(!state.playing.audioSupport.checked, 'casting does not prevent conversion when returning locally')
    state.playing.location = 'local'
    native.convertAudio = async () => { throw new Error('conversion failed') }
    await controller.checkAudioSupport(true)
    assert(error.includes('conversion failed'), 'conversion failure uses the external-player fallback')
    assert(!state.playing.audioSupport.converting)
    return 'Audio controller tests passed: completion gating, resume/pause state, silence, missing tools, stale probes/conversions and failure fallback'
  } finally {
    native.probeAudio = originals.probe
    native.convertAudio = originals.convert
    native.cancelAudioConversions = originals.cancel
  }
}

async function runUI (projectRoot) {
  const assert = require('assert')
  const React = require(projectRoot + '/node_modules/react')
  const { createRoot } = require(projectRoot + '/node_modules/react-dom/client')
  const { Button, Checkbox, TextField, ProgressBar } = require(projectRoot + '/build/renderer/components/ui')
  const App = require(projectRoot + '/build/renderer/pages/app')
  const dispatcher = require(projectRoot + '/build/renderer/lib/dispatcher')
  const { clipboard } = require(projectRoot + '/build/renderer/lib/native-api')
  const root = createRoot(document.querySelector('#body'))
  const h = React.createElement
  const act = React.act
  window.IS_REACT_ACT_ENVIRONMENT = true
  const events = []
  dispatcher.setDispatch((...args) => events.push(args))

  async function render (element) {
    await act(async () => root.render(element))
  }

  async function click (element) {
    assert(element, 'click target exists')
    await act(async () => element.click())
  }

  async function type (element, value) {
    // Bypass React's value tracker to simulate a user editing the native input.
    const prototype = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    await act(async () => {
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value)
      element.dispatchEvent(new window.Event('input', { bubbles: true }))
    })
  }

  function button (label) {
    const scope = document.querySelector('[role=dialog]') || document
    return [...scope.querySelectorAll('button')].find(el => el.textContent === label)
  }

  let input
  await render(h('div', { className: 'app', onClick: () => events.push(['parent']) },
    h(Button, { label: 'Disabled', disabled: true, onClick: () => events.push(['disabled']) }),
    h(Checkbox, { label: 'Download', defaultChecked: false, onClick: e => e.stopPropagation(), onChange: e => events.push(['checked', e.target.checked]) }),
    h(TextField, { ref: el => { input = el }, 'aria-label': 'Address' }),
    h(ProgressBar, { value: 150, 'aria-label': 'Progress' })
  ))
  assert(input instanceof window.HTMLInputElement, 'field ref exposes the native input')
  await click(button('Disabled'))
  assert.deepStrictEqual(events, [], 'disabled button does not dispatch')
  await click(document.querySelector('.ui-checkbox'))
  assert.deepStrictEqual(events, [['checked', true]], 'checkbox label toggles once without selecting its parent')
  assert.strictEqual(document.querySelector('progress').value, 100, 'progress is clamped')
  input.focus()
  assert.strictEqual(document.activeElement, input, 'field can be focused')

  const store = require(projectRoot + '/build/renderer/lib/store').createStore({
    playing: require(projectRoot + '/build/renderer/lib/state').getDefaultPlayState(),
    location: { url: () => 'preferences', hasBack: () => false, hasForward: () => false },
    window: { title: 'WebTorrent', isFocused: true },
    errors: [],
    saved: { torrents: [], prefs: { downloadPath: '/tmp/downloads', torrentsFolderPath: '/tmp/torrents', soundNotifications: false } },
    getGlobalTrackers: () => ['https://tracker.example/announce'],
    getExternalPlayerName: () => 'VLC',
    shouldHidePlayerControls: () => false
  })
  const state = store.state
  events.length = 0
  await render(h(App, { store }))
  const sounds = [...document.querySelectorAll('.ui-checkbox')].find(el => el.textContent === 'Enable sounds')
  await click(sounds)
  assert.deepStrictEqual(events.pop(), ['updatePreferences', 'soundNotifications', true])
  const trackers = document.querySelector('[aria-label="Global trackers"]')
  await type(trackers, ' https://one.example/announce\n\nhttps://two.example/announce ')
  assert.deepStrictEqual(events.slice(-2), [
    ['updatePreferences', 'globalTrackers', ['https://one.example/announce', 'https://two.example/announce']],
    ['updateGlobalTrackers', ['https://one.example/announce', 'https://two.example/announce']]
  ])
  const downloadPath = document.querySelector('#download-location')
  assert(downloadPath.readOnly, 'path fields remain read-only')
  assert.strictEqual(document.querySelector('label[for="download-location"]').control, downloadPath)
  state.window.title = 'Updated title'
  state.saved.prefs.soundNotifications = true
  await render(h(App, { store }))
  assert(sounds.querySelector('input').checked, 'store subscriptions update preferences')

  state.location.url = () => 'create-torrent'
  state.location.current = () => ({ files: [{ name: 'seed.bin', path: '/tmp/seed.bin', size: 128 }] })
  await render(h(App, { store }))
  await click(button('Show advanced settings...'))
  await click(document.querySelector('.torrent-is-private input'))
  await type(document.querySelector('[aria-label="Trackers"]'), 'https://tracker.example/announce')
  await type(document.querySelector('[aria-label="Comment"]'), ' Test torrent ')
  await click(button('Create Torrent'))
  const created = events.findLast(event => event[0] === 'createTorrent')
  assert(created, 'create torrent dispatches')
  assert.strictEqual(created[1].private, true)
  assert.strictEqual(created[1].comment, 'Test torrent')
  assert.deepStrictEqual(created[1].announce, ['https://tracker.example/announce'])

  state.location.url = () => 'home'
  state.saved.torrents = [{ torrentKey: 1, infoHash: 'abc', name: 'Example download', status: 'downloading', files: [], progress: { progress: 0.5, downloaded: 128, length: 256, numPeers: 0, downloadSpeed: 0, uploadSpeed: 0, ready: true } }]
  await render(h(App, { store }))
  events.length = 0
  await click(document.querySelector('.download'))
  assert.deepStrictEqual(events, [['toggleTorrent', 'abc']], 'download control does not select the torrent row')
  assert.strictEqual(document.querySelector('progress').value, 50)

  const downloads = state.saved.torrents[0]
  state.saved.torrents.push({ torrentKey: 2, infoHash: 'paused', name: 'Paused film', status: 'paused', files: [{ name: 'film.mp4', path: 'film.mp4', length: 256 }], selections: [true], progress: { progress: 0.25, downloaded: 64, length: 256 } })
  state.saved.torrents.push({ torrentKey: 3, infoHash: 'seed', name: 'Finished film', status: 'seeding', files: [{ name: 'finished.mp4', path: 'finished.mp4', length: 256 }], progress: { progress: 1, downloaded: 256, length: 256, uploadSpeed: 128, numPeers: 2 } })
  await render(h(App, { store }))
  assert.strictEqual(document.querySelectorAll('.torrent').length, 3)
  await click(button('Paused'))
  assert.strictEqual(document.querySelectorAll('.torrent').length, 1, 'status filter isolates paused torrents')
  assert.strictEqual(document.querySelector('.torrent progress').value, 25, 'paused downloads retain progress')
  await type(document.querySelector('[aria-label="Search library"]'), 'nothing here')
  assert(document.querySelector('.shelf-empty').textContent.includes('No matching torrents'))
  await click(button('Clear filters'))
  assert.strictEqual(document.querySelectorAll('.torrent').length, 3, 'clear filters restores the shelf')
  await type(document.querySelector('[aria-label="Search library"]'), ' FINISHED ')
  assert.strictEqual(document.querySelectorAll('.torrent').length, 1, 'search ignores case and surrounding spaces')
  await type(document.querySelector('[aria-label="Search library"]'), '')
  events.length = 0
  await click(document.querySelector('[aria-label="Show files for Paused film"]'))
  assert.deepStrictEqual(events.pop(), ['toggleSelectTorrent', 'paused'])
  state.selectedInfoHash = 'paused'
  await render(h(App, { store }))
  events.length = 0
  await click(document.querySelector('.torrent.selected .play'))
  assert.deepStrictEqual(events, [['playFile', 'paused']], 'streaming does not toggle selection')
  await click(document.querySelector('.torrent.selected .torrent-more'))
  assert.deepStrictEqual(events.pop(), ['openTorrentContextMenu', 'paused'])
  await click(document.querySelector('[aria-label="Download film.mp4"]'))
  assert.deepStrictEqual(events.pop(), ['toggleTorrentFile', 'paused', 0], 'file checkbox toggles only its file')
  const paused = state.saved.torrents[1]
  paused.files = [
    { name: 'padding', path: '/.____padding_file/0', length: 1 },
    { name: 'Z.mp4', path: 'Z.mp4', length: 128 },
    { name: 'A.mp4', path: 'A.mp4', length: 128 }
  ]
  paused.selections = [false, true, true]
  state.saved.prefs.sortByName = true
  await render(h(App, { store }))
  assert.strictEqual(document.querySelectorAll('.torrent-details tr').length, 2, 'padding files remain hidden')
  await click(document.querySelector('[aria-label="Download A.mp4"]'))
  assert.deepStrictEqual(events.pop(), ['toggleTorrentFile', 'paused', 2], 'sorting and hidden padding preserve original file indices')
  await click(document.querySelector('.torrent.selected .file-open'))
  assert.deepStrictEqual(events.pop(), ['playFile', 'paused', 2], 'keyboard-accessible file actions use the original file index')
  await click(button('Paused'))
  await act(async () => { paused.status = 'downloading' })
  assert.strictEqual(document.querySelectorAll('.torrent').length, 0, 'live status updates remove torrents from the current filter')
  await click(button('Clear filters'))
  state.downloadPathStatus = 'missing'
  await render(h(App, { store }))
  await click(button('Choose download folder'))
  assert.deepStrictEqual(events.pop(), ['preferences'], 'missing folder exposes recovery')
  state.downloadPathStatus = undefined
  state.selectedInfoHash = null
  state.saved.torrents = []
  await render(h(App, { store }))
  assert(document.querySelector('.shelf-empty').textContent.includes('Your shelf is ready'))
  await click(button('Add your first torrent'))
  assert.deepStrictEqual(events.pop(), ['openTorrentAddress'])
  state.saved.torrents = [downloads]
  await render(h(App, { store }))
  state.saved.torrents.push({ torrentKey: 4, name: 'Fetching metadata', status: 'new' })
  await render(h(App, { store }))
  await click(button('Downloading'))
  assert.strictEqual(document.querySelectorAll('.torrent').length, 2, 'metadata fetches appear in the downloading filter')
  const pending = [...document.querySelectorAll('.torrent')].find(el => el.textContent.includes('Fetching metadata'))
  assert(!pending.querySelector('progress').hasAttribute('value'), 'metadata loading uses indeterminate progress')
  assert(pending.querySelector('.download').disabled, 'metadata cannot dispatch torrent commands before an infohash arrives')
  await click(button('All'))
  await act(async () => { downloads.error = new Error('Disk is full') })
  assert(document.querySelector('.torrent-transfer').textContent.includes('Disk is full'), 'torrent errors show their recovery context')
  await act(async () => { delete downloads.error; state.saved.torrents = [downloads] })

  const readClipboard = clipboard.readTextAsync
  const magnet = 'magnet:?xt=urn:btih:0123456789012345678901234567890123456789'
  dispatcher.setDispatch((...args) => {
    events.push(args)
    if (args[0] === 'exitModal') {
      state.modal = null
    } else if (args[0] === 'dismissErrors') {
      state.errors = []
    }
  })
  try {
    clipboard.readTextAsync = async () => ''
    state.modal = { id: 'open-torrent-address-modal' }
    await render(h(App, { store }))
    events.length = 0
    await click(button('Choose torrent files…'))
    assert.deepStrictEqual(events, [['exitModal'], ['openTorrentFile']], 'file picker closes the address modal before opening the native dialog')
    const { getTorrentAddressError } = require(projectRoot + '/build/shared/torrent-address')
    for (const valid of [magnet, ' https://example.com/download?id=1 ', '0123456789012345678901234567890123456789', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', 'instant.io/#0123456789012345678901234567890123456789']) assert.strictEqual(getTorrentAddressError(valid), '')
    for (const invalid of ['', ' \n ', 'not a torrent', 'https://', 'magnet:?dn=video', 'javascript:alert(1)']) assert(getTorrentAddressError(invalid))
    clipboard.readTextAsync = async () => magnet
    state.modal = { id: 'open-torrent-address-modal' }
    await render(h(App, { store }))
    const address = document.querySelector('#torrent-address-field')
    assert.strictEqual(document.activeElement, address, 'address modal focuses its input')
    assert.strictEqual(address.value, magnet, 'magnet link is pasted from the clipboard')
    assert.strictEqual(address.selectionEnd, magnet.length, 'magnet link is selected')
    events.length = 0
    await act(async () => address.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    assert.deepStrictEqual(events, [['exitModal'], ['addTorrent', magnet]], 'Enter submits the magnet link')
    assert.strictEqual(document.querySelector('[role="dialog"]'), null, 'Enter closes the modal')
    clipboard.readTextAsync = async () => ''
    for (let i = 0; i < 5; i++) {
      await act(async () => { state.modal = { id: 'open-torrent-address-modal' } })
      const field = document.querySelector('#torrent-address-field')
      assert(field, 'the modal reopens on every attempt without a forced root render')
      assert.strictEqual(document.activeElement, field)
      assert(button('Add torrent').disabled, 'OK is disabled for empty input')
      events.length = 0
      await act(async () => field.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
      assert.deepStrictEqual(events, [], 'empty Enter does not add a torrent or close the dialog')
      assert(document.querySelector('#torrent-address-error'))
      await type(field, '   ')
      assert(button('Add torrent').disabled, 'whitespace cannot be submitted')
      await type(field, 'not a torrent')
      await click(button('Add torrent'))
      assert.deepStrictEqual(events, [], 'invalid input stays in the form')
      assert.strictEqual(field.value, 'not a torrent', 'validation preserves the editable input')
      await click(button('Cancel'))
      assert.deepStrictEqual(events.pop(), ['exitModal'], 'cancel closes the modal')
      assert.strictEqual(document.querySelector('[role="dialog"]'), null)
    }
    let finishClipboard
    clipboard.readTextAsync = () => new Promise(resolve => { finishClipboard = resolve })
    await act(async () => { state.modal = { id: 'open-torrent-address-modal' } })
    const field = document.querySelector('#torrent-address-field')
    assert(field, 'a slow clipboard does not delay opening the modal')
    await type(field, 'my draft')
    await act(async () => finishClipboard(magnet))
    assert.strictEqual(field.value, 'my draft', 'a late clipboard result does not overwrite typing')
    await click(button('Cancel'))
    await act(async () => { state.modal = { id: 'open-torrent-address-modal' } })
    await click(button('Cancel'))
    await act(async () => finishClipboard(magnet))
    assert.strictEqual(document.querySelector('[role="dialog"]'), null, 'late clipboard results do not reopen a closed dialog')
    await act(async () => { state.errors = [{ time: Date.now(), message: 'A recoverable error' }] })
    await click(document.querySelector('[aria-label="Dismiss errors"]'))
    assert(!document.querySelector('.error-popover.visible'), 'errors can be dismissed immediately')
    await act(async () => { state.errors = [{ time: Date.now() - 4500, message: 'An expiring error' }] })
    assert(document.querySelector('.error-popover.visible'))
    await act(async () => new Promise(resolve => setTimeout(resolve, 600)))
    assert(!document.querySelector('.error-popover.visible'), 'errors also expire without another interaction')
  } finally {
    clipboard.readTextAsync = readClipboard
  }

  state.modal = null
  state.location.url = () => 'player'
  const torrent = state.saved.torrents[0]
  torrent.files = [{ name: 'example.mp4', path: 'example.mp4' }]
  torrent.progress.files = []
  state.getPlayingTorrentSummary = () => torrent
  state.getPlayingFileSummary = () => torrent.files[0]
  state.devices = {}
  state.playing = require(projectRoot + '/build/renderer/lib/state').getDefaultPlayState()
  Object.assign(state.playing, { type: 'video', infoHash: torrent.infoHash, fileIndex: 0, fileName: 'example.mp4' })
  state.playing.subtitles.tracks = [{ label: 'English' }, { label: 'English (Forced)' }]
  state.playing.subtitles.selectedIndex = 0
  await render(h(App, { store }))
  assert.strictEqual(document.querySelector('.subtitle-track-label').textContent, 'English', 'selected subtitle appears next to CC')
  state.playing.subtitles.selectedIndex = 1
  await render(h(App, { store }))
  const captions = document.querySelector('.subtitle-control')
  assert.strictEqual(captions.querySelector('.subtitle-track-label').textContent, 'English (Forced)')
  assert.strictEqual(captions.title, 'Subtitles: English (Forced)', 'hover exposes the complete label')
  events.length = 0
  await click(captions)
  assert.deepStrictEqual(events.pop(), ['toggleSubtitlesMenu'], 'the caption label opens the subtitle menu')
  state.playing.subtitles.selectedIndex = -1
  await render(h(App, { store }))
  assert.strictEqual(document.querySelector('.subtitle-track-label'), null, 'Off clears the subtitle label')
  state.playing.subtitles.tracks = []
  await render(h(App, { store }))
  assert.strictEqual(document.querySelector('.subtitle-control').getAttribute('aria-label'), 'Closed captions')
  events.length = 0
  await click(document.querySelector('.subtitle-control'))
  assert.deepStrictEqual(events.pop(), ['toggleSubtitlesMenu'], 'CC opens the menu even without subtitle tracks')
  state.playing.subtitles.showMenu = true
  await render(h(App, { store }))
  assert(!document.querySelector('.subtitle-install-help'), 'opening CC does not prompt for optional tools')
  await click(button('Find embedded subtitles'))
  assert.deepStrictEqual(events.pop(), ['findEmbeddedSubtitles'])
  state.playing.subtitles.showInstallNotice = true
  await render(h(App, { store }))
  assert(document.querySelector('.subtitle-install-help').textContent.includes('You can keep watching without it.'))
  assert(button('Load subtitle file…'), 'external subtitles remain accessible alongside installation help')
  await click(button('Not now'))
  assert.deepStrictEqual(events.pop(), ['dismissSubtitleInstallNotice'])
  state.playing.subtitles.showInstallNotice = false
  state.playing.subtitles.showInstallSteps = true
  await render(h(App, { store }))
  if (process.platform === 'darwin') {
    assert.strictEqual(document.querySelector('.subtitle-install-help code').textContent, 'brew install ffmpeg')
    await click(button('Copy command'))
    assert.deepStrictEqual(events.pop(), ['copySubtitleInstallCommand'])
  }
  await click(button('Check again'))
  assert.deepStrictEqual(events.pop(), ['checkSubtitleTools'])
  state.location.url = () => 'preferences'
  await render(h(App, { store }))
  return 'UI tests passed: media shelf filters/search, live status updates, original file indices, stream/pause controls, file picker, empty/missing-folder states, native controls, preferences, torrent creation, modals and subtitle controls'
}
