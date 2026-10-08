const { ipcMain, clipboard, dialog, Menu } = require('electron')
const fs = require('fs/promises')
const path = require('path')
const config = require('../config')
const windows = require('./windows')
const trustedSender = require('./ipc-sender')

function init () {
  const handle = (name, action) => ipcMain.handle(name, (event, ...args) => {
    if (!trustedSender(event)) throw new Error('Unauthorized application request')
    return action(...args)
  })
  ipcMain.on('native:window-state', event => {
    if (!trustedSender(event)) { event.returnValue = null; return }
    const win = windows.main.win
    event.returnValue = { isVisible: win.isVisible(), isMaximized: win.isMaximized() }
  })
  ipcMain.on('native:bootstrap', event => {
    event.returnValue = trustedSender(event)
      ? { config, platform: process.platform, architecture: process.arch, version: require('webtorrent/package.json').version }
      : null
  })
  handle('native:open-external', url => {
    const target = new URL(url)
    if (!['https:', 'http:'].includes(target.protocol)) throw new Error('Unsupported external URL')
    return require('electron').shell.openExternal(target.href)
  })
  ipcMain.on('native:clipboard-read', event => { event.returnValue = trustedSender(event) ? clipboard.readText() : '' })
  ipcMain.on('native:clipboard-write', (event, text) => {
    if (trustedSender(event) && typeof text === 'string') clipboard.writeText(text)
  })
  handle('native:load-state', async () => (await require('./state').load()).saved)
  handle('native:save-state', saved => require('./state').saveImmediate({ saved }))
  handle('native:stat-path', async filepath => {
    const stat = await fs.stat(filepath)
    return { isDirectory: stat.isDirectory(), size: stat.size }
  })
  handle('native:files-for-seeding', async paths => {
    if (!Array.isArray(paths) || !paths.every(p => typeof p === 'string')) throw new Error('Invalid seed paths')
    const files = []
    const visited = new Set()
    async function walk (filepath) {
      const real = await fs.realpath(filepath)
      if (visited.has(real)) return
      visited.add(real)
      const stat = await fs.stat(real)
      if (stat.isDirectory()) {
        for (const name of await fs.readdir(real)) await walk(path.join(real, name))
      } else if (stat.isFile()) files.push({ path: real, name: path.basename(real), size: stat.size })
    }
    for (const filepath of paths) await walk(filepath)
    return files.sort((a, b) => a.path.localeCompare(b.path))
  })
  handle('native:remove-torrent-cache', async (torrent, poster) => {
    if (torrent) {
      if (!/^[a-f\d]{40}\.torrent$/i.test(torrent)) throw new Error('Invalid torrent cache name')
      await fs.rm(path.join(config.TORRENT_PATH, torrent), { force: true })
    }
    if (poster) {
      if (!/^[a-f\d]{40}\.(jpg|png|gif)$/i.test(poster)) throw new Error('Invalid poster cache name')
      await fs.rm(path.join(config.POSTER_PATH, poster), { force: true })
    }
  })
  handle('native:read-subtitle', filepath => require('./torrent-service').subtitleTask('text', filepath))
  handle('native:extract-embedded-subtitles', filepath => require('./torrent-service').subtitleTask('embedded', filepath))
  handle('native:subtitle-tools-available', () => {
    const { findTool } = require('../engine/embedded-subtitles')
    return !!(findTool('ffmpeg') && findTool('ffprobe'))
  })
  handle('native:choose-path', async options => {
    const { filePaths } = await dialog.showOpenDialog(windows.main.win, options)
    return filePaths
  })
  handle('native:choose-subtitles', async () => {
    const { filePaths } = await dialog.showOpenDialog(windows.main.win, {
      title: 'Select a subtitles file.', filters: [{ name: 'Subtitles', extensions: ['vtt', 'srt'] }], properties: ['openFile']
    })
    return filePaths
  })
  handle('native:save-torrent-as', async (filename, options) => {
    if (typeof filename !== 'string' || !/^[a-f\d]{40}\.torrent$/i.test(filename)) throw new Error('Invalid cached torrent')
    const { filePath } = await dialog.showSaveDialog(windows.main.win, options)
    if (filePath) await fs.copyFile(path.join(config.TORRENT_PATH, filename), filePath)
    return filePath
  })
  ipcMain.on('native:torrent-menu', (event, summary) => {
    if (!trustedSender(event)) return
    const dispatch = (...args) => windows.main.dispatch(...args)
    const template = [
      { label: 'Remove From List', click: () => dispatch('confirmDeleteTorrent', summary.infoHash, false) },
      { label: 'Remove Data File', click: () => dispatch('confirmDeleteTorrent', summary.infoHash, true) },
      { type: 'separator' },
      { label: process.platform === 'darwin' ? 'Show in Finder' : 'Show in Folder', enabled: !!summary.dataPath, click: () => require('./shell').showItemInFolder(summary.dataPath) },
      { type: 'separator' },
      { label: 'Copy Magnet Link to Clipboard', click: () => clipboard.writeText(summary.magnetURI || '') },
      { label: 'Copy Instant.io Link to Clipboard', click: () => clipboard.writeText('https://instant.io/#' + summary.infoHash) },
      { label: 'Save Torrent File As...', enabled: !!summary.torrentFileName, click: () => dispatch('saveTorrentFileAs', summary.torrentKey) },
      { type: 'separator' },
      { label: 'Sort by Name', type: 'checkbox', checked: !!summary.sortByName, click: () => dispatch('updatePreferences', 'sortByName', !summary.sortByName) }
    ]
    Menu.buildFromTemplate(template).popup({ window: windows.main.win })
  })
}

module.exports = { init }
