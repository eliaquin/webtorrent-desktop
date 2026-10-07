// All app windows display local documents. They must never become web browsers.
function secureWindow (win) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  for (const event of ['will-navigate', 'will-frame-navigate', 'will-redirect']) {
    win.webContents.on(event, e => e.preventDefault())
  }
  win.webContents.on('will-attach-webview', e => e.preventDefault())
  win.webContents.session.setPermissionRequestHandler((contents, permission, respond) => respond(false))
  win.webContents.session.setPermissionCheckHandler(() => false)
}

module.exports = secureWindow
