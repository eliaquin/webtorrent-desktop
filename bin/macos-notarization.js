const cp = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')

function notary (args, { env = process.env, run = cp.execFileSync } = {}) {
  if (!env.APPLE_NOTARY_PROFILE) throw new Error('APPLE_NOTARY_PROFILE is required')
  const auth = ['--keychain-profile', env.APPLE_NOTARY_PROFILE]
  if (env.APPLE_KEYCHAIN) auth.push('--keychain', env.APPLE_KEYCHAIN)
  return run('xcrun', ['notarytool', ...args, ...auth, '--output-format', 'json'], {
    encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 8 * 60 * 1000
  })
}

function digest (file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function submit (directory, { appPath, arch, version, sourceSha, ...dependencies }) {
  const manifest = path.join(directory, 'submission.json')
  if (fs.existsSync(manifest)) throw new Error('Submission already exists; resume it instead')
  fs.mkdirSync(directory, { recursive: true })
  const archive = path.join(directory, 'TorrentCat.zip')
  require('./archive').zipSync(appPath, archive)
  // Submit without --wait so the app and its ID can be saved before Apple's queue.
  const result = JSON.parse(notary(['submit', archive], dependencies))
  if (!/^[a-f0-9-]{36}$/i.test(result.id)) throw new Error('Apple returned no valid submission ID')
  const state = { id: result.id, arch, version, sourceSha, sha256: digest(archive) }
  fs.writeFileSync(manifest, JSON.stringify(state, null, 2) + '\n')
  console.log(`Mac ${arch}: submitted to Apple as ${state.id}`)
  return state
}

function validateSubmission (directory, arch, sourceSha) {
  const state = JSON.parse(fs.readFileSync(path.join(directory, 'submission.json'), 'utf8'))
  if (!['arm64', 'x64'].includes(arch) || state.arch !== arch ||
      !/^[a-f0-9]{40}$/i.test(sourceSha) || state.sourceSha !== sourceSha ||
      !/^[a-f0-9-]{36}$/i.test(state.id) || !/^[0-9][a-z0-9.+-]*$/i.test(state.version) ||
      state.sha256 !== digest(path.join(directory, 'TorrentCat.zip'))) {
    throw new Error('Saved notarization artifact does not match its architecture, source or checksum')
  }
  return state
}

function finish (directory, {
  arch, sourceSha, outputDirectory,
  env = process.env, run = cp.execFileSync,
  verify = require('./macos-signing').verifyNotarizedApp,
  packageApp = require('./macos-package').packageMac
}) {
  const state = validateSubmission(directory, arch, sourceSha)
  const dependencies = { env, run }
  let result = JSON.parse(notary(['info', state.id], dependencies))
  if (result.status === 'In Progress') {
    console.log(`Mac ${arch}: waiting up to five minutes for Apple (${state.id})`)
    try { notary(['wait', state.id, '--timeout', '5m'], dependencies) } catch {
      // A wait timeout doesn't cancel Apple's submission. Check its actual status.
    }
    result = JSON.parse(notary(['info', state.id], dependencies))
  }
  if (result.status === 'In Progress') {
    console.log(`Mac ${arch}: still pending; saved submission ${state.id} can be resumed`)
    return { ready: false, id: state.id, version: state.version }
  }
  if (result.status !== 'Accepted') {
    const log = notary(['log', state.id], dependencies)
    fs.writeFileSync(path.join(directory, 'notarization-log.json'), log)
    console.error(log)
    throw new Error(`Apple notarization ${state.id}: ${result.status}`)
  }
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'webtorrent-notarized-'))
  try {
    run('ditto', ['-x', '-k', path.join(directory, 'TorrentCat.zip'), staging])
    const app = path.join(staging, 'TorrentCat.app')
    run('xcrun', ['stapler', 'staple', app], { stdio: 'inherit' })
    verify(app, run)
    packageApp(app, path.join(outputDirectory, `TorrentCat-v${state.version}-darwin-${arch}`))
    return { ready: true, id: state.id, version: state.version }
  } finally {
    fs.rmSync(staging, { recursive: true, force: true })
  }
}

function main () {
  const [command, arch] = process.argv.slice(2)
  if (!['arm64', 'x64'].includes(arch)) throw new Error('Expected arm64 or x64')
  const outputDirectory = path.resolve('dist')
  const directory = path.join(outputDirectory, 'notarization', arch)
  const sourceSha = process.env.NOTARIZATION_SOURCE_SHA || process.env.GITHUB_SHA
  if (command === 'submit') {
    submit(directory, {
      appPath: path.join(outputDirectory, `TorrentCat-darwin-${arch}`, 'TorrentCat.app'),
      arch,
      sourceSha,
      version: require('../package.json').version
    })
  } else if (command === 'finish') {
    const result = finish(directory, { arch, sourceSha, outputDirectory })
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `ready=${result.ready}\nversion=${result.version}\n`)
    if (process.env.GITHUB_STEP_SUMMARY) {
      const sourceRun = process.env.RESUME_RUN_ID || process.env.GITHUB_RUN_ID
      const status = result.ready
        ? 'Accepted, stapled and verified. Download the signed DMG/ZIP artifact.'
        : `Pending Apple approval. The saved artifact is NOT ready for installation. Run **Signed macOS builds** with **resume_run_id: ${sourceRun}** to check again without rebuilding or resubmitting.`
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### macOS ${arch}\n${status}\n\nSubmission: \`${result.id}\`\n`)
    }
  } else throw new Error('Expected submit or finish')
}

if (require.main === module) {
  try { main() } catch (error) { console.error(error); process.exitCode = 1 }
}

module.exports = { submit, finish, validateSubmission }
