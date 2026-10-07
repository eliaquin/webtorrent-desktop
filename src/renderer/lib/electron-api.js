// The browser renderer gets only the explicitly allowed application bridge.
const bridge = window.webtorrent
const subscriptions = new Map()
const copy = args => JSON.parse(JSON.stringify(args))

module.exports = {
  ipcRenderer: {
    send: (channel, ...args) => bridge.send(channel, ...copy(args)),
    invoke: (channel, ...args) => bridge.invoke(channel, ...copy(args)).then(value => structuredClone(value)),
    sendSync: channel => bridge.read(channel),
    on (channel, listener) {
      const dispose = bridge.subscribe(channel, (...args) => listener(null, ...structuredClone(args)))
      subscriptions.set(listener, dispose)
      return this
    },
    once (channel, listener) {
      const wrapper = (...args) => { this.removeListener(channel, wrapper); listener(...args) }
      return this.on(channel, wrapper)
    },
    removeListener (channel, listener) {
      const dispose = subscriptions.get(listener)
      if (dispose) dispose()
      subscriptions.delete(listener)
      return this
    }
  },
  shell: { openExternal: url => bridge.openExternal(url) }
}
