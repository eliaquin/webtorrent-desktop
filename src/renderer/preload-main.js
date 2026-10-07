const { contextBridge, ipcRenderer, webUtils } = require('electron')
const channels = require('../shared/ipc-channels')
const allowed = (list, channel) => list.includes(channel)
const bootstrap = ipcRenderer.sendSync('native:bootstrap')

contextBridge.exposeInMainWorld('webtorrent', {
  config: bootstrap.config,
  platform: bootstrap.platform,
  pathForFile: file => webUtils.getPathForFile(file),
  send (channel, ...args) {
    if (!allowed(channels.send, channel)) throw new Error('Unknown application command')
    ipcRenderer.send(channel, ...args)
  },
  invoke (channel, ...args) {
    if (!allowed(channels.invoke, channel)) throw new Error('Unknown application request')
    return ipcRenderer.invoke(channel, ...args)
  },
  read (channel) {
    if (!allowed(channels.sync, channel)) throw new Error('Unknown application value')
    return ipcRenderer.sendSync(channel)
  },
  subscribe (channel, listener) {
    if (!allowed(channels.receive, channel) && !/^wt-(ready|server)-[a-f\d]{40}$/i.test(channel)) throw new Error('Unknown application event')
    const handler = (event, ...args) => listener(...args)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
  openExternal: url => ipcRenderer.invoke('native:open-external', url)
})
