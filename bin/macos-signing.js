const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function signingOptions (appPath, env = process.env) {
  if (!env.APPLE_SIGNING_IDENTITY?.startsWith('Developer ID Application: ') || !env.APPLE_NOTARY_PROFILE) {
    throw new Error('--sign requires a Developer ID Application identity and APPLE_NOTARY_PROFILE')
  }
  const hasNativePlayer = ['arm64', 'x64'].some(arch => fs.existsSync(path.join(appPath, 'Contents/Resources/app.asar.unpacked/build/native', `vlc-${arch}.node`)))
  const sign = {
    app: appPath,
    platform: 'darwin',
    identity: env.APPLE_SIGNING_IDENTITY,
    keychain: env.APPLE_KEYCHAIN,
    preAutoEntitlements: false,
    preEmbedProvisioningProfile: false,
    // Gatekeeper is assessed after notarization, not before it.
    gatekeeperAssess: false,
    optionsForFile: filePath => ({
      hardenedRuntime: true,
      entitlements: path.join(__dirname, hasNativePlayer &&
        [appPath, path.join(appPath, 'Contents/MacOS/WebTorrent')].includes(filePath)
        ? 'darwin-native-player-entitlements.plist'
        : 'darwin-entitlements.plist')
    })
  }
  const notarize = { appPath, keychainProfile: env.APPLE_NOTARY_PROFILE, keychain: env.APPLE_KEYCHAIN }
  return { sign, notarize }
}

async function signAndNotarize (appPath, {
  env = process.env,
  sign = options => require('@electron/osx-sign').sign(options),
  notarize = options => require('@electron/notarize').notarize(options),
  run = execFileSync
} = {}) {
  const options = signingOptions(appPath, env)
  console.log('Mac: Signing with Developer ID...')
  await sign(options.sign)
  console.log('Mac: Notarizing and stapling the app...')
  await notarize(options.notarize)
  run('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'inherit' })
  run('xcrun', ['stapler', 'validate', appPath], { stdio: 'inherit' })
  run('spctl', ['--assess', '--type', 'execute', '--verbose', appPath], { stdio: 'inherit' })
  console.log('Mac: Signed app passed notarization, stapling and Gatekeeper verification.')
}

module.exports = { signingOptions, signAndNotarize }
