/* globals document, window */

// Exercise the React UI in Electron's real DOM without a WebDriver dependency.
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

require('@electron/remote/main').initialize()
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
  require('@electron/remote/main').enable(win.webContents)
  await win.loadFile(fixture)
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

async function runUI (projectRoot) {
  const assert = require('assert')
  const React = require(projectRoot + '/node_modules/react')
  const { createRoot } = require(projectRoot + '/node_modules/react-dom/client')
  const { Button, Checkbox, TextField, ProgressBar } = require(projectRoot + '/build/renderer/components/ui')
  const App = require(projectRoot + '/build/renderer/pages/app')
  const dispatcher = require(projectRoot + '/build/renderer/lib/dispatcher')
  const { clipboard } = require(projectRoot + '/node_modules/@electron/remote')
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
    return [...document.querySelectorAll('button')].find(el => el.textContent === label)
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

  const state = {
    location: { url: () => 'preferences', hasBack: () => false, hasForward: () => false },
    window: { title: 'WebTorrent', isFocused: true },
    errors: [],
    saved: { torrents: [], prefs: { downloadPath: '/tmp/downloads', torrentsFolderPath: '/tmp/torrents', soundNotifications: false } },
    getGlobalTrackers: () => ['https://tracker.example/announce'],
    getExternalPlayerName: () => 'VLC',
    shouldHidePlayerControls: () => false
  }
  events.length = 0
  await render(h(App, { state }))
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
  await render(h(App, { state }))
  assert(sounds.querySelector('input').checked, 'mutable state updates render through createRoot')

  state.location.url = () => 'create-torrent'
  state.location.current = () => ({ files: [{ name: 'seed.bin', path: '/tmp/seed.bin', size: 128 }] })
  await render(h(App, { state }))
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
  await render(h(App, { state }))
  events.length = 0
  await click(document.querySelector('.download'))
  assert.deepStrictEqual(events, [['toggleTorrent', 'abc']], 'download control does not select the torrent row')
  assert.strictEqual(document.querySelector('progress').value, 50)

  const readClipboard = clipboard.readText
  const magnet = 'magnet:?xt=urn:btih:0123456789012345678901234567890123456789'
  dispatcher.setDispatch((...args) => {
    events.push(args)
    if (args[0] === 'exitModal') {
      state.modal = null
      root.render(h(App, { state }))
    }
  })
  try {
    clipboard.readText = () => magnet
    state.modal = { id: 'open-torrent-address-modal' }
    await render(h(App, { state }))
    const address = document.querySelector('#torrent-address-field')
    assert.strictEqual(document.activeElement, address, 'address modal focuses its input')
    assert.strictEqual(address.value, magnet, 'magnet link is pasted from the clipboard')
    assert.strictEqual(address.selectionEnd, magnet.length, 'magnet link is selected')
    events.length = 0
    await act(async () => address.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    assert.deepStrictEqual(events, [['exitModal'], ['addTorrent', magnet]], 'Enter submits the magnet link')
    assert.strictEqual(document.querySelector('[role="dialog"]'), null, 'Enter closes the modal')
    state.modal = { id: 'open-torrent-address-modal' }
    await render(h(App, { state }))
    await click(button('CANCEL'))
    assert.deepStrictEqual(events.pop(), ['exitModal'], 'cancel closes the modal')
    assert.strictEqual(document.querySelector('[role="dialog"]'), null)
  } finally {
    clipboard.readText = readClipboard
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
  await render(h(App, { state }))
  assert.strictEqual(document.querySelector('.subtitle-track-label').textContent, 'English', 'selected subtitle appears next to CC')
  state.playing.subtitles.selectedIndex = 1
  await render(h(App, { state }))
  const captions = document.querySelector('.subtitle-control')
  assert.strictEqual(captions.querySelector('.subtitle-track-label').textContent, 'English (Forced)')
  assert.strictEqual(captions.title, 'Subtitles: English (Forced)', 'hover exposes the complete label')
  events.length = 0
  await click(captions)
  assert.deepStrictEqual(events.pop(), ['toggleSubtitlesMenu'], 'the caption label opens the subtitle menu')
  state.playing.subtitles.selectedIndex = -1
  await render(h(App, { state }))
  assert.strictEqual(document.querySelector('.subtitle-track-label'), null, 'Off clears the subtitle label')
  state.playing.subtitles.tracks = []
  await render(h(App, { state }))
  assert.strictEqual(document.querySelector('.subtitle-control').getAttribute('aria-label'), 'Closed captions')
  state.location.url = () => 'preferences'
  await render(h(App, { state }))
  return 'UI tests passed: native controls, preferences, torrent creation, download toggling, modal focus/paste/Enter/cancel, React root updates, selected subtitle label'
}
