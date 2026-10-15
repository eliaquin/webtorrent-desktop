const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { packager } = require('@electron/packager')
const { extractFile } = require('@electron/asar')
const plist = require('plist')
const { all, darwin } = require('../bin/package')
const { packageMac } = require('../bin/macos-package')

async function main () {
  if (process.platform !== 'darwin') throw new Error('This packaging smoke test requires macOS')
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'torrentcat-package-test-'))
  try {
    const [output] = await packager({ ...all, ...darwin, arch: process.arch, out: directory })
    const app = path.join(output, 'TorrentCat.app')
    const executable = path.join(app, 'Contents/MacOS/TorrentCat')
    const info = plist.parse(fs.readFileSync(path.join(app, 'Contents/Info.plist'), 'utf8'))
    assert.strictEqual(info.CFBundleDisplayName, 'TorrentCat')
    assert.strictEqual(info.CFBundleExecutable, 'TorrentCat')
    assert.strictEqual(info.CFBundleIdentifier, 'io.webtorrent.webtorrent')
    assert(fs.existsSync(executable))
    const archive = path.join(app, 'Contents/Resources/app.asar')
    for (const name of ['LICENSE', 'AUTHORS.md']) {
      assert.deepStrictEqual(extractFile(archive, name), fs.readFileSync(path.join(__dirname, '..', name)))
    }
    const base = path.join(directory, 'TorrentCat-test')
    packageMac(app, base)
    const entries = execFileSync('unzip', ['-Z1', base + '.zip'], { encoding: 'utf8' })
    assert(entries.includes('TorrentCat.app/Contents/MacOS/TorrentCat'))
    const mount = path.join(directory, 'mounted')
    fs.mkdirSync(mount)
    execFileSync('hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, base + '.dmg'], { stdio: 'pipe' })
    try {
      assert(fs.existsSync(path.join(mount, 'TorrentCat.app/Contents/MacOS/TorrentCat')))
      assert.strictEqual(fs.readlinkSync(path.join(mount, 'Applications')), '/Applications')
    } finally { execFileSync('hdiutil', ['detach', mount], { stdio: 'pipe' }) }
    console.log('Packaging checks passed: TorrentCat app/executable, stable bundle ID, original credits, ZIP and mounted DMG')
    execFileSync(process.execPath, [path.join(__dirname, 'integration.js')], {
      env: { ...process.env, WEBTORRENT_PACKAGED_APP: executable },
      stdio: 'inherit',
      timeout: 180000
    })
  } finally { fs.rmSync(directory, { recursive: true, force: true }) }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
