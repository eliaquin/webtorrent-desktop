/* globals document, window */
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { _electron } = require('playwright')
const ip = require('../vendor/ip-compat')
const http = require('http')
const secureMediaServer = require('../src/renderer/lib/secure-media-server')

async function main () {
  for (const address of ['127.0.0.1', '127.1', '0x7f000001', '0177.0.0.1', '::1', '::ffff:127.0.0.1', '10.0.0.1', '192.168.1.1', '169.254.169.254', 'invalid']) {
    assert.strictEqual(ip.isPublic(address), false, address + ' must not be public')
  }
  assert.strictEqual(ip.isPublic('8.8.8.8'), true)
  assert.strictEqual(ip.isPublic('2606:4700:4700::1111'), true)
  assert.strictEqual(ip.toLong('192.168.1.1'), 3232235777)
  assert.strictEqual(ip.toString(Buffer.from([127, 0, 0, 1])), '127.0.0.1')
  assert.strictEqual(ip.cidrSubnet('192.168.1.7/24').broadcastAddress, '192.168.1.255')
  const IPSet = require('ip-set')
  const set = new IPSet()
  set.add('192.168.1.0/24')
  assert(set.contains('192.168.1.5'))
  assert(!set.contains('192.168.2.5'))
  const plist = require('plist')
  assert.deepStrictEqual(plist.parse(plist.build({ title: 'test', enabled: true })), { title: 'test', enabled: true })
  const xml = require('xml2js')
  assert.strictEqual((await xml.parseStringPromise('<root><name>test</name></root>')).root.name[0], 'test')
  const proto = require('castv2/lib/proto')
  await new Promise(resolve => setTimeout(resolve, 100))
  const message = { protocolVersion: 0, sourceId: 'sender', destinationId: 'receiver', namespace: 'urn:test', payloadType: 0, payloadUtf8: 'hello' }
  assert.strictEqual(proto.CastMessage.parse(proto.CastMessage.serialize(message)).payloadUtf8, 'hello')
  const mm = await import('music-metadata')
  assert((await mm.parseFile(path.join(__dirname, 'resources/monitor-test.mp4'))).format.duration > 0)

  const server = http.createServer((req, res) => res.end(req.url))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const prefix = secureMediaServer(server, '127.0.0.1')
    const url = 'http://127.0.0.1:' + server.address().port
    assert.strictEqual((await fetch(url + '/0')).status, 403, 'a missing media token must be rejected')
    assert.strictEqual((await fetch(url + prefix + '/0', { headers: { Origin: 'https://evil.example' } })).status, 403)
    const forgedHost = await new Promise((resolve, reject) => {
      http.get(url + prefix + '/0', { headers: { Host: 'evil.example:' + server.address().port } }, res => {
        res.resume()
        resolve(res.statusCode)
      }).on('error', reject)
    })
    assert.strictEqual(forgedHost, 403, 'DNS rebinding must be rejected')
    assert.strictEqual(await (await fetch(url + prefix + '/0', { headers: { Origin: 'null' } })).text(), '/0')
    assert.strictEqual((await fetch(url + prefix + '/0', { headers: { Origin: 'https://www.gstatic.com' } })).status, 200, 'the default Cast receiver can fetch authorized media')
  } finally {
    await new Promise(resolve => server.close(resolve))
  }

  const WebTorrent = require('webtorrent')
  const client = new WebTorrent({ dht: false, tracker: false, lsd: false, natUpnp: false, natPmp: false })
  let torrentServer
  try {
    const content = Buffer.from('Offline torrent streaming security regression')
    content.name = 'security.txt'
    const torrent = await new Promise((resolve, reject) => {
      client.once('error', reject)
      client.seed(content, resolve)
    })
    torrentServer = torrent.createServer()
    const listening = new Promise(resolve => torrentServer.listen(0, '127.0.0.1', resolve))
    const prefix = secureMediaServer(torrentServer, '127.0.0.1')
    await listening
    const url = 'http://127.0.0.1:' + torrentServer.address().port
    assert.strictEqual((await fetch(url + '/0')).status, 403)
    assert.strictEqual(await (await fetch(url + prefix + '/0')).text(), content.toString())
    const range = await fetch(url + prefix + '/0', { headers: { Range: 'bytes=0-6' } })
    assert.strictEqual(range.status, 206)
    assert.strictEqual(await range.text(), 'Offline')
  } finally {
    if (torrentServer) await new Promise(resolve => torrentServer.destroy(resolve))
    await new Promise(resolve => client.destroy(resolve))
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'webtorrent-security-'))
  let application
  try {
    fs.mkdirSync(path.join(directory, 'Downloads'))
    const prefs = { downloadPath: path.join(directory, 'Downloads'), isFileHandler: false, openExternalPlayer: false, externalPlayerPath: '', startup: false, soundNotifications: false, autoAddTorrents: false, torrentsFolderPath: '', highestPlaybackPriority: true, globalTrackers: [] }
    fs.writeFileSync(path.join(directory, 'config.json'), JSON.stringify({ version: '0.24.0', prefs, torrents: [], torrentsToResume: [] }))
    const packaged = process.env.WEBTORRENT_PACKAGED_APP
    application = await _electron.launch({ executablePath: packaged || require('electron'), args: packaged ? ['--hidden'] : [path.join(__dirname, '..'), '--hidden'], env: { ...process.env, NODE_ENV: 'test', WEBTORRENT_TEST_DIR: directory }, timeout: 30000 })
    let page = application.windows().find(page => page.url().endsWith('/main.html'))
    if (!page) page = await application.waitForEvent('window', { predicate: page => page.url().endsWith('/main.html') })
    await page.waitForSelector('.app')
    assert.deepStrictEqual(await page.evaluate(() => [typeof window.require, typeof window.process, typeof window.dispatch]), ['undefined', 'undefined', 'undefined'])
    await page.evaluate(() => window.open('https://example.com'))
    assert.strictEqual(application.windows().length, 2, 'popups must not create privileged windows')
    const policies = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(win => win.webContents.getLastWebPreferences()))
    assert(policies.every(policy => !policy.nodeIntegration && policy.contextIsolation))
    await application.evaluate(async ({ BrowserWindow }) => {
      const worker = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().endsWith('/webtorrent.html'))
      await worker.webContents.executeJavaScriptInIsolatedWorld(999, [{ code: 'client.destroy()' }])
    })
    await page.evaluate(() => { const script = document.createElement('script'); script.textContent = 'window.injected = true'; document.body.appendChild(script) })
    assert.strictEqual(await page.evaluate(() => window.injected), undefined, 'CSP must block injected scripts')
    const title = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(win => win.webContents.getURL().endsWith('/main.html')).getTitle())
    await application.evaluate(async ({ BrowserWindow }) => {
      const fake = new BrowserWindow({ show: false, title: 'WebTorrent Hidden Window', webPreferences: { nodeIntegration: true, contextIsolation: false } })
      await fake.loadURL('data:text/html,test')
      await fake.webContents.executeJavaScript('require("electron").ipcRenderer.send("setTitle", "INJECTED")')
      await new Promise(resolve => setTimeout(resolve, 100))
      fake.destroy()
    })
    assert.strictEqual(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(win => win.webContents.getURL().endsWith('/main.html')).getTitle()), title, 'a forged window cannot send privileged IPC')
    await application.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().endsWith('/main.html'))
      await win.webContents.executeJavaScriptInIsolatedWorld(999, [{ code: 'dispatch("preferences")' }])
    })
    await page.waitForSelector('[aria-label="Global trackers"]')
    await application.evaluate(electron => {
      const root = electron.app.getAppPath()
      const fromProject = process.getBuiltinModule('module').createRequire(root + '/package.json')
      fromProject(root + '/build/main/windows').about.init()
    })
    const about = application.windows().find(page => page.url().endsWith('/about.html')) || await application.waitForEvent('window', { predicate: page => page.url().endsWith('/about.html') })
    await about.waitForFunction(() => document.querySelector('#app-version').textContent === '0.24.0')
    assert.strictEqual(await about.evaluate(() => typeof window.require), 'undefined')
    const beforeNavigation = page.url()
    await page.evaluate(() => { window.location.href = 'https://example.com' })
    assert.strictEqual(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(win => win.webContents.getURL().endsWith('/main.html')).webContents.getURL()), beforeNavigation, 'remote navigation must be blocked')
    console.log('Security checks passed: IP bypasses, blocklists, casting parsers, metadata, media authorization, real torrent streaming and ranges, DNS rebinding, isolated app startup, CSP, denied popups/navigation, forged IPC, preferences')
  } finally {
    if (application) await application.close()
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

main().catch(err => { console.error(err); process.exitCode = 1 })
