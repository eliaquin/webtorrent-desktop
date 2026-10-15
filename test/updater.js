const assert = require('assert')
const { availableUpdate, createUpdater, CHECK_INTERVAL } = require('../src/main/updater')
const UpdateController = require('../src/renderer/controllers/update-controller')
const { setDispatch } = require('../src/renderer/lib/dispatcher')

const base = 'https://github.com/eliaquin/webtorrent-desktop/releases'
const asset = name => ({ name, state: 'uploaded', size: 123, browser_download_url: `${base}/download/v0.27.3/${name}` })
const release = { tag_name: 'v0.27.3', assets: [asset('WebTorrent-v0.27.3-darwin-arm64.dmg'), asset('WebTorrent-v0.27.3-darwin-x64.dmg')] }
const update = { status: 'available', ...availableUpdate(release, '0.27.2', 'darwin', 'arm64') }
async function main () {
  for (const [platform, arch, suffix] of [
    ['darwin', 'arm64', '-v0.27.3-darwin-arm64.dmg'],
    ['darwin', 'x64', '-v0.27.3-darwin-x64.zip'],
    ['win32', 'x64', 'Setup-v0.27.3.exe'],
    ['linux', 'x64', '-v0.27.3-linux-x64.zip']
  ]) {
    const renamed = asset('TorrentCat' + suffix)
    const legacy = asset('WebTorrent' + suffix)
    for (const assets of [[renamed], [legacy, renamed]]) {
      assert.strictEqual(availableUpdate({ ...release, assets }, '0.27.2', platform, arch).downloadURL, renamed.browser_download_url)
    }
    assert(availableUpdate({ ...release, assets: [legacy] }, '0.27.2', platform, arch))
    assert.strictEqual(availableUpdate({ ...release, assets: [{ ...renamed, browser_download_url: 'https://evil.example/app' }] }, '0.27.2', platform, arch), null)
  }
  assert.strictEqual(availableUpdate({ ...release, assets: [asset('TorrentCat-v0.27.3-linux-x64.deb')] }, '0.27.2', 'linux', 'x64').directDownload, false)
  assert(update.downloadURL.endsWith('-arm64.dmg'))
  assert(availableUpdate(release, '0.27.2', 'darwin', 'x64').downloadURL.endsWith('-x64.dmg'))
  for (const version of ['0.27.3', '0.28.0']) assert.strictEqual(availableUpdate(release, version, 'darwin', 'arm64'), null)
  for (const change of [{ draft: true }, { prerelease: true }, { tag_name: 'v0.28.0-beta.1' }, { tag_name: 'invalid' }, { assets: [] }]) {
    assert.strictEqual(availableUpdate({ ...release, ...change }, '0.27.2', 'darwin', 'arm64'), null)
  }
  assert.strictEqual(availableUpdate(release, '0.27.2', 'win32', 'x64'), null)
  assert.strictEqual(availableUpdate({ ...release, assets: [{ ...release.assets[0], browser_download_url: 'https://evil.example/app.dmg' }] }, '0.27.2', 'darwin', 'arm64'), null)
  assert.strictEqual(availableUpdate({ ...release, assets: [{ ...release.assets[0], state: 'new' }] }, '0.27.2', 'darwin', 'arm64'), null)
  assert(availableUpdate({ ...release, assets: [asset('WebTorrentSetup-v0.27.3.exe')] }, '0.27.2', 'win32', 'x64'))
  const linux = availableUpdate({ ...release, assets: [asset('WebTorrent-v0.27.3-linux-x64.deb')] }, '0.27.2', 'linux', 'x64')
  assert.strictEqual(linux.directDownload, false)
  assert.strictEqual(linux.downloadURL, base + '/tag/v0.27.3')

  let resolveRequest
  let calls = 0
  let callback
  let canceled = false
  const notifications = []
  const updater = createUpdater({
    currentVersion: '0.27.2',
    platform: 'darwin',
    arch: 'arm64',
    fetch: () => { calls++; return new Promise(resolve => { resolveRequest = resolve }) },
    notify: result => notifications.push(result),
    setInterval: (action, delay) => { assert.strictEqual(delay, CHECK_INTERVAL); callback = action; return 1 },
    clearInterval: () => { canceled = true }
  })
  const first = updater.check()
  assert.strictEqual(updater.check(), first, 'concurrent checks share the same request')
  resolveRequest({ ok: true, json: async () => release })
  assert.deepStrictEqual(await first, update)
  updater.start()
  updater.start()
  assert.strictEqual(calls, 2)
  resolveRequest({ status: 404 })
  await updater.check()
  assert.strictEqual(notifications.length, 0)
  const next = callback()
  resolveRequest({ ok: true, json: async () => release })
  await next
  assert.strictEqual(notifications.length, 1)
  updater.stop()
  assert(canceled)
  for (const fetch of [async () => ({ status: 403 }), async () => { throw new Error('offline') }, async () => ({ ok: true, json: async () => { throw new Error('invalid JSON') } })]) {
    assert.deepStrictEqual(await createUpdater({ currentVersion: '0.27.2', fetch }).check(), { status: 'error' })
  }

  const events = []
  setDispatch((...args) => events.push(args))
  const state = { saved: {}, modal: null, location: { url: () => 'player' } }
  let opened
  const controller = new UpdateController(state, { check: async () => update, open: async url => { opened = url } })
  controller.updateAvailable(update)
  assert.strictEqual(state.modal, null, 'automatic checks do not interrupt playback')
  state.location.url = () => 'home'
  state.modal = { id: 'other-dialog' }
  controller.maybeShow()
  assert.strictEqual(state.modal.id, 'other-dialog')
  state.modal = null
  controller.maybeShow()
  assert.strictEqual(state.modal.version, '0.27.3')
  controller.dismiss()
  controller.updateAvailable(update)
  assert.strictEqual(state.modal, null, 'Not now suppresses repeat prompts in this session')
  await controller.checkForUpdates()
  assert.strictEqual(state.modal.status, 'available', 'manual checks can show a deferred release')
  controller.skipVersion(update.version)
  assert.deepStrictEqual(state.saved.skippedVersions, ['0.27.3'])
  assert(events.some(([action]) => action === 'stateSave'))
  new UpdateController(state).updateAvailable(update)
  assert.strictEqual(state.modal, null, 'skip persists across controller sessions')
  await controller.checkForUpdates()
  await controller.download()
  assert.strictEqual(opened, update.downloadURL)
  assert.strictEqual(state.modal, null)
  controller.open = async () => { throw new Error('browser unavailable') }
  await controller.checkForUpdates()
  await controller.download()
  assert(state.modal.downloadError)
  assert(!state.modal.opening)
  controller.dismiss()
  controller.check = () => new Promise(resolve => { resolveRequest = resolve })
  const pending = controller.checkForUpdates()
  assert.strictEqual(state.modal.status, 'checking')
  controller.dismiss()
  resolveRequest(update)
  await pending
  assert.strictEqual(state.modal, null, 'closing a manual check does not reopen it on completion')
  controller.check = async () => { throw new Error('IPC failure') }
  await controller.checkForUpdates()
  assert.strictEqual(state.modal.status, 'error')
  console.log('Update checks passed: versions, platform assets, URL validation, retries, scheduling, suppression, manual checks and downloads')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
