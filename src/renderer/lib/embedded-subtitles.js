const { execFile } = require('child_process')
const fs = require('fs')
const path = require('path')
const { promisify } = require('util')

const run = promisify(execFile)
const textCodecs = new Set(['ass', 'ssa', 'subrip', 'webvtt', 'mov_text', 'text'])

function findTool (name) {
  const executable = process.platform === 'win32' ? name + '.exe' : name
  // Finder does not inherit the shell's Homebrew PATH.
  const directories = [path.dirname(process.execPath), '/opt/homebrew/bin', '/usr/local/bin', ...(process.env.PATH || '').split(path.delimiter)]
  for (const directory of directories) {
    if (!directory) continue
    const candidate = path.join(directory, executable)
    try {
      fs.accessSync(candidate, fs.constants.X_OK)
      return candidate
    } catch (_) {}
  }
  throw new Error('Embedded subtitles require FFmpeg and ffprobe. Install FFmpeg to enable them.')
}

function languageName (code) {
  if (!code || code === 'und') return 'Subtitle'
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(new Intl.Locale(code).language)
  } catch (_) {
    return code
  }
}

async function extractEmbeddedSubtitles (filePath) {
  const ffprobe = findTool('ffprobe')
  const ffmpeg = findTool('ffmpeg')
  const options = { encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024, windowsHide: true }
  const { stdout } = await run(ffprobe, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-select_streams', 's', '-show_entries', 'stream=index,codec_name:stream_tags=language,title:stream_disposition=default,forced', '-of', 'json', filePath], options)
  const streams = JSON.parse(stdout).streams || []
  const tracks = []
  // Extract sequentially to avoid launching one process per language at once.
  for (const stream of streams) {
    if (!textCodecs.has(stream.codec_name)) continue
    const result = await run(ffmpeg, ['-nostdin', '-v', 'error', '-protocol_whitelist', 'file,pipe', '-i', filePath, '-map', `0:${stream.index}`, '-c:s', 'webvtt', '-f', 'webvtt', 'pipe:1'], options)
    if (!result.stdout.startsWith('WEBVTT')) continue
    const language = languageName(stream.tags && stream.tags.language)
    const title = stream.tags && stream.tags.title
    const forced = !!(stream.disposition && stream.disposition.forced)
    tracks.push({
      buffer: 'data:text/vtt;base64,' + Buffer.from(result.stdout).toString('base64'),
      language,
      label: language + (title ? ` (${title})` : forced ? ' (Forced)' : ''),
      filePath,
      streamIndex: stream.index,
      embedded: true,
      default: !!(stream.disposition && stream.disposition.default),
      forced
    })
  }
  return tracks
}

module.exports = { extractEmbeddedSubtitles, languageName }
