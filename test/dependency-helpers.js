const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const formatBytes = require('../src/shared/format-bytes')
const language = require('../src/engine/subtitle-language')
const { readSubtitle } = require('../src/engine/subtitles')

async function main () {
  for (const [bytes, expected] of [[0, '0 B'], [128, '128 B'], [1000, '1 KB'], [1500, '1.5 KB'], [12500, '13 KB'], [1e6, '1 MB'], [-1500, '-1.5 KB'], [0.5, '0.5 B']]) {
    assert.strictEqual(formatBytes(bytes), expected)
  }
  for (const invalid of [NaN, Infinity, '100']) assert.throws(() => formatBytes(invalid), TypeError)
  assert.strictEqual(language('film.en.srt', 'Hola'), 'English', 'explicit language metadata wins')
  assert.strictEqual(language('film.pt-BR.forced.srt', ''), 'Brazilian Portuguese')
  assert.strictEqual(language('captions.srt', 'You are with the people and this is what you have.'), 'English')
  assert.strictEqual(language('captions.srt', 'Estoy aquí para que los niños tengan una casa. Gracias.'), 'Spanish')
  assert.strictEqual(language('captions.srt', 'これは日本語の字幕です。'), 'Japanese')
  assert.strictEqual(language('captions.srt', '안녕하세요'), 'Korean')
  assert.strictEqual(language('captions.srt', 'OK!'), 'captions', 'short ambiguous text keeps its filename')
  assert.strictEqual(language('captions.srt', '123\n00:00:01,000 --> 00:00:02,000'), 'captions')
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'webtorrent-subtitle-reader-'))
  try {
    const source = '1\r\n00:00:01,250 --> 00:00:03,500\r\n{\\an8}{i}Café{/i}\r\n\r\n2\r\n00:00:04,000 --> 00:00:06,000\r\n{\\b1}Second line{\\b0}\r\n'
    const file = path.join(directory, 'film.en.srt')
    fs.writeFileSync(file, source)
    const result = await readSubtitle(file)
    const text = Buffer.from(result.buffer.split(',')[1], 'base64').toString()
    assert(text.startsWith('WEBVTT\n\n'))
    assert(text.includes('00:00:01.250 --> 00:00:03.500 line:5%\n<i>Café</i>'))
    assert(text.includes('<b>Second line</b>'))
    assert.strictEqual(result.label, 'English')
    const vtt = path.join(directory, 'captions.vtt')
    fs.writeFileSync(vtt, text)
    assert.strictEqual((await readSubtitle(vtt)).buffer, result.buffer, 'VTT content is not converted twice')
    for (const encoding of ['utf16le', 'latin1']) {
      fs.writeFileSync(file, Buffer.from((encoding === 'utf16le' ? '\ufeff' : '') + source, encoding))
      assert.strictEqual((await readSubtitle(file)).buffer, result.buffer, encoding + ' subtitles decode correctly')
    }
    fs.writeFileSync(file, Buffer.alloc(16 * 1024 * 1024 + 1))
    await assert.rejects(readSubtitle(file), /too large/)
    await assert.rejects(readSubtitle(path.join(directory, 'missing.srt')), { code: 'ENOENT' })
    await assert.rejects(readSubtitle(path.join(directory, 'movie.mp4')), /SRT or VTT/)
  } finally { fs.rmSync(directory, { recursive: true, force: true }) }
  console.log('Dependency helper checks passed: byte formatting, subtitle conversion/encodings/limits and conservative language labels')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
