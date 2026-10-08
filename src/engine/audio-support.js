const { execFile } = require('child_process')
const { promisify } = require('util')
const fs = require('fs/promises')
const path = require('path')
const crypto = require('crypto')
const { pathToFileURL } = require('url')
const { findTool } = require('./embedded-subtitles')

const run = promisify(execFile)
const jobs = new Map()

async function probeAudio (filePath) {
  const tool = findTool('ffprobe')
  if (!tool) return null
  const { stdout } = await run(tool, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-select_streams', 'a', '-show_entries', 'stream=index,codec_name', '-of', 'json', filePath], { timeout: 30000, maxBuffer: 1024 * 1024, windowsHide: true })
  return JSON.parse(stdout).streams || []
}

async function convertAudio (filePath, directory) {
  const tool = findTool('ffmpeg')
  if (!tool) throw new Error('Audio conversion needs FFmpeg. Install FFmpeg or play this file in VLC.')
  const stat = await fs.stat(filePath)
  const key = crypto.createHash('sha256').update(JSON.stringify(['aac-v1', filePath, stat.size, stat.mtimeMs])).digest('hex')
  const output = path.join(directory, key + '.mkv')
  await fs.mkdir(directory, { recursive: true })
  try {
    if ((await fs.stat(output)).size > 0) return pathToFileURL(output).href
  } catch (_) {}
  const previous = jobs.get(key)
  if (previous) {
    if (!previous.controller.signal.aborted) return previous.promise
    await previous.promise.catch(() => {})
    return convertAudio(filePath, directory)
  }
  const controller = new AbortController()
  const temporary = output + '.partial'
  const promise = (async () => {
    try {
      // Keep video packets and audio track order. Subtitles are supplied separately.
      await run(tool, ['-nostdin', '-v', 'error', '-y', '-protocol_whitelist', 'file,pipe', '-i', filePath, '-map', '0:v?', '-map', '0:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-f', 'matroska', temporary], { signal: controller.signal, timeout: 30 * 60 * 1000, maxBuffer: 1024 * 1024, windowsHide: true })
      const after = await fs.stat(filePath)
      if (after.size !== stat.size || after.mtimeMs !== stat.mtimeMs) throw new Error('The source file changed during audio conversion.')
      await fs.rename(temporary, output)
      return pathToFileURL(output).href
    } finally {
      await fs.rm(temporary, { force: true })
      jobs.delete(key)
    }
  })()
  jobs.set(key, { controller, promise })
  return promise
}

function cancelConversions () {
  for (const job of jobs.values()) job.controller.abort()
}

module.exports = { probeAudio, convertAudio, cancelConversions }
