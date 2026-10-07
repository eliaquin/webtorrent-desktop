const assert = require('assert')
const { createStore } = require('../src/renderer/lib/store')

async function main () {
  const store = createStore({ saved: { prefs: { volume: 1 }, torrents: [{ progress: 0 }] }, playing: { currentTime: 0 }, diagnostics: {} })
  let preferenceUpdates = 0
  let torrentUpdates = 0
  const unsubscribe = store.subscribe(['saved.prefs'], () => preferenceUpdates++)
  store.subscribe(['saved.torrents'], () => torrentUpdates++)
  const preferenceVersion = store.version(['saved.prefs'])
  store.state.saved.torrents[0].progress = 0.5
  store.state.saved.torrents[0].progress = 0.7
  await Promise.resolve()
  assert.strictEqual(torrentUpdates, 1, 'one action batches multiple torrent changes')
  assert.strictEqual(preferenceUpdates, 0, 'torrent progress does not update preference subscribers')
  assert.strictEqual(store.version(['saved.prefs']), preferenceVersion)
  store.state.saved.prefs.volume = 0.5
  await Promise.resolve()
  assert.strictEqual(preferenceUpdates, 1)
  store.state.saved.prefs.volume = 0.5
  await Promise.resolve()
  assert.strictEqual(preferenceUpdates, 1, 'unchanged values do not notify')
  unsubscribe()
  store.state.saved.prefs.volume = 0.8
  await Promise.resolve()
  assert.strictEqual(preferenceUpdates, 1, 'unsubscription releases listeners')
  store.state.diagnostics.error = 'test'
  await Promise.resolve()
  assert.strictEqual(torrentUpdates, 1, 'diagnostics do not update the torrent view')
  console.log('Store tests passed: scoped updates, batching, unchanged values and cleanup')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
