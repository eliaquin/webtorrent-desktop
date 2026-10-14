const cp = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { promisify } = require('util')

// Return the executable and any launcher arguments separately. In particular,
// `flatpak run ...` is not an executable filename and must never use a shell.
async function findVlc ({
  platform = process.platform,
  env = process.env,
  home = os.homedir(),
  access = fs.promises.access,
  stat = fs.promises.stat,
  run = promisify(cp.execFile),
  readRegistry = readInstallDir
} = {}) {
  const paths = platform === 'win32' ? path.win32 : path.posix
  const executable = platform === 'win32' ? 'vlc.exe' : 'vlc'
  const searchPath = (env.PATH || env.Path || '').split(platform === 'win32' ? ';' : ':')
    .map(directory => directory.replace(/^"(.*)"$/, '$1'))
    .filter(directory => paths.isAbsolute(directory))
  const onPath = name => searchPath.map(directory => paths.join(directory, name))
  const available = async candidate => {
    try {
      await access(candidate, platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK)
      return (await stat(candidate)).isFile()
    } catch { return false }
  }
  const candidates = []
  if (platform === 'darwin') {
    candidates.push('/Applications/VLC.app/Contents/MacOS/VLC', paths.join(home, 'Applications/VLC.app/Contents/MacOS/VLC'))
  } else if (platform === 'win32') {
    for (const key of ['\\Software\\VideoLAN\\VLC', '\\Software\\Wow6432Node\\VideoLAN\\VLC']) {
      const directory = await readRegistry(key)
      if (directory && paths.isAbsolute(directory)) candidates.push(paths.join(directory, executable))
    }
    for (const directory of [env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA && paths.join(env.LOCALAPPDATA, 'Programs')]) {
      if (directory && paths.isAbsolute(directory)) candidates.push(paths.join(directory, 'VideoLAN', 'VLC', executable))
    }
  }
  candidates.push(...onPath(executable))
  if (platform !== 'win32') candidates.push('/opt/homebrew/bin/vlc', '/usr/local/bin/vlc', '/usr/bin/vlc', '/snap/bin/vlc')
  for (const command of new Set(candidates)) {
    if (await available(command)) return { command, args: [] }
  }
  if (platform === 'linux') {
    for (const command of new Set([...onPath('flatpak'), '/usr/bin/flatpak'])) {
      if (!await available(command)) continue
      try {
        await run(command, ['info', 'org.videolan.VLC'], { timeout: 5000, windowsHide: true })
        return { command, args: ['run', 'org.videolan.VLC'] }
      } catch { /* Flatpak exists, but VLC may not be installed. */ }
    }
  }
  throw new Error('VLC not found')
}

function readInstallDir (key) {
  const Registry = require('winreg')
  return new Promise(resolve => {
    new Registry({ hive: Registry.HKLM, key }).get('InstallDir', (err, item) => resolve(err ? null : item?.value))
  })
}

module.exports = findVlc
