const { execFileSync } = require('child_process')

// The workflow validates main, increments its patch version and publishes only
// after both signed Mac builds pass notarization and Gatekeeper verification.
execFileSync('gh', ['workflow', 'run', 'release-version.yml', '--repo', 'eliaquin/webtorrent-desktop', '--ref', 'main'], { stdio: 'inherit' })
