const fs = require('fs')
const path = require('path')
const { createHash } = require('crypto')
const version = require('../package.json').version

async function main () {
  const prefix = 'WebTorrent-v' + version + '-'
  const files = fs.readdirSync('dist').filter(name => name.startsWith(prefix) && /\.(zip|dmg|exe|deb|rpm|nupkg)$/.test(name)).sort()
  if (!files.length) throw new Error('Build release artifacts before generating checksums')
  const entries = []
  for (const name of files) {
    const hash = createHash('sha256')
    for await (const chunk of fs.createReadStream(path.join('dist', name))) hash.update(chunk)
    entries.push(hash.digest('hex') + '  ' + name)
  }
  const output = path.join('dist', prefix + 'SHA256SUMS.txt')
  fs.writeFileSync(output, entries.join('\n') + '\n')
  console.log(output)
}

main().catch(error => { console.error(error.message); process.exitCode = 1 })
