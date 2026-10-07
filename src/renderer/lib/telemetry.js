// Local diagnostics only. Personal builds do not send usage data upstream.
module.exports = { init, logUncaughtError, logPlayAttempt }

let diagnostics

function init (state) {
  diagnostics = state.diagnostics = { errors: [], playback: [] }
  delete state.saved.telemetry
}

function logUncaughtError (source, error) {
  const message = (error && (error.message || (error.error && error.error.message))) || String(error)
  console.error(source + ':', message)
  if (!diagnostics) return
  diagnostics.errors.push({ source, message, time: Date.now() })
  diagnostics.errors = diagnostics.errors.slice(-50)
}

function logPlayAttempt (result) {
  if (!diagnostics) return
  diagnostics.playback.push({ result, time: Date.now() })
  diagnostics.playback = diagnostics.playback.slice(-50)
}
