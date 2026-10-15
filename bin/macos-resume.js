const cp = require('child_process')
const fs = require('fs')

function validateRun (run, repository) {
  if (run.head_repository?.full_name !== repository || run.head_branch !== 'main' ||
      run.event !== 'workflow_dispatch' ||
      !['.github/workflows/macos.yml', '.github/workflows/package.yml', '.github/workflows/release.yml'].includes(run.path) ||
      !/^[a-f0-9]{40}$/i.test(run.head_sha)) {
    throw new Error('Only signed build artifacts from a manually requested main build in this repository can be resumed')
  }
  return run.head_sha
}

function main () {
  const { RESUME_RUN_ID: id, GITHUB_REPOSITORY: repository, GITHUB_ENV: githubEnv } = process.env
  const arch = process.argv[2]
  if (!/^[0-9]+$/.test(id) || !['arm64', 'x64'].includes(arch)) throw new Error('Invalid run ID or architecture')
  const run = JSON.parse(cp.execFileSync('gh', ['api', `repos/${repository}/actions/runs/${id}`], { encoding: 'utf8' }))
  const sha = validateRun(run, repository)
  cp.execFileSync('gh', ['run', 'download', id, '--repo', repository, '--name', `macos-${arch}-notarization-pending`, '--dir', `dist/notarization/${arch}`], { stdio: 'inherit' })
  fs.appendFileSync(githubEnv, `NOTARIZATION_SOURCE_SHA=${sha}\n`)
}

if (require.main === module) {
  try { main() } catch (error) { console.error(error); process.exitCode = 1 }
}

module.exports = { validateRun }
