/* globals document */

process.env.NODE_ENV = 'test'
const { app, BrowserWindow } = require('electron')
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { pathToFileURL } = require('url')

const projectRoot = path.join(__dirname, '..')
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'webtorrent-subtitles-'))
const fixture = path.join(directory, 'video with spaces.mkv')
const html = path.join(directory, 'index.html')
fs.writeFileSync(html, '<!doctype html><div id="body"></div>')
for (const [name, text] of [['english', 'English test cue'], ['forced', 'Forced test cue'], ['french', 'French test cue']]) {
  fs.writeFileSync(path.join(directory, name + '.srt'), `1\n00:00:00,000 --> 00:00:04,000\n${text}\n`)
}
execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'color=size=16x16:duration=4',
  '-i', path.join(directory, 'english.srt'), '-i', path.join(directory, 'forced.srt'), '-i', path.join(directory, 'french.srt'),
  '-map', '0:v', '-map', '1:0', '-map', '2:0', '-map', '3:0', '-c:v', 'ffv1', '-c:s', 'ass',
  '-metadata:s:s:0', 'language=eng', '-disposition:s:0', 'default',
  '-metadata:s:s:1', 'language=eng', '-metadata:s:s:1', 'title=Forced', '-disposition:s:1', 'forced',
  '-metadata:s:s:2', 'language=fre', '-disposition:s:2', '0', fixture])
const timeout = setTimeout(() => finish(new Error('Subtitle tests timed out')), 30000)

function finish (err) {
  clearTimeout(timeout)
  fs.rmSync(directory, { recursive: true, force: true })
  if (err) console.error(err)
  app.exit(err ? 1 : 0)
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false } })
  await win.loadFile(html)
  const media = pathToFileURL(path.join(projectRoot, 'test/resources/monitor-test.mp4')).href
  console.log(await win.webContents.executeJavaScript(`(${runTests.toString()})(${JSON.stringify(projectRoot)}, ${JSON.stringify(fixture)}, ${JSON.stringify(media)}, ${JSON.stringify(process.env.EMBEDDED_SUBTITLE_TEST_FILE || '')})`))
  finish()
}).catch(finish)

async function runTests (projectRoot, fixture, media, realFile) {
  const assert = require('assert')
  const path = require('path')
  const { extractEmbeddedSubtitles } = require(projectRoot + '/build/engine/embedded-subtitles')
  require(projectRoot + '/build/renderer/lib/native-api').extractEmbeddedSubtitles = extractEmbeddedSubtitles
  const SubtitlesController = require(projectRoot + '/build/renderer/controllers/subtitles-controller')
  const dispatcher = require(projectRoot + '/build/renderer/lib/dispatcher')
  const errors = []
  dispatcher.setDispatch((...args) => errors.push(args))

  const tracks = await extractEmbeddedSubtitles(fixture)
  assert.strictEqual(tracks.length, 3)
  assert.deepStrictEqual(tracks.map(t => t.language), ['English', 'English', 'French'])
  assert.strictEqual(tracks[0].default, true)
  assert.strictEqual(tracks[1].forced, true)
  assert.strictEqual(tracks[1].label, 'English (Forced)')
  assert(Buffer.from(tracks[0].buffer.split(',')[1], 'base64').toString().includes('English test cue'))
  const subtitles = () => ({ tracks: [], selectedIndex: -1, showMenu: false })
  const file = { path: path.basename(fixture) }
  const torrent = { path: path.dirname(fixture), status: 'downloading', progress: { files: [{ numPieces: 2, numPiecesPresent: 1 }] } }
  const state = {
    playing: { type: 'video', location: 'local', fileIndex: 0, subtitles: subtitles() },
    getPlayingTorrentSummary: () => torrent,
    getPlayingFileSummary: () => file
  }
  const controller = new SubtitlesController(state)

  async function waitFor (predicate) {
    for (let i = 0; i < 500; i++) {
      if (predicate()) return
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    throw new Error('Timed out waiting for subtitles')
  }

  controller.checkForEmbeddedSubtitles()
  assert(!state.playing.subtitles.loadingEmbedded, 'partial files are not extracted')
  torrent.progress.files[0].numPiecesPresent = 2
  controller.checkForEmbeddedSubtitles()
  controller.checkForEmbeddedSubtitles()
  await waitFor(() => state.playing.subtitles.checkedEmbedded)
  assert.strictEqual(state.playing.subtitles.tracks.length, 3, 'concurrent discovery does not duplicate tracks')
  assert.strictEqual(state.playing.subtitles.selectedIndex, 0, 'full default track is selected')
  controller.checkForEmbeddedSubtitles()
  assert.strictEqual(state.playing.subtitles.tracks.length, 3, 'completed discovery is cached for playback')
  assert.strictEqual(state.playing.subtitles.tracks[1].label, 'English (Forced)')

  file.selectedSubtitle = { filePath: fixture, streamIndex: tracks[2].streamIndex }
  state.playing.subtitles = subtitles()
  controller.checkForEmbeddedSubtitles()
  await waitFor(() => state.playing.subtitles.checkedEmbedded)
  assert.strictEqual(state.playing.subtitles.selectedIndex, 2, 'saved embedded language is restored')

  state.playing.subtitles = subtitles()
  controller.checkForEmbeddedSubtitles()
  controller.selectSubtitle(-1)
  await waitFor(() => state.playing.subtitles.checkedEmbedded)
  assert.strictEqual(state.playing.subtitles.selectedIndex, -1, 'Off selected during extraction is respected')

  state.playing.subtitles = subtitles()
  const old = state.playing.subtitles
  controller.checkForEmbeddedSubtitles()
  state.playing.subtitles = subtitles()
  await waitFor(() => !old.loadingEmbedded)
  assert.strictEqual(state.playing.subtitles.tracks.length, 0, 'late extraction cannot leak into another video')
  assert.deepStrictEqual(errors, [])

  // Verify Chromium actually loads converted ASS cues and activates them.
  const video = document.createElement('video')
  const track = document.createElement('track')
  track.kind = 'subtitles'
  track.src = tracks[0].buffer
  track.default = true
  video.appendChild(track)
  document.body.appendChild(video)
  video.src = media
  video.load()
  await waitFor(() => video.readyState >= 1 && track.readyState === 2)
  track.track.mode = 'showing'
  video.currentTime = 1
  await waitFor(() => track.track.activeCues && track.track.activeCues.length > 0)
  assert.strictEqual(track.track.activeCues[0].text, 'English test cue')
  video.remove()

  if (realFile) {
    const actual = await extractEmbeddedSubtitles(realFile)
    assert(actual.length > 0)
    for (const extracted of actual) {
      const video = document.createElement('video')
      const track = document.createElement('track')
      track.kind = 'subtitles'
      track.src = extracted.buffer
      track.default = true
      video.appendChild(track)
      document.body.appendChild(video)
      track.track.mode = 'hidden'
      await waitFor(() => track.readyState === 2)
      assert(track.track.cues.length > 0, 'the real video produces playable subtitle cues')
      video.remove()
    }
    assert.strictEqual(actual.filter(t => t.default).length, 1)
  }
  return 'Subtitle tests passed: ASS extraction, language/forced labels, default/saved selection, partial files, duplicate discovery, stale playback, explicit Off, active Chromium cues' + (realFile ? ', supplied video tracks' : '')
}
