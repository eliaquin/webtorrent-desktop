const path = require('path')

// Set these before crash reporting, Chromium sessions and the single-instance lock.
// The visible name must not relocate either the Electron or application profile.
module.exports = function configureIdentity (app, config) {
  const userData = config.IS_PORTABLE || process.env.WEBTORRENT_CONFIG_PATH
    ? config.CONFIG_PATH
    : path.join(app.getPath('appData'), config.LEGACY_APP_NAME)
  app.setName(config.APP_NAME)
  app.setPath('userData', userData)
  app.setPath('sessionData', userData)
  if (config.IS_PORTABLE) app.setPath('temp', path.join(config.CONFIG_PATH, 'Temp'))
}
