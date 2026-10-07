const windows = require('./windows')
const config = require('../config')

module.exports = function trustedSender (event) {
  const allowed = [windows.main.win, windows.about.win].filter(Boolean)
  const frame = event.senderFrame
  return allowed.some(win => win.webContents === event.sender) && frame && !frame.parent &&
    [config.WINDOW_MAIN, config.WINDOW_ABOUT].map(url => new URL(url).href).includes(frame.url)
}
