const { EventEmitter } = require('events')

const transport = module.exports = new EventEmitter()
transport.send = (name, ...args) => process.parentPort.postMessage({ name, args })

// Serialize commands so stop/start and file selection cannot race each other.
let commands = Promise.resolve()
process.parentPort.on('message', ({ data }) => {
  commands = commands.then(async () => {
    if (!data || typeof data.name !== 'string' || !Array.isArray(data.args)) return
    for (const listener of transport.listeners(data.name)) await listener(null, ...data.args)
  }).catch(error => transport.send('wt-error', null, error.message))
})
