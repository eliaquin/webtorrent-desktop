const cp = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const REPOSITORY = 'eliaquin/webtorrent-desktop'
const MARKER = /<!-- webtorrent-release (.+) -->/

function metadata (release) {
  const match = release.body?.match(MARKER)
  if (!match) return null
  const data = JSON.parse(match[1])
  if (!/^\d+\.\d+\.\d+$/.test(data.version) || !/^[a-f0-9]{40}$/.test(data.sha) || !/^\d+$/.test(data.runId)) throw new Error('Invalid release metadata')
  return data
}
const run = (command, args, options = {}) => cp.execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim()
const gh = args => run('gh', args)
const api = endpoint => JSON.parse(gh(['api', `repos/${REPOSITORY}/${endpoint}`]))
const output = values => {
  for (const [name, value] of Object.entries(values)) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`)
}
const summary = text => fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n')

function bump () {
  run('git', ['config', 'user.name', 'github-actions[bot]'])
  run('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'])
  run('git', ['fetch', 'origin', 'main'])
  if (run('git', ['rev-parse', 'HEAD']) !== run('git', ['rev-parse', 'origin/main'])) {
    summary('A newer main commit superseded this build. Its release workflow will handle the next version.')
    return
  }
  run('npm', ['version', 'patch', '--no-git-tag-version', '--ignore-scripts'])
  const version = JSON.parse(fs.readFileSync('package.json')).version
  run('git', ['add', 'package.json', 'package-lock.json'])
  run('git', ['commit', '-m', `chore: release v${version}`])
  run('git', ['push', 'origin', 'HEAD:main'])
  // GITHUB_TOKEN pushes don't trigger push workflows; dispatch the build explicitly.
  gh(['workflow', 'run', 'release.yml', '--repo', REPOSITORY, '--ref', 'main'])
  summary(`Started the signed release build for **v${version}**.`)
}

function prepare () {
  const releases = api('releases?per_page=100')
  let release
  if (process.env.GITHUB_EVENT_NAME === 'schedule') {
    // Resume one pending release per scheduled run, starting with the oldest.
    for (const candidate of releases.filter(release => release.draft && metadata(release)).reverse()) {
      const data = metadata(candidate)
      const previous = api(`actions/runs/${data.runId}`)
      const artifacts = api(`actions/runs/${data.runId}/artifacts`).artifacts
      if (previous.status === 'completed' && ['arm64', 'x64'].every(arch =>
        artifacts.some(a => a.name === `macos-${arch}-notarization-pending` && !a.expired))) {
        release = candidate
        break
      }
      summary(`Draft v${data.version} is not resumable yet; see build ${data.runId}.`)
    }
    if (!release) { output({ build: false }); return }
  } else {
    const version = JSON.parse(fs.readFileSync('package.json')).version
    release = releases.find(release => release.tag_name === `v${version}`)
    if (release && !release.draft) { output({ build: false }); return }
    if (!release) {
      const data = { version, sha: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID }
      const notes = path.join(process.env.RUNNER_TEMP, 'release-notes.md')
      fs.writeFileSync(notes, `Signed and notarized macOS installers for Apple Silicon and Intel. Download the DMG for your Mac and drag TorrentCat into Applications. Your downloads and preferences are preserved.\n\n<!-- webtorrent-release ${JSON.stringify(data)} -->\n`)
      gh(['release', 'create', `v${version}`, '--repo', REPOSITORY, '--target', data.sha, '--draft', '--title', `TorrentCat v${version}`, '--generate-notes', '--notes-file', notes])
      output({ build: true, source_ref: data.sha, version, resume_run_id: '' })
      return
    }
  }
  const data = metadata(release)
  if (!data) throw new Error('Existing draft was not created by the automated release workflow')
  const previous = api(`actions/runs/${data.runId}`)
  if (previous.status !== 'completed') { output({ build: false }); return }
  const artifacts = api(`actions/runs/${data.runId}/artifacts`).artifacts
  if (!['arm64', 'x64'].every(arch => artifacts.some(a => a.name === `macos-${arch}-notarization-pending` && !a.expired))) {
    throw new Error(`Release v${data.version} has no complete recovery artifacts. Fix and rerun its original build ${data.runId}.`)
  }
  output({ build: true, source_ref: data.sha, version: data.version, resume_run_id: data.runId })
}

function verifyFiles (directory, version, arch) {
  // Pending releases may have been built before the rename.
  const brand = fs.existsSync(path.join(directory, `TorrentCat-v${version}-SHA256SUMS.txt`)) ? 'TorrentCat' : 'WebTorrent'
  const prefix = `${brand}-v${version}-darwin-${arch}`
  const sums = fs.readFileSync(path.join(directory, `${brand}-v${version}-SHA256SUMS.txt`), 'utf8').trim().split('\n')
  return ['dmg', 'zip'].map(extension => {
    const name = `${prefix}.${extension}`
    const file = path.join(directory, name)
    const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    if (!sums.includes(`${hash}  ${name}`)) throw new Error('Release artifact checksum mismatch: ' + name)
    return { file, name, hash }
  })
}

function releaseAliases (directory, files, version, arch) {
  const aliases = []
  for (const source of files) {
    const extension = path.extname(source.name)
    const names = ['TorrentCat', 'WebTorrent'].flatMap(brand => [
      `${brand}-v${version}-darwin-${arch}${extension}`,
      ...(extension === '.dmg' ? [`${brand}-mac-${arch}.dmg`] : [])
    ])
    for (const name of names) {
      if (name === source.name) continue
      const file = path.join(directory, name)
      fs.copyFileSync(source.file, file)
      aliases.push({ file, name, hash: source.hash })
    }
  }
  return aliases
}

function publish () {
  const version = process.env.RELEASE_VERSION
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid release version')
  const release = JSON.parse(gh(['release', 'view', `v${version}`, '--repo', REPOSITORY, '--json', 'body,isDraft']))
  const data = metadata(release)
  if (!release.isDraft || data?.sha !== process.env.SOURCE_SHA || data.version !== version) throw new Error('Release source does not match the draft')
  const artifacts = api(`actions/runs/${process.env.GITHUB_RUN_ID}/artifacts`).artifacts
  if (!['arm64', 'x64'].every(arch => artifacts.some(a => a.name === `macos-${arch}-signed` && !a.expired))) {
    summary(`**v${version} is awaiting Apple approval.** Its draft remains private. This workflow will resume the saved submissions automatically every 30 minutes.`)
    return
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'webtorrent-release-'))
  try {
    const files = []
    for (const arch of ['arm64', 'x64']) {
      const destination = path.join(directory, arch)
      gh(['run', 'download', process.env.GITHUB_RUN_ID, '--repo', REPOSITORY, '--name', `macos-${arch}-signed`, '--dir', destination])
      const verified = verifyFiles(destination, version, arch)
      files.push(...verified, ...releaseAliases(directory, verified, version, arch))
    }
    const sums = path.join(directory, 'SHA256SUMS.txt')
    fs.writeFileSync(sums, files.map(({ hash, name }) => `${hash}  ${name}`).join('\n') + '\n')
    gh(['release', 'upload', `v${version}`, '--repo', REPOSITORY, '--clobber', ...files.map(({ file }) => file), sums])
    const published = api('releases?per_page=100').filter(r => !r.draft && !r.prerelease)
    const newerExists = published.some(r => {
      const parts = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(r.tag_name)
      if (!parts) return false
      const candidate = parts.slice(1).map(Number)
      const current = version.split('.').map(Number)
      const index = candidate.findIndex((value, i) => value !== current[i])
      return index !== -1 && candidate[index] > current[index]
    })
    gh(['release', 'edit', `v${version}`, '--repo', REPOSITORY, '--draft=false', `--latest=${!newerExists}`])
    summary(`Published [TorrentCat v${version}](https://github.com/${REPOSITORY}/releases/tag/v${version}). Both architectures are signed, notarized and verified.`)
  } finally { fs.rmSync(directory, { recursive: true, force: true }) }
}

if (require.main === module) {
  try {
    if (process.env.GITHUB_REPOSITORY !== REPOSITORY || process.env.GITHUB_REF !== 'refs/heads/main') throw new Error('Releases are restricted to this repository’s main branch')
    const commands = { bump, prepare, publish }
    const command = commands[process.argv[2]]
    if (!command) throw new Error('Expected bump, prepare or publish')
    command()
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
module.exports = { metadata, verifyFiles, releaseAliases }
