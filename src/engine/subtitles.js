const fs = require('fs')
const subtitleLanguage = require('./subtitle-language')

async function readSubtitle (filePath) {
  if (typeof filePath !== 'string' || !/\.(srt|vtt)$/i.test(filePath)) throw new Error('Choose an SRT or VTT subtitle file')
  const chunks = []
  let size = 0
  for await (const chunk of fs.createReadStream(filePath)) {
    size += chunk.length
    if (size > 16 * 1024 * 1024) throw new Error('Subtitle file is too large')
    chunks.push(chunk)
  }
  const text = decode(Buffer.concat(chunks))
  const converted = /\.srt$/i.test(filePath) ? toVtt(text) : text
  const label = subtitleLanguage(filePath, text)
  return { buffer: 'data:text/vtt;base64,' + Buffer.from(converted).toString('base64'), language: label, label, filePath }
}

function decode (buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return new TextDecoder('utf-16le').decode(buffer)
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return new TextDecoder('utf-16be').decode(buffer)
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer) } catch {
    return new TextDecoder('windows-1252').decode(buffer)
  }
}

function toVtt (text) {
  const cues = text.trim().replace(/\r\n?/g, '\n').split(/\n\s*\n/).map(cue => {
    const lines = cue.split('\n')
    const timing = lines.findIndex(line => line.includes('-->'))
    if (timing === -1) return cue
    lines[timing] = lines[timing].replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    for (let i = timing + 1; i < lines.length; i++) {
      if (lines[i].includes('{\\an8}')) {
        if (!/\bline:/.test(lines[timing])) lines[timing] += ' line:5%'
        lines[i] = lines[i].replace(/\{\\an8\}/g, '')
      }
      lines[i] = lines[i].replace(/\{\\([ibu])1\}|\{([ibu])\}/g, (_, a, b) => '<' + (a || b) + '>')
        .replace(/\{\\([ibu])0?\}|\{\/([ibu])\}/g, (_, a, b) => '</' + (a || b) + '>')
    }
    return lines.join('\n')
  })
  return 'WEBVTT\n\n' + cues.join('\n\n') + '\n'
}

module.exports = { readSubtitle }
