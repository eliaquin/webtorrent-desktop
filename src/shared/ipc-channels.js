exports.send = [
  'ipcReady', 'stateSaved', 'openTorrentFile', 'openFiles', 'setBadge', 'downloadFinished',
  'onPlayerOpen', 'onPlayerUpdate', 'onPlayerClose', 'onPlayerPlay', 'onPlayerPause',
  'startFolderWatcher', 'stopFolderWatcher', 'openPath', 'showItemInFolder', 'moveItemToTrash',
  'setDefaultFileHandler', 'setStartup', 'setAspectRatio', 'setBounds', 'setProgress',
  'setTitle', 'show', 'toggleFullScreen', 'setAllowNav', 'checkForExternalPlayer',
  'openExternalPlayer', 'quitExternalPlayer', 'native:clipboard-write', 'native:torrent-menu',
  'wt-set-global-trackers', 'wt-start-torrenting', 'wt-stop-torrenting', 'wt-create-torrent',
  'wt-save-torrent-file', 'wt-generate-torrent-poster', 'wt-get-audio-metadata',
  'wt-start-server', 'wt-stop-server', 'wt-select-files', 'wt-cast-command'
]
exports.invoke = [
  'native:load-state', 'native:save-state', 'native:stat-path', 'native:files-for-seeding',
  'native:remove-torrent-cache', 'native:read-subtitle', 'native:extract-embedded-subtitles',
  'native:choose-path', 'native:choose-subtitles', 'native:save-torrent-as'
]
exports.sync = ['native:window-state', 'native:clipboard-read']
exports.receive = [
  'log', 'error', 'dispatch', 'fullscreenChanged', 'windowBoundsChanged', 'checkForExternalPlayer',
  'wt-parsed', 'wt-metadata', 'wt-done', 'wt-ready', 'wt-file-modtimes', 'wt-warning',
  'wt-error', 'wt-file-saved', 'wt-poster', 'wt-audio-metadata', 'wt-server-running',
  'wt-progress', 'wt-uncaught-error', 'wt-new-torrent', 'wt-cast-state'
]
