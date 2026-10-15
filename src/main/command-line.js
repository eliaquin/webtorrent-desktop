const path = require('path')

function sliceArgv (argv, { isPackaged, appPath }) {
  if (isPackaged) return argv.slice(1)
  // Electron/Playwright can prepend different debugging or sandbox switches.
  // Locate the application entry instead of assuming a fixed number of flags.
  const entry = argv.findIndex((arg, index) => index > 0 && !arg.startsWith('-') && path.resolve(arg) === path.resolve(appPath))
  return entry === -1 ? [] : argv.slice(entry + 1)
}

module.exports = { sliceArgv }
