const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { submit, finish, validateSubmission } = require('../bin/macos-notarization')
const { validateRun } = require('../bin/macos-resume')

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'webtorrent-notary-test-'))
const arch = 'arm64'
const sourceSha = 'a'.repeat(40)
const id = 'e24247af-cf11-4f27-a995-46b5d4ea3e01'
const env = { APPLE_NOTARY_PROFILE: 'test', APPLE_KEYCHAIN: '/tmp/test.keychain-db' }
try {
  const appPath = path.join(directory, 'TorrentCat.app')
  fs.mkdirSync(appPath)
  fs.writeFileSync(path.join(appPath, 'example'), 'signed app fixture')
  const saved = path.join(directory, 'saved')
  submit(saved, {
    appPath,
    arch,
    version: '0.27.2',
    sourceSha,
    env,
    run: (command, args) => {
      assert.strictEqual(command, 'xcrun')
      assert.strictEqual(args[1], 'submit')
      assert(!args.includes('--wait'))
      assert(fs.existsSync(args[2]), 'App archive must exist before submission')
      return JSON.stringify({ id })
    }
  })
  assert.strictEqual(validateSubmission(saved, arch, sourceSha).id, id)
  assert.throws(() => submit(saved, {}), /already exists/)
  assert.throws(() => validateSubmission(saved, 'x64', sourceSha), /does not match/)
  assert.throws(() => validateSubmission(saved, arch, 'b'.repeat(40)), /does not match/)

  const events = []
  let statuses = []
  let waitError = false
  const options = {
    arch,
    sourceSha,
    env,
    outputDirectory: directory,
    run: (command, args) => {
      events.push([command, ...args].join(' '))
      if (args[1] === 'info') return JSON.stringify({ id, status: statuses.shift() })
      if (args[1] === 'wait' && waitError) throw new Error('Timed out')
      if (args[1] === 'log') return JSON.stringify({ status: 'Invalid', issues: ['invalid signature'] })
      return '{}'
    },
    verify: () => { events.push('verify') },
    packageApp: () => { events.push('package') }
  }
  statuses = ['In Progress', 'In Progress']
  waitError = true
  assert.deepStrictEqual(finish(saved, options), { ready: false, id, version: '0.27.2' })
  assert(!events.includes('package'))
  assert(!events.some(e => e.includes('stapler')))
  assert(events.some(e => e.includes('--timeout 5m')))

  events.length = 0
  statuses = ['Accepted']
  assert.deepStrictEqual(finish(saved, options), { ready: true, id, version: '0.27.2' })
  assert(!events.some(e => /notarytool (submit|wait)/.test(e)), 'Resume must not resubmit or wait on accepted apps')
  assert(events.findIndex(e => e.includes('stapler staple')) < events.indexOf('verify'))
  assert(events.indexOf('verify') < events.indexOf('package'))

  events.length = 0
  statuses = ['In Progress', 'Accepted']
  assert(finish(saved, options).ready, 'Acceptance at the wait timeout must still be honored')

  events.length = 0
  statuses = ['Invalid']
  assert.throws(() => finish(saved, options), /Apple notarization.*Invalid/)
  assert(fs.existsSync(path.join(saved, 'notarization-log.json')))
  assert(!events.includes('package'))

  statuses = ['Accepted']
  assert.throws(() => finish(saved, { ...options, verify: () => { throw new Error('Gatekeeper rejected') } }), /Gatekeeper rejected/)
  assert.throws(() => finish(saved, { ...options, run: () => { throw new Error('Authentication failed') } }), /Authentication failed/)

  fs.appendFileSync(path.join(saved, 'TorrentCat.zip'), 'tampering')
  assert.throws(() => validateSubmission(saved, arch, sourceSha), /does not match/)

  const repository = 'eliaquin/webtorrent-desktop'
  const run = { head_repository: { full_name: repository }, head_branch: 'main', event: 'workflow_dispatch', path: '.github/workflows/macos.yml', head_sha: sourceSha }
  assert.strictEqual(validateRun(run, repository), sourceSha)
  for (const change of [
    { head_repository: { full_name: 'someone/fork' } },
    { head_branch: 'feature/untrusted' },
    { event: 'pull_request' },
    { path: '.github/workflows/ci.yml' }
  ]) assert.throws(() => validateRun({ ...run, ...change }, repository), /Only signed build artifacts/)
  console.log('Mac notarization checks passed: saved submissions, pending/accepted/rejected results, verification failures and recovery provenance')
} finally {
  fs.rmSync(directory, { recursive: true, force: true })
}
