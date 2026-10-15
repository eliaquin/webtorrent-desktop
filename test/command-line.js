const assert = require('assert')
const path = require('path')
const { sliceArgv } = require('../src/main/command-line')

const appPath = path.resolve('.')
const options = { isPackaged: false, appPath }
const magnet = 'magnet:?xt=urn:btih:test'
for (const switches of [[], ['--inspect=0', '--remote-debugging-port=0'], ['--inspect=0', '--remote-debugging-port=0', '--no-sandbox'], ['-r', '/tmp/mock.js']]) {
  for (const entry of ['.', appPath]) {
    assert.deepStrictEqual(sliceArgv(['electron', ...switches, entry, '--hidden', magnet], options), ['--hidden', magnet])
    assert.deepStrictEqual(sliceArgv(['electron', ...switches, entry], options), [])
  }
}
assert.deepStrictEqual(sliceArgv(['WebTorrent', '--hidden', magnet], { isPackaged: true, appPath }), ['--hidden', magnet])
assert.deepStrictEqual(sliceArgv(['electron', '--inspect=0'], options), [])
console.log('Command-line checks passed: development, packaged and varying test-runner flags')
