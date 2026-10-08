const assert = require('assert')
const fs = require('fs/promises')
const os = require('os')
const path = require('path')
const { fileURLToPath } = require('url')
const { execFileSync } = require('child_process')
const { probeAudio, convertAudio, cancelConversions } = require('../src/engine/audio-support')

async function main () {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'webtorrent-audio-test-'))
  const source = path.join(directory, 'source.mkv')
  const cache = path.join(directory, 'cache')
  const ffmpeg = args => execFileSync('ffmpeg', ['-nostdin', '-v', 'error', ...args])
  try {
    ffmpeg(['-f', 'lavfi', '-i', 'color=size=16x16:duration=3', '-f', 'lavfi', '-i', 'sine=duration=3', '-c:v', 'libx264', '-c:a', 'ac3', source])
    const original = await fs.readFile(source)
    assert.strictEqual((await probeAudio(source))[0].codec_name, 'ac3')
    const [first, duplicate] = await Promise.all([convertAudio(source, cache), convertAudio(source, cache)])
    assert.strictEqual(first, duplicate, 'concurrent requests share a conversion')
    const output = fileURLToPath(first)
    assert.strictEqual((await probeAudio(output))[0].codec_name, 'aac')
    assert.deepStrictEqual(await fs.readFile(source), original, 'seeding data remains intact')
    const videoHash = file => ffmpeg(['-i', file, '-map', '0:v', '-c', 'copy', '-f', 'hash', '-']).toString()
    assert.strictEqual(videoHash(source), videoHash(output), 'video packets are copied without re-encoding')
    const before = await fs.stat(output)
    assert.strictEqual(await convertAudio(source, cache), first)
    assert.strictEqual((await fs.stat(output)).mtimeMs, before.mtimeMs, 'cached copies are reused')
    await fs.utimes(source, new Date(), new Date(Date.now() + 5000))
    assert.notStrictEqual(await convertAudio(source, cache), first, 'changed source invalidates the cache')
    const silent = path.join(directory, 'silent.mkv')
    ffmpeg(['-i', source, '-map', '0:v', '-c', 'copy', silent])
    assert.deepStrictEqual(await probeAudio(silent), [], 'silent videos are distinguishable from unsupported audio')
    await assert.rejects(convertAudio(silent, cache), 'failed conversions reject')
    assert((await fs.readdir(cache)).every(name => name.endsWith('.mkv')), 'failed conversions leave no partial file')
    const longAudio = path.join(directory, 'long.mka')
    ffmpeg(['-stream_loop', '199', '-i', source, '-map', '0:a', '-c', 'copy', longAudio])
    const cancelCache = path.join(directory, 'cancel-cache')
    const cancelled = convertAudio(longAudio, cancelCache).then(() => null, error => error)
    const deadline = Date.now() + 5000
    while (Date.now() < deadline) {
      try {
        if ((await fs.readdir(cancelCache)).some(name => name.endsWith('.partial'))) break
      } catch (_) {}
      await new Promise(resolve => setTimeout(resolve, 5))
    }
    cancelConversions()
    const cancellation = await cancelled
    assert.strictEqual(cancellation?.name, 'AbortError', 'closing playback cancels FFmpeg')
    assert.deepStrictEqual(await fs.readdir(cancelCache), [], 'cancelled copies are never published')
    console.log('Audio tests passed: AC-3 detection, AAC conversion, video preservation, cache reuse/invalidation, silence, failure cleanup and cancellation')
  } finally {
    cancelConversions()
    await fs.rm(directory, { recursive: true, force: true })
  }
}

main().catch(err => { console.error(err); process.exitCode = 1 })
