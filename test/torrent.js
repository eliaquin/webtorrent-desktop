const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

async function main () {
  const WebTorrent = (await import('webtorrent')).default
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'webtorrent-peers-'))
  const options = { dht: false, tracker: false, lsd: false, natUpnp: false, natPmp: false, webSeeds: false, utp: false }
  const seeder = new WebTorrent(options)
  const downloader = new WebTorrent(options)
  const errors = []
  seeder.on('error', error => errors.push(error))
  downloader.on('error', error => errors.push(error))
  async function until (condition) {
    const deadline = Date.now() + 20000
    while (!condition()) {
      if (errors.length) throw errors[0]
      if (Date.now() > deadline) throw new Error('Local peer transfer timed out')
      await new Promise(resolve => setTimeout(resolve, 25))
    }
  }
  try {
    const first = Buffer.from('Selected local file')
    first.name = 'one.txt'
    const second = Buffer.alloc(1024 * 1024, 42)
    second.name = 'two.bin'
    const seed = await new Promise(resolve => seeder.seed([first, second], { name: 'LocalFixture', path: path.join(directory, 'seed'), announce: [] }, resolve))
    await until(() => seeder.listening)
    const torrent = downloader.add(seed.torrentFile, { path: path.join(directory, 'download'), deselect: true })
    await until(() => torrent.ready)
    const selected = torrent.files.find(file => file.name === 'one.txt')
    const skipped = torrent.files.find(file => file.name === 'two.bin')
    selected.select()
    assert(torrent.addPeer('127.0.0.1:' + seeder.torrentPort))
    await until(() => selected.done)
    assert.deepStrictEqual(Buffer.from(await selected.arrayBuffer()), Buffer.from(first))
    assert(!skipped.done, 'deselected files do not download to completion')
    skipped.select()
    await until(() => torrent.done)
    assert.deepStrictEqual(Buffer.from(await skipped.arrayBuffer()), Buffer.from(second))
    assert(torrent.received > 0, 'data was transferred from the local peer')
    const downloaded = torrent.downloaded
    await new Promise(resolve => torrent.destroy(resolve))
    const resumed = downloader.add(seed.torrentFile, { path: path.join(directory, 'download') })
    await until(() => resumed.ready && resumed.done)
    assert.strictEqual(resumed.downloaded, downloaded)
    assert.strictEqual(resumed.received, 0, 'resume verifies the existing files without redownloading')
    assert.deepStrictEqual(Buffer.from(await resumed.files.find(file => file.name === 'two.bin').arrayBuffer()), Buffer.from(second))
    console.log('Torrent tests passed: local TCP transfer, file selection, content integrity and verified resume')
  } finally {
    for (const client of [downloader, seeder]) {
      if (!client.destroyed) await new Promise(resolve => client.destroy(resolve))
    }
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
