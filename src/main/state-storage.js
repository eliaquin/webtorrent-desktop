const fs = require('fs/promises')
const path = require('path')
const { randomUUID } = require('crypto')
const config = require('../config')
const filePath = path.join(config.CONFIG_PATH, 'config.json')
let writing = Promise.resolve()

async function read () {
  try { return JSON.parse(await fs.readFile(filePath, 'utf8')) } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw error
  }
}

function write (saved) {
  const json = JSON.stringify(saved, null, 2) + '\n'
  writing = writing.catch(() => {}).then(async () => {
    await fs.mkdir(config.CONFIG_PATH, { recursive: true, mode: 0o700 })
    const temporary = filePath + '.' + randomUUID() + '.tmp'
    try {
      await fs.writeFile(temporary, json, { mode: 0o600, flag: 'wx' })
      try { await fs.copyFile(filePath, filePath + '.bak') } catch (error) { if (error.code !== 'ENOENT') throw error }
      await fs.rename(temporary, filePath)
    } finally {
      await fs.rm(temporary, { force: true })
    }
  })
  return writing
}

module.exports = { read, write, filePath }
