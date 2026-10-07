/* Generic errors */

class CastingError extends Error {}
class PlaybackError extends Error {}
class SoundError extends Error {}
class TorrentError extends Error {}

/* Playback */

class UnplayableTorrentError extends PlaybackError {
  constructor () { super('Can\'t play any files in torrent') }
}

class UnplayableFileError extends PlaybackError {
  constructor () { super('Can\'t play that file') }
}

/* Sound */

class InvalidSoundNameError extends SoundError {
  constructor (name) { super(`Invalid sound name: ${name}`) }
}

/* Torrent */

class TorrentKeyNotFoundError extends TorrentError {
  constructor (torrentKey) { super(`Can't resolve torrent key ${torrentKey}`) }
}

module.exports = {
  CastingError,
  PlaybackError,
  SoundError,
  TorrentError,
  UnplayableTorrentError,
  UnplayableFileError,
  InvalidSoundNameError,
  TorrentKeyNotFoundError
}
