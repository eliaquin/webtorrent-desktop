const infoHash = /^(?:[a-f\d]{40}|[a-z2-7]{32})$/i

function normalizeTorrentAddress (value) {
  const address = value.trim()
  const instant = /^(?:https?:\/\/)?instant\.io\/#(.+)$/i.exec(address)
  return instant ? instant[1] : address
}

function getTorrentAddressError (value) {
  const address = normalizeTorrentAddress(value)
  if (!address) return 'Enter a torrent address or magnet link.'
  if (infoHash.test(address) || /^(?:\/|[a-z]:[\\/]|\\\\).+\.torrent$/i.test(address)) return ''
  try {
    const url = new URL(address)
    if (['https:', 'http:'].includes(url.protocol) && url.hostname) return ''
    if (['magnet:', 'stream-magnet:'].includes(url.protocol) &&
        url.searchParams.getAll('xt').some(topic => /^urn:btih:/i.test(topic) && infoHash.test(topic.slice(9)))) return ''
  } catch (_) {}
  return 'Enter a valid magnet link, torrent URL, or info hash.'
}

module.exports = { normalizeTorrentAddress, getTorrentAddressError }
