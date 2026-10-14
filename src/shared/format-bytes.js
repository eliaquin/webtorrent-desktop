const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

module.exports = function formatBytes (bytes) {
  if (!Number.isFinite(bytes)) throw new TypeError('Expected a finite byte count')
  const magnitude = Math.abs(bytes)
  if (magnitude < 1) return bytes + ' B'
  const exponent = Math.min(Math.floor(Math.log10(magnitude) / 3), units.length - 1)
  const value = bytes / (1000 ** exponent)
  const decimals = Math.abs(value) < 10 && !Number.isInteger(value) ? 1 : 0
  return value.toFixed(decimals) + ' ' + units[exponent]
}
