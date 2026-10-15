const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { metadata, verifyFiles } = require('../bin/release-automation')
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
    const name = `WebTorrent-v0.27.3-darwin-arm64.${extension}`
    fs.writeFileSync(path.join(directory, name), extension)
    sums.push(crypto.createHash('sha256').update(extension).digest('hex') + '  ' + name)
  }
  fs.writeFileSync(path.join(directory, 'WebTorrent-v0.27.3-SHA256SUMS.txt'), sums.join('\n') + '\n')
  assert.strictEqual(verifyFiles(directory, '0.27.3', 'arm64').length, 2)
  assert.throws(() => verifyFiles(directory, '0.27.3', 'x64'), /ENOENT/)
  fs.appendFileSync(path.join(directory, 'WebTorrent-v0.27.3-darwin-arm64.dmg'), 'tampered')
  assert.throws(() => verifyFiles(directory, '0.27.3', 'arm64'), /checksum mismatch/)
  console.log('Release checks passed: recovery metadata, architecture matching and artifact checksum integrity')
} finally { fs.rmSync(directory, { recursive: true, force: true }) }
