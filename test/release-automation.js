const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { metadata, verifyFiles, releaseAliases } = require('../bin/release-automation')
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'webtorrent-release-test-'))
try {
  const data = { version: '0.27.3', sha: 'a'.repeat(40), runId: '12345' }
  assert.deepStrictEqual(metadata({ body: `Notes\n<!-- webtorrent-release ${JSON.stringify(data)} -->\n` }), data)
  assert.strictEqual(metadata({ body: 'Unrelated draft' }), null)
  for (const change of [{ version: '../other' }, { sha: 'main' }, { runId: '123\ncommand' }]) {
    assert.throws(() => metadata({ body: `<!-- webtorrent-release ${JSON.stringify({ ...data, ...change })} -->` }), /Invalid release metadata/)
  }
  const sums = []
  for (const extension of ['dmg', 'zip']) {
    const name = `TorrentCat-v0.27.3-darwin-arm64.${extension}`
    fs.writeFileSync(path.join(directory, name), extension)
    sums.push(crypto.createHash('sha256').update(extension).digest('hex') + '  ' + name)
  }
  fs.writeFileSync(path.join(directory, 'TorrentCat-v0.27.3-SHA256SUMS.txt'), sums.join('\n') + '\n')
  const files = verifyFiles(directory, '0.27.3', 'arm64')
  assert.strictEqual(files.length, 2)
  const aliases = releaseAliases(directory, files, '0.27.3', 'arm64')
  assert.deepStrictEqual(aliases.map(file => file.name).sort(), [
    'TorrentCat-mac-arm64.dmg', 'WebTorrent-mac-arm64.dmg',
    'WebTorrent-v0.27.3-darwin-arm64.dmg', 'WebTorrent-v0.27.3-darwin-arm64.zip'
  ])
  for (const alias of aliases) assert.strictEqual(crypto.createHash('sha256').update(fs.readFileSync(alias.file)).digest('hex'), alias.hash)
  const legacySums = aliases.filter(file => file.name.startsWith('WebTorrent-v')).map(({ hash, name }) => `${hash}  ${name}`).join('\n')
  fs.writeFileSync(path.join(directory, 'WebTorrent-v0.27.3-SHA256SUMS.txt'), legacySums)
  const oldRelease = path.join(directory, 'old-release')
  fs.mkdirSync(oldRelease)
  for (const name of ['WebTorrent-v0.27.3-SHA256SUMS.txt', 'WebTorrent-v0.27.3-darwin-arm64.dmg', 'WebTorrent-v0.27.3-darwin-arm64.zip']) {
    fs.copyFileSync(path.join(directory, name), path.join(oldRelease, name))
  }
  assert.strictEqual(verifyFiles(oldRelease, '0.27.3', 'arm64').length, 2)
  assert.throws(() => verifyFiles(directory, '0.27.3', 'x64'), /ENOENT/)
  fs.appendFileSync(path.join(directory, 'TorrentCat-v0.27.3-darwin-arm64.dmg'), 'tampered')
  assert.throws(() => verifyFiles(directory, '0.27.3', 'arm64'), /checksum mismatch/)
  console.log('Release checks passed: recovery metadata, architecture matching and artifact checksum integrity')
} finally { fs.rmSync(directory, { recursive: true, force: true }) }
