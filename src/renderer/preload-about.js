window.addEventListener('DOMContentLoaded', () => {
  const config = require('../config')
  document.querySelector('#app-version').textContent = config.APP_VERSION
  document.querySelector('#torrent-version').textContent = require('webtorrent/package.json').version
  document.querySelector('#app-arch').textContent = process.arch
  document.querySelector('#app-copyright').textContent = config.APP_COPYRIGHT
}, { once: true })
