const fs = require('fs')
const { Writable } = require('stream')
const { pipeline } = require('stream/promises')
const LanguageDetect = require('languagedetect')
const srtToVtt = require('srt-to-vtt')

async function readSubtitle (filePath) {
  if (typeof filePath !== 'string' || !/\.(srt|vtt)$/i.test(filePath)) throw new Error('Choose an SRT or VTT subtitle file')
  const chunks = []
  let size = 0
  const collect = new Writable({
    objectMode: true,
    write (chunk, encoding, cb) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += buffer.length
      if (size > 16 * 1024 * 1024) return cb(new Error('Subtitle file is too large'))
      chunks.push(buffer)
      cb()
    }
  })
  // The legacy converter has no async iterator. Pipeline also forwards read
  // errors and closes every stream when the size limit is exceeded.
  const source = fs.createReadStream(filePath)
  if (/\.srt$/i.test(filePath)) await pipeline(source, srtToVtt(), collect)
  else await pipeline(source, collect)
  const buffer = Buffer.concat(chunks)
  const text = buffer.toString().replace(/(.*-->.*)/g, '')
  const detected = new LanguageDetect().detect(text, 2)
  const language = detected.length ? detected[0][0] : 'subtitle'
  const label = language[0].toUpperCase() + language.slice(1)
  return { buffer: 'data:text/vtt;base64,' + buffer.toString('base64'), language: label, label, filePath }
}

module.exports = { readSubtitle }
