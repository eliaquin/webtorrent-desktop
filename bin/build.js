const babel = require('@babel/core')
const fs = require('fs')
const path = require('path')

function build (directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const source = path.join(directory, entry.name)
    if (entry.isDirectory()) build(source)
    else if (entry.name.endsWith('.js')) {
      const target = path.join('build', path.relative('src', source))
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, babel.transformFileSync(source).code + '\n')
    }
  }
}

fs.rmSync('build', { recursive: true, force: true })
build('src')
console.log('Build complete')
