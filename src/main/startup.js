const { app } = require('electron')
const fs = require('fs/promises')
const { existsSync } = require('fs')
const path = require('path')
const os = require('os')
const config = require('../config')

function desktopQuote (value) {
  if (/[\r\n]/.test(value)) throw new Error('Invalid desktop launch path')
  return '"' + value.replace(/[\\"`$]/g, '\\$&') + '"'
}

async function setEnabled (enabled) {
  if (process.platform === 'darwin' || process.platform === 'win32') {
    const options = { openAtLogin: enabled, args: ['--hidden'] }
    if (process.platform === 'win32') {
      options.name = config.APP_NAME
      const updater = path.resolve(path.dirname(process.execPath), '..', 'Update.exe')
      if (config.IS_PRODUCTION && existsSync(updater)) {
        options.path = updater
        options.args = ['--processStart', path.basename(process.execPath), '--process-start-args', '--hidden']
      }
    }
    app.setLoginItemSettings(options)
    return
  }
  const folder = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'autostart')
  const filename = path.join(folder, config.APP_NAME + '.desktop')
  const legacy = path.join(os.homedir(), '.config', 'autostart', config.APP_NAME + '.desktop')
  if (legacy !== filename) await fs.rm(legacy, { force: true })
  if (!enabled) { await fs.rm(filename, { force: true }); return }
  const args = [app.getPath('exe'), ...(config.IS_PRODUCTION ? [] : [config.ROOT_PATH]), '--hidden']
  await fs.mkdir(folder, { recursive: true, mode: 0o700 })
  await fs.writeFile(filename, '[Desktop Entry]\nType=Application\nName=WebTorrent\nExec=' + args.map(desktopQuote).join(' ') + '\nTerminal=false\n', { mode: 0o600 })
}

module.exports = { install: () => setEnabled(true), uninstall: () => setEnabled(false) }
