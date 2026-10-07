const fs = require('fs')
const LanguageDetect = require('languagedetect')
const srtToVtt = require('srt-to-vtt')

async function readSubtitle (filePath) {
  if (typeof filePath !== 'string' || !/\.(srt|vtt)$/i.test(filePath)) throw new Error('Choose an SRT or VTT subtitle file')
  const chunks = []
  let size = 0
  const stream = fs.createReadStream(filePath).pipe(srtToVtt())
  for await (const chunk of stream) {
    size += chunk.length
    if (size > 16 * 1024 * 1024) { stream.destroy(); throw new Error('Subtitle file is too large') }
    chunks.push(chunk)
  }
  const buffer = Buffer.concat(chunks)
  const text = buffer.toString().replace(/(.*-->.*)/g, '')
  const detected = new LanguageDetect().detect(text, 2)
  const language = detected.length ? detected[0][0] : 'subtitle'
  const label = language[0].toUpperCase() + language.slice(1)
  return { buffer: 'data:text/vtt;base64,' + buffer.toString('base64'), language: label, label, filePath }
}

module.exports = { readSubtitle }
