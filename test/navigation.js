const assert = require('assert')
const Navigation = require('../src/shared/navigation')

const navigate = (history, method, ...args) => new Promise((resolve, reject) => {
  history[method](...args, err => err ? reject(err) : resolve())
})

async function main () {
  const history = new Navigation()
  const events = []
  const page = url => ({ url, setup: cb => { events.push('load ' + url); cb() }, destroy: () => { events.push('unload ' + url) } })
  const home = page('home')
  const player = page('player')
  const preferences = page('preferences')
  assert.strictEqual(history.url(), null)
  assert.throws(() => history.go({}), /url/)
  await navigate(history, 'go', home)
  await navigate(history, 'go', player)
  assert.deepStrictEqual(events, ['load home', 'load player', 'unload home'])
  await navigate(history, 'go', preferences)
  await navigate(history, 'back')
  assert.strictEqual(history.current(), player)
  assert(history.hasForward())
  await navigate(history, 'forward')
  assert.strictEqual(history.current(), preferences)
  await navigate(history, 'cancel')
  assert.strictEqual(history.current(), player)
  assert(!history.hasForward(), 'cancelled screens cannot be reopened with forward')

  // Failed loads must leave both stacks usable, including back and forward.
  home.setup = cb => cb(new Error('home unavailable'))
  await assert.rejects(navigate(history, 'back'), /home unavailable/)
  assert.strictEqual(history.current(), player)
  assert(history.hasBack())
  home.setup = cb => cb()
  await navigate(history, 'back')
  player.setup = cb => cb(new Error('player unavailable'))
  await assert.rejects(navigate(history, 'forward'), /player unavailable/)
  assert.strictEqual(history.current(), home)
  assert(history.hasForward())
  await assert.rejects(navigate(history, 'go', { url: 'broken', setup: () => { throw new Error('setup failed') } }), /setup failed/)
  assert(history.hasForward(), 'a failed new route preserves forward history')

  let finishLoad
  let callbacks = 0
  history.go({ url: 'loading', setup: cb => { finishLoad = cb } }, () => { callbacks++ })
  await navigate(history, 'backToFirst')
  await navigate(history, 'go', preferences)
  assert.strictEqual(history.current(), home, 'navigation during setup is ignored')
  finishLoad()
  finishLoad()
  assert.strictEqual(callbacks, 1, 'a duplicate setup callback cannot commit twice')
  assert(!history.hasForward(), 'a successful new route clears forward history')

  let finishCleanup
  const loading = history.current()
  loading.setup = cb => cb()
  loading.destroy = () => new Promise(resolve => { finishCleanup = resolve })
  const transition = navigate(history, 'go', preferences)
  await navigate(history, 'go', player)
  assert.strictEqual(history.current(), preferences, 'navigation during cleanup is ignored')
  finishCleanup()
  await transition
  loading.destroy = () => {}
  await navigate(history, 'backToFirst')
  assert.strictEqual(history.current(), home)
  history.clearForward('preferences')
  await navigate(history, 'forward')
  assert.strictEqual(history.url(), 'loading')
  assert(!history.hasForward())
  history.current().destroy = () => { throw new Error('cleanup failed') }
  await assert.rejects(navigate(history, 'go', preferences), /cleanup failed/)
  await navigate(history, 'go', home)
  assert.strictEqual(history.current(), home, 'cleanup errors do not leave navigation locked')
  console.log('Navigation checks passed: history, cancellation, hook order, failed loads, pending navigation and cleanup')
}

const timeout = setTimeout(() => { console.error('Navigation test did not complete'); process.exitCode = 1 }, 10000)
main().catch(err => { console.error(err); process.exitCode = 1 }).finally(() => clearTimeout(timeout))
