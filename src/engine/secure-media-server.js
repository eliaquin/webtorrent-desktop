const crypto = require('crypto')

// Keep LAN casting, but do not expose every file to browsers or network scans.
function secureMediaServer (server, networkAddress) {
  const token = crypto.randomBytes(32).toString('hex')
  const prefix = '/' + token
  const handlers = server.listeners('request')
  server.removeAllListeners('request')
  server.on('request', (req, res) => {
    const port = server.address().port
    const hosts = ['localhost', '127.0.0.1', networkAddress].map(host => host + ':' + port)
    const origin = req.headers.origin
    const origins = ['null', 'https://www.gstatic.com', 'https://cast.google.com']
    if (!hosts.includes(req.headers.host) || !req.url.startsWith(prefix + '/') ||
        (origin && !origins.includes(origin))) {
      res.writeHead(403)
      res.end()
      return
    }
    req.url = req.url.slice(prefix.length)
    for (const handler of handlers) handler.call(server, req, res)
  })
  return prefix
}

module.exports = secureMediaServer
