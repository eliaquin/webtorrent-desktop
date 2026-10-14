const cp = require('child_process')
const fs = require('fs')
const path = require('path')

// Use native archive tools, preserving Mac/Linux symlinks and executable modes.
// Write a fresh archive before replacing the output so old entries cannot linger.
function zipSync (input, output, { platform = process.platform, run = cp.execFileSync } = {}) {
  input = path.resolve(input)
  output = path.resolve(output)
  if (!fs.statSync(input).isDirectory()) throw new Error('Archive input must be a directory')
  const relative = path.relative(input, output)
  if (!relative || (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))) {
    throw new Error('Archive output must be outside its input directory')
  }
  const temporary = fs.mkdtempSync(path.join(path.dirname(output), '.webtorrent-zip-'))
  const archive = path.join(temporary, 'archive.zip')
  try {
    if (platform === 'darwin') {
      run('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', input, archive])
    } else if (platform === 'win32') {
      // Paths travel through the environment, never interpolated into PowerShell.
      // Keep the existing portable ZIP layout: directory contents at its root.
      const script = "$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory($env:WEBTORRENT_ZIP_INPUT, $env:WEBTORRENT_ZIP_OUTPUT)"
      run('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], {
        windowsHide: true,
        env: { ...process.env, WEBTORRENT_ZIP_INPUT: input, WEBTORRENT_ZIP_OUTPUT: archive }
      })
    } else {
      run('zip', ['-q', '-r', '-y', archive, './' + path.basename(input)], { cwd: path.dirname(input) })
    }
    fs.renameSync(archive, output)
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true })
  }
}

module.exports = { zipSync }
