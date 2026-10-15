const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { signingOptions, signAndNotarize } = require('../bin/macos-signing')

async function main () {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'webtorrent-signing-test-'))
  const app = path.join(directory, 'TorrentCat.app')
  const env = { APPLE_SIGNING_IDENTITY: 'Developer ID Application: Example (TESTTEAM)', APPLE_NOTARY_PROFILE: 'ci', APPLE_KEYCHAIN: '/tmp/test.keychain-db' }
  try {
    assert.throws(() => signingOptions(app, {}), /Developer ID/)
    assert.throws(() => signingOptions(app, { ...env, APPLE_SIGNING_IDENTITY: '-' }), /Developer ID/)
    assert.throws(() => signingOptions(app, { ...env, APPLE_NOTARY_PROFILE: '' }), /NOTARY_PROFILE/)
    const module = path.join(app, 'Contents/Resources/app.asar.unpacked/build/native/vlc-arm64.node')
    fs.mkdirSync(path.dirname(module), { recursive: true })
    fs.writeFileSync(module, '')
    const options = signingOptions(app, env)
    assert.strictEqual(options.sign.keychain, env.APPLE_KEYCHAIN)
    assert.strictEqual(options.notarize.keychain, env.APPLE_KEYCHAIN)
    assert(options.sign.optionsForFile(app).hardenedRuntime)
    assert(options.sign.optionsForFile(app).entitlements.endsWith('darwin-native-player-entitlements.plist'))
    assert(options.sign.optionsForFile(path.join(app, 'Contents/Frameworks/TorrentCat Helper.app')).entitlements.endsWith('/darwin-entitlements.plist'))
    assert(options.sign.optionsForFile(path.join(app, 'Contents/MacOS/TorrentCat')).entitlements.endsWith('darwin-native-player-entitlements.plist'))
    const steps = []
    const dependencies = {
      env,
      sign: async () => { steps.push('sign') },
      notarize: async () => { steps.push('notarize') },
      run: (command, args) => { steps.push([command, ...args].join(' ')) }
    }
    await signAndNotarize(app, dependencies)
    assert.deepStrictEqual(steps.slice(0, 2), ['sign', 'notarize'])
    assert(steps[2].startsWith('codesign --verify --deep --strict'))
    assert(steps[3].startsWith('xcrun stapler validate'))
    assert(steps[4].startsWith('spctl --assess'))
    for (const failure of ['sign', 'notarize', 'run']) {
      await assert.rejects(signAndNotarize(app, { ...dependencies, [failure]: () => { throw new Error(failure + ' failed') } }), new RegExp(failure + ' failed'))
    }
    console.log('Mac signing checks passed: credentials, helper isolation, verification order and failure propagation')
  } finally { fs.rmSync(directory, { recursive: true, force: true }) }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
