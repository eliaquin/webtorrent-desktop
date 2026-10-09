const assert = require('assert')
const { NativePlayer } = require('../src/main/native-player')

async function main () {
  const calls = []
  const snapshots = []
  let releaseClose
  let delayClose = false
  const bridge = {
    open: (...args) => calls.push(['open', ...args]),
    close: () => delayClose ? new Promise(resolve => { releaseClose = resolve }) : Promise.resolve(),
    command: (...args) => calls.push(['command', ...args]),
    bounds: (...args) => calls.push(['bounds', ...args]),
    snapshot: () => ({ state: 3, currentTime: 1, subtitleTracks: [], audioTracks: [] })
  }
  const win = { isDestroyed: () => false, getNativeWindowHandle: () => Buffer.alloc(8), setBackgroundColor: color => calls.push(['background', color]) }
  const player = new NativePlayer({ window: () => win, send: data => snapshots.push(data), runtime: () => '/vlc', load: () => bridge })
  player.stream = { localURL: 'http://localhost:4000/token/webtorrent/' + 'a'.repeat(40) }
  const options = { url: player.stream.localURL + '/movie.mp4', requestId: 'first', paused: false, volume: 0.5, rate: 1, position: 10 }
  try {
    for (const url of ['file:///etc/passwd', 'https://example.com/movie.mp4', 'http://localhost:4001/movie.mp4', 'http://localhost:4000/other/movie.mp4', options.url + '?option=1', options.url + '#fragment', options.url.replace('localhost', 'user@localhost'), player.stream.localURL + '/../outside']) {
      assert.throws(() => player.open({ ...options, url }), /active torrent media URL/)
    }
    for (const value of [NaN, Infinity, -1, 2]) assert.throws(() => player.open({ ...options, volume: value }), /settings/)
    const first = await player.open(options)
    assert(first.sessionId)
    assert.strictEqual(calls.find(call => call[0] === 'open')[4], 10, 'resume time reaches libVLC')
    assert(snapshots.some(snapshot => snapshot.sessionId === first.sessionId && snapshot.requestId === 'first'))
    for (const [name, value] of [['volume', -1], ['volume', Infinity], ['seek', NaN], ['rate', 0], ['pause', 2], ['audio-track', 1.5], ['subtitle-track', -2], ['run-shell', 'sh']]) {
      assert.throws(() => player.command(first.sessionId, name, value), /Invalid native playback command/)
    }
    assert(player.command(first.sessionId, 'seek', 5))
    assert.strictEqual(player.command('stale', 'seek', 20), false)
    assert.throws(() => player.bounds(first.sessionId, { x: 0, y: 0, width: Infinity, height: 100 }), /bounds/)
    assert(player.bounds(first.sessionId, { x: 0, y: 0, width: 800, height: 500 }))
    assert.strictEqual(player.bounds('stale', { x: 0, y: 0, width: 800, height: 500 }), false)

    // A late close from an old component must not cancel a new queued open.
    const secondPromise = player.open({ ...options, requestId: 'second' })
    const lateClose = player.close(first.sessionId)
    const second = await secondPromise
    await lateClose
    assert.strictEqual(player.session.id, second.sessionId)
    await player.close(first.sessionId)
    assert.strictEqual(player.session.id, second.sessionId)

    delayClose = true
    const third = player.open({ ...options, requestId: 'third' })
    await new Promise(resolve => setImmediate(resolve))
    const fourth = player.open({ ...options, requestId: 'fourth' })
    delayClose = false
    releaseClose()
    assert.strictEqual(await third, null, 'a superseded open never attaches a video surface')
    const newest = await fourth
    assert.strictEqual(player.session.id, newest.sessionId)
    assert.strictEqual(calls.filter(call => call[0] === 'open').length, 3)
    await player.close(newest.sessionId)
    assert.strictEqual(player.session, null)
    assert.strictEqual(calls.at(-1)[1], '#282828', 'closing restores the opaque window background')
    const missing = new NativePlayer({ window: () => win, send: () => {}, runtime: () => null })
    assert.strictEqual(missing.availability().available, false)
    console.log('Native player unit checks passed: source authorization, values, stale sessions, cancelled opens, serialized teardown and missing runtime')
  } finally { delayClose = false; await player.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
