/* globals document, window */
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron } = require('playwright')

async function main () {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'webtorrent-integration-'))
  let application
  let page
  try {
    const downloads = path.join(directory, 'Downloads')
    const seeds = path.join(downloads, 'Fixture')
    fs.mkdirSync(seeds, { recursive: true })
    const subtitle = path.join(directory, 'English.srt')
    fs.writeFileSync(subtitle, '1\n00:00:00,000 --> 00:00:06,000\nLocal integration subtitle\n')
    const video = path.join(seeds, 'video with spaces.mkv')
    const text = path.join(seeds, 'notes.txt')
    fs.writeFileSync(text, 'Local torrent fixture')
    execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'color=color=blue:size=160x90:duration=6',
      '-i', subtitle, '-map', '0:v', '-map', '1:0', '-c:v', 'libvpx', '-threads', '1', '-c:s', 'ass',
      '-metadata:s:s:0', 'language=eng', '-disposition:s:0', 'default', video])
    const prefs = { downloadPath: downloads, isFileHandler: false, openExternalPlayer: false, externalPlayerPath: '', startup: false, soundNotifications: false, autoAddTorrents: false, torrentsFolderPath: '', highestPlaybackPriority: true, globalTrackers: [] }
    fs.writeFileSync(path.join(directory, 'config.json'), JSON.stringify({ version: '0.24.0', prefs, torrents: [], torrentsToResume: [] }))
    const packaged = process.env.WEBTORRENT_PACKAGED_APP
    application = await _electron.launch({ executablePath: packaged || require('electron'), args: packaged ? ['--hidden'] : [path.join(__dirname, '..'), '--hidden'], env: { ...process.env, NODE_ENV: 'test', WEBTORRENT_TEST_DIR: directory } })
    if (process.env.MODERN_DEBUG) application.process().stdout.on('data', chunk => { if (chunk.toString().includes('[torrent]')) process.stdout.write(chunk) })
    page = application.windows().find(page => page.url().endsWith('/main.html')) || await application.firstWindow()
    page.setDefaultTimeout(30000)
    page.on('pageerror', error => console.error('Renderer error:', error))
    page.on('console', message => { if (message.type() === 'error') console.error('Renderer console:', message.text()) })
    await page.waitForSelector('.app')
    async function dispatch (name, ...args) {
      await application.evaluate((electron, args) => {
        const root = electron.app.getAppPath()
        const fromProject = process.getBuiltinModule('module').createRequire(root + '/package.json')
        fromProject(root + '/build/main/windows').main.dispatch(...args)
      }, [name, ...args])
    }
    function waitForService (name, completeMetadata = false, infoHash) {
      return application.evaluate((electron, { name, completeMetadata, infoHash }) => {
        const root = electron.app.getAppPath()
        const fromProject = process.getBuiltinModule('module').createRequire(root + '/package.json')
        const service = fromProject(root + '/build/main/torrent-service')
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Utility event timed out: ' + name)), 30000)
          const listener = (...args) => {
            if (completeMetadata && !args[2]?.format?.duration) return
            if (infoHash && args[1]?.infoHash !== infoHash) return
            service.events.removeListener(name, listener)
            clearTimeout(timeout)
            resolve(args)
          }
          service.events.on(name, listener)
        })
      }, { name, completeMetadata, infoHash })
    }

    await dispatch('showCreateTorrent', [video, text])
    await page.getByRole('button', { name: 'Show advanced settings...' }).click()
    await page.getByRole('textbox', { name: 'Trackers' }).fill('')
    const ready = waitForService('wt-ready')
    await page.getByRole('button', { name: 'Create Torrent', exact: true }).click()
    const [, info] = await ready
    assert.strictEqual(info.files.length, 2)
    const videoIndex = info.files.findIndex(file => file.name === path.basename(video))
    assert(videoIndex >= 0)
    await page.waitForSelector('.torrent')
    console.log('Integration: native UI torrent creation and utility seeding passed')
    const posterPath = path.join(directory, 'Posters', info.infoHash + '.jpg')
    for (let i = 0; !fs.existsSync(posterPath) && i < 200; i++) await new Promise(resolve => setTimeout(resolve, 50))
    assert(fs.existsSync(posterPath), 'the utility process generates a video poster')
    assert.deepStrictEqual(fs.readFileSync(posterPath).subarray(0, 2), Buffer.from([0xff, 0xd8]), 'the poster is a JPEG')
    await page.waitForFunction(() => {
      const poster = document.querySelector('.torrent-cover img')
      return poster && poster.complete && poster.naturalWidth > 0
    })

    const running = waitForService('wt-server-running')
    await page.locator('.torrent .play').click()
    const [stream] = await running
    await page.waitForFunction(() => {
      const video = document.querySelector('video')
      return video && video.readyState >= 2 && document.querySelector('.subtitle-track-label')?.textContent === 'English'
    })
    await dispatch('playPause')
    await dispatch('skipTo', 1)
    await page.waitForFunction(() => {
      const video = document.querySelector('video')
      return video && video.textTracks[0]?.activeCues?.[0]?.text === 'Local integration subtitle'
    })
    const file = info.files[videoIndex]
    const fileURL = stream.localURL + '/' + file.path.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/')
    const range = await fetch(fileURL, { headers: { Range: 'bytes=0-15' } })
    assert.strictEqual(range.status, 206)
    assert.deepStrictEqual(Buffer.from(await range.arrayBuffer()), fs.readFileSync(video).subarray(0, 16))
    console.log('Integration: sandboxed video playback, seeking, subtitles and byte ranges passed')

    // Exercise detection, native IPC conversion and cached playback in the sandbox.
    await dispatch('backToList')
    const ac3 = path.join(downloads, 'unsupported audio.mkv')
    execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'color=size=160x90:duration=12',
      '-f', 'lavfi', '-i', 'sine=duration=12', '-c:v', 'libx264', '-c:a', 'ac3', ac3])
    const ac3Original = fs.readFileSync(ac3)
    await dispatch('showCreateTorrent', [ac3])
    const ac3Ready = waitForService('wt-ready')
    await page.getByRole('button', { name: 'Create Torrent', exact: true }).click()
    const [, ac3Info] = await ac3Ready
    await dispatch('playFile', ac3Info.infoHash, 0)
    await page.waitForFunction(() => {
      const v = document.querySelector('video')
      return v?.src.startsWith('file:') && v.audioTracks.length === 1 && v.webkitAudioDecodedByteCount > 0
    })
    assert.deepStrictEqual(fs.readFileSync(ac3), ac3Original, 'conversion preserves original torrent data')
    const cachedURL = await page.evaluate(() => document.querySelector('video').src)
    const cachedPath = require('url').fileURLToPath(cachedURL)
    const cachedMtime = fs.statSync(cachedPath).mtimeMs
    await dispatch('playPause')
    await page.waitForFunction(() => document.querySelector('video')?.paused)
    await dispatch('skipTo', 5)
    await page.waitForFunction(() => Math.abs(document.querySelector('video').currentTime - 5) < 0.2)
    await dispatch('backToList')
    await dispatch('playFile', ac3Info.infoHash, 0)
    await page.waitForFunction(url => document.querySelector('video')?.src === url && document.querySelector('video').audioTracks.length === 1, cachedURL)
    assert.strictEqual(fs.statSync(cachedPath).mtimeMs, cachedMtime, 'reopening reuses the cached conversion')
    console.log('Integration: AC-3 detection, sandboxed AAC conversion, seeking, original-data preservation and cache reuse passed')
    await dispatch('backToList')

    const cacheFile = path.join(directory, 'Torrents', info.infoHash + '.torrent')
    for (let i = 0; !fs.existsSync(cacheFile) && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 50))
    assert(fs.existsSync(cacheFile), 'torrent metadata is persisted for resume')
    const exported = path.join(directory, 'exported.torrent')
    await application.evaluate((electron, exported) => {
      electron.dialog.showSaveDialog = async () => ({ canceled: false, filePath: exported })
    }, exported)
    await page.evaluate(filename => window.webtorrent.invoke('native:save-torrent-as', filename, { title: 'Export test torrent' }), info.infoHash + '.torrent')
    assert.deepStrictEqual(fs.readFileSync(exported), fs.readFileSync(cacheFile))
    await assert.rejects(page.evaluate(() => window.webtorrent.invoke('native:save-torrent-as', '../config.json', {})))
    assert.strictEqual(await page.evaluate(() => [typeof window.require, typeof window.process, typeof window.state, typeof window.dispatch].join(',')), 'undefined,undefined,undefined,undefined')
    await assert.rejects(page.evaluate(() => window.webtorrent.invoke('arbitrary-node-command')))
    console.log('Integration: native export and restricted bridge passed')

    await dispatch('backToList')
    const stopped = waitForService('wt-progress')
    await dispatch('toggleTorrent', info.infoHash)
    await stopped
    const resumed = waitForService('wt-ready')
    await dispatch('toggleTorrent', info.infoHash)
    const [, resumedInfo] = await resumed
    assert.strictEqual(resumedInfo.infoHash, info.infoHash)
    assert.deepStrictEqual(resumedInfo.files, info.files)
    await dispatch('stateSaveImmediate')
    for (let i = 0; i < 100; i++) {
      const saved = JSON.parse(fs.readFileSync(path.join(directory, 'config.json')))
      if (saved.version === require('../package.json').version && saved.torrents.some(t => t.infoHash === info.infoHash)) break
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    const saved = JSON.parse(fs.readFileSync(path.join(directory, 'config.json')))
    assert.strictEqual(saved.version, require('../package.json').version)
    assert(saved.torrents.some(t => t.infoHash === info.infoHash))
    assert(fs.existsSync(path.join(directory, 'config.json.bak')))
    assert(!saved.telemetry)
    console.log('Integration: pause/resume, profile migration, atomic persistence and backup passed')

    const audio = path.join(downloads, 'audio with spaces.wav')
    execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4', '-metadata', 'title=Local audio fixture', audio])
    await dispatch('showCreateTorrent', [audio])
    const audioReady = waitForService('wt-ready')
    await page.getByRole('button', { name: 'Create Torrent', exact: true }).click()
    const [, audioInfo] = await audioReady
    const audioMetadata = waitForService('wt-audio-metadata', true)
    const audioRunning = waitForService('wt-server-running')
    await dispatch('playFile', audioInfo.infoHash, 0)
    const [audioStream] = await audioRunning
    const audioResponse = await fetch(audioStream.localURL + '/' + encodeURIComponent(audioInfo.files[0].path), { signal: AbortSignal.timeout(10000) })
    assert.strictEqual(audioResponse.status, 200)
    assert(audioResponse.headers.get('content-type').startsWith('audio/wav'))
    assert.deepStrictEqual(Buffer.from(await audioResponse.arrayBuffer()), fs.readFileSync(audio))
    const [, , metadata] = await audioMetadata
    assert(metadata.format.duration >= 3)
    await page.waitForFunction(() => document.querySelector('audio')?.readyState >= 2)
    await dispatch('setVolume', 0.25)
    await page.waitForFunction(() => document.querySelector('audio')?.volume === 0.25)
    await dispatch('playPause')
    await page.waitForFunction(() => document.querySelector('audio')?.paused)
    console.log('Integration: audio playback, worker metadata, volume and pause passed')
    await page.evaluate(() => { const input = document.createElement('input'); input.type = 'file'; input.id = 'test-file-bridge'; document.body.appendChild(input) })
    await page.locator('#test-file-bridge').setInputFiles(audio)
    assert.strictEqual(await page.evaluate(() => window.webtorrent.pathForFile(document.querySelector('#test-file-bridge').files[0])), audio)
    await page.locator('#test-file-bridge').evaluate(input => input.remove())
    await dispatch('toggleCastMenu', 'chromecast')
    await page.waitForFunction(() => document.querySelector('.options-list')?.textContent.includes('chromecast-1'))
    await dispatch('selectCastDevice', 1)
    await page.waitForSelector('.cast-status')
    await dispatch('stopCasting')
    await page.waitForFunction(() => document.querySelector('audio')?.readyState >= 2)
    console.log('Integration: sandboxed file paths, utility casting discovery, selection and return to local audio passed')

    // Recover a completed torrent whose data moved, then restart in an empty folder.
    await dispatch('backToList')
    const movedDownloads = path.join(directory, 'Moved downloads')
    fs.mkdirSync(movedDownloads)
    let stoppedFixture = waitForService('wt-progress')
    await dispatch('toggleTorrent', info.infoHash)
    await stoppedFixture
    fs.renameSync(seeds, path.join(movedDownloads, 'Fixture'))
    await dispatch('toggleTorrent', info.infoHash)
    await page.getByRole('button', { name: 'Retry torrent', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Retry torrent', exact: true }).click()
    await page.getByRole('button', { name: 'Retry torrent', exact: true }).waitFor()
    if (process.env.RECOVERY_SCREENSHOT_PATH) await page.screenshot({ path: process.env.RECOVERY_SCREENSHOT_PATH })
    let recoveryButton = page.getByRole('button', { name: 'Download again…', exact: true })
    await application.evaluate(({ dialog }) => { dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] }) })
    await recoveryButton.click()
    await dispatch('stateSaveImmediate')
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(directory, 'config.json'))).torrents.find(t => t.infoHash === info.infoHash).path, info.path, 'cancel preserves the saved location')

    for (let i = 0; i < 100; i++) {
      const missing = JSON.parse(fs.readFileSync(path.join(directory, 'config.json'))).torrents.find(t => t.infoHash === info.infoHash)
      if (missing.error === 'path-missing' && missing.status === 'paused') break
      await new Promise(resolve => setTimeout(resolve, 25))
    }
    await application.close()
    application = await _electron.launch({ executablePath: packaged || require('electron'), args: packaged ? ['--hidden'] : [path.join(__dirname, '..'), '--hidden'], env: { ...process.env, NODE_ENV: 'test', WEBTORRENT_TEST_DIR: directory } })
    page = application.windows().find(page => page.url().endsWith('/main.html')) || await application.firstWindow()
    page.setDefaultTimeout(30000)
    await page.getByRole('button', { name: 'Retry torrent', exact: true }).waitFor()
    recoveryButton = page.getByRole('button', { name: 'Download again…', exact: true })

    await application.evaluate(({ dialog }, destination) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [destination] })
    }, movedDownloads)
    const recovered = waitForService('wt-ready', false, info.infoHash)
    await recoveryButton.click()
    const [, recoveredInfo] = await recovered
    assert.strictEqual(fs.realpathSync(recoveredInfo.path), fs.realpathSync(movedDownloads))
    assert.strictEqual(recoveredInfo.bytesReceived, 0, 'moved files are verified without downloading again')
    const fixtureCard = page.locator('.torrent').filter({ has: page.getByRole('heading', { name: info.name, exact: true }) })
    await fixtureCard.getByText('Seeding', { exact: true }).waitFor()
    assert.strictEqual(await fixtureCard.getByRole('button', { name: 'Download again…' }).count(), 0, 'successful recovery removes the error actions')

    stoppedFixture = waitForService('wt-progress')
    await fixtureCard.getByRole('button', { name: 'Pause torrent' }).click()
    await stoppedFixture
    const offlineDownloads = path.join(directory, 'Offline downloads')
    fs.renameSync(movedDownloads, offlineDownloads)
    await fixtureCard.getByRole('button', { name: 'Resume torrent' }).click()
    await fixtureCard.getByRole('button', { name: 'Retry torrent' }).waitFor()
    const emptyDownloads = path.join(directory, 'New downloads')
    fs.mkdirSync(emptyDownloads)
    await application.evaluate(({ dialog }, destination) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [destination] })
    }, emptyDownloads)
    const restarted = waitForService('wt-ready', false, info.infoHash)
    await fixtureCard.getByRole('button', { name: 'Download again…' }).click()
    const [, restartedInfo] = await restarted
    assert.strictEqual(fs.realpathSync(restartedInfo.path), fs.realpathSync(emptyDownloads))
    await fixtureCard.getByText('Downloading', { exact: true }).waitFor()
    await fixtureCard.getByText('0%', { exact: true }).waitFor()
    await dispatch('stateSaveImmediate')
    let recoveredSaved
    for (let i = 0; i < 100; i++) {
      recoveredSaved = JSON.parse(fs.readFileSync(path.join(directory, 'config.json'))).torrents.find(t => t.infoHash === info.infoHash)
      if (recoveredSaved.path === restartedInfo.path && !recoveredSaved.fileModtimes) break
      await new Promise(resolve => setTimeout(resolve, 25))
    }
    assert.strictEqual(fs.realpathSync(recoveredSaved.path), fs.realpathSync(emptyDownloads))
    assert(!recoveredSaved.error && !recoveredSaved.fileModtimes, 'restart does not persist stale errors or completion timestamps')
    assert.deepStrictEqual(recoveredSaved.selections, [true, true])
    assert(fs.existsSync(path.join(offlineDownloads, 'Fixture', path.basename(video))), 'recovery preserves files at the old location')
    console.log('Integration: missing-path retry, canceled recovery, restart persistence, moved-file verification and fresh download passed')
  } catch (error) {
    if (page) console.error(await page.evaluate(() => ({ body: document.body.innerText.slice(-1500), video: document.querySelector('video') && { readyState: document.querySelector('video').readyState, src: document.querySelector('video').src, error: document.querySelector('video').error?.message }, subtitle: document.querySelector('.subtitle-track-label')?.textContent, audio: document.querySelector('audio') && { readyState: document.querySelector('audio').readyState, src: document.querySelector('audio').src, error: document.querySelector('audio').error?.message, paused: document.querySelector('audio').paused, networkState: document.querySelector('audio').networkState } })))
    throw error
  } finally {
    if (application) await application.close()
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
