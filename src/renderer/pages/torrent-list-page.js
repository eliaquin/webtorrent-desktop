const { Checkbox, ProgressBar } = require('../components/ui')
const React = require('react')
const prettyBytes = require('prettier-bytes')

const TorrentSummary = require('../lib/torrent-summary')
const TorrentPlayer = require('../lib/torrent-player')
const { dispatcher } = require('../lib/dispatcher')
const { calculateEta } = require('../lib/time')

module.exports = class TorrentList extends React.Component {
  constructor (props) {
    super(props)
    this.state = { query: '', filter: 'all' }
  }

  render () {
    const state = this.props.state
    const torrents = state.saved.torrents
    const query = this.state.query.trim().toLocaleLowerCase()
    const visible = torrents.filter(torrent =>
      (this.state.filter === 'all' || torrent.status === this.state.filter || (this.state.filter === 'downloading' && torrent.status === 'new')) &&
      (torrent.name || '').toLocaleLowerCase().includes(query))

    return (
      <section className='torrent-list media-shelf' onContextMenu={dispatcher('openTorrentListContextMenu')} aria-label='Torrent library'>
        <div className='shelf-heading'>
          <div><h1>Watch something</h1><p>Your media, ready when you are.</p></div>
          <button type='button' className='shelf-button shelf-primary' onClick={dispatcher('openTorrentAddress')}>
            <i className='icon' aria-hidden='true'>add</i>Add torrent
          </button>
        </div>
        <div className='shelf-toolbar'>
          <div className='shelf-filters' role='group' aria-label='Filter torrents'>
            {['all', 'downloading', 'seeding', 'paused'].map(filter => (
              <button
                key={filter} type='button' aria-pressed={this.state.filter === filter}
                onClick={() => this.setState({ filter })}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
          <label className='shelf-search' onContextMenu={stopPropagation}>
            <i className='icon' aria-hidden='true'>search</i>
            <input
              type='search' aria-label='Search library' placeholder='Search library'
              value={this.state.query} onChange={event => this.setState({ query: event.target.value })}
            />
          </label>
        </div>
        {state.downloadPathStatus === 'missing' && (
          <div className='shelf-warning' role='status'>
            <strong>Download folder unavailable</strong>
            <p>Connect your drive or choose a new download location.</p>
            <button type='button' className='shelf-button' onClick={dispatcher('preferences')}>Choose download folder</button>
          </div>
        )}
        <div className='shelf-grid'>
          {visible.map(torrent => this.renderTorrent(torrent))}
        </div>
        {!visible.length && (
          <div className='shelf-empty' role='status'>
            <i className='icon' aria-hidden='true'>{torrents.length ? 'search' : 'video_library'}</i>
            <h2>{torrents.length ? 'No matching torrents' : 'Your shelf is ready'}</h2>
            <p>{torrents.length ? 'Try another search or status filter.' : 'Add a torrent file or magnet link to start streaming.'}</p>
            {torrents.length
              ? <button type='button' className='shelf-button' onClick={() => this.setState({ query: '', filter: 'all' })}>Clear filters</button>
              : <button type='button' className='shelf-button' onClick={dispatcher('openTorrentAddress')}>Add your first torrent</button>}
          </div>
        )}
        <div className='torrent-placeholder'><span>Drop a torrent file anywhere or paste a magnet link</span></div>
        <footer className='shelf-footer'>
          <span>{torrents.length} {torrents.length === 1 ? 'torrent' : 'torrents'} in your library</span>
          <button type='button' onClick={dispatcher('preferences')}>Preferences</button>
        </footer>
      </section>
    )
  }

  renderTorrent (torrentSummary) {
    const infoHash = torrentSummary.infoHash
    const isSelected = !!infoHash && this.props.state.selectedInfoHash === infoHash
    if (!torrentSummary.torrentKey) throw new Error('Missing torrentKey')
    const name = torrentSummary.name || 'Loading torrent…'
    const poster = TorrentSummary.getPosterPath(torrentSummary)
    const posterURL = poster && 'file://' + (poster.startsWith('/') ? '' : '/') + encodeURI(poster).replace(/#/g, '%23').replace(/\?/g, '%3F')
    const detailId = 'torrent-files-' + torrentSummary.torrentKey
    return (
      <article
        id={torrentSummary.testID && ('torrent-' + torrentSummary.testID)}
        key={torrentSummary.torrentKey} className={'torrent' + (isSelected ? ' selected' : '')}
        onContextMenu={infoHash ? dispatcher('openTorrentContextMenu', infoHash) : stopPropagation}
      >
        <button
          type='button' className='torrent-cover' disabled={!infoHash}
          aria-label={'Show files for ' + name} aria-expanded={isSelected} aria-controls={isSelected ? detailId : undefined}
          onClick={dispatcher('toggleSelectTorrent', infoHash)}
        >
          <i className='icon poster-fallback' aria-hidden='true'>{TorrentPlayer.isPlayableTorrentSummary(torrentSummary) ? 'movie' : 'folder'}</i>
          {posterURL && <img src={posterURL} alt='' onError={event => { event.currentTarget.hidden = true }} onLoad={event => { event.currentTarget.hidden = false }} />}
        </button>
        <div className='torrent-body'>
          {this.renderTorrentMetadata(torrentSummary)}
          {this.renderTorrentButtons(torrentSummary, isSelected, detailId)}
        </div>
        {isSelected && <div id={detailId}>{this.renderTorrentDetails(torrentSummary)}</div>}
      </article>
    )
  }

  renderTorrentMetadata (torrent) {
    const prog = torrent.progress
    const percent = prog ? Math.floor(Math.max(0, Math.min(1, prog.progress || 0)) * 100) : 0
    const status = torrent.error
      ? 'Needs attention'
      : torrent.status === 'paused'
        ? (percent === 100 ? 'Complete · paused' : 'Paused')
        : torrent.status === 'seeding'
          ? 'Seeding'
          : torrent.status === 'downloading' && prog ? (prog.ready ? 'Downloading' : 'Verifying') : 'Getting metadata'
    const transferred = prog && prettyBytes(prog.downloaded || 0)
    const total = prog && prettyBytes(prog.length || 0)
    const speeds = []
    if (torrent.status !== 'paused' && prog) {
      if (prog.downloadSpeed > 0) speeds.push('↓ ' + prettyBytes(prog.downloadSpeed) + '/s')
      if (prog.uploadSpeed > 0) speeds.push('↑ ' + prettyBytes(prog.uploadSpeed) + '/s')
      if (prog.downloadSpeed > 0 && prog.length > prog.downloaded) speeds.push(calculateEta(prog.length - prog.downloaded, prog.downloadSpeed))
      if (prog.numPeers > 0) speeds.push(prog.numPeers + (prog.numPeers === 1 ? ' peer' : ' peers'))
      if (!speeds.length && prog.ready && percent < 100) speeds.push('Waiting for peers')
    }
    return (
      <div className='metadata'>
        <h2 className='name' title={torrent.name}>{torrent.name || 'Loading torrent…'}</h2>
        <div className={'torrent-status' + (torrent.error ? ' has-error' : '')}>
          <strong>{status}</strong>{prog && <><span>{percent}%</span><span>{transferred === total ? total : transferred + ' / ' + total}</span></>}
        </div>
        {prog ? <ProgressBar aria-label='Download progress' value={percent} /> : <progress className='ui-progress' aria-label='Getting torrent metadata' />}
        <div className='torrent-transfer'>{torrent.error ? getErrorMessage(torrent) : torrent.status === 'paused' ? 'Transfer paused' : speeds.join(' · ') || (prog ? 'Sharing downloaded files' : 'Connecting to the torrent network…')}</div>
      </div>
    )
  }

  renderTorrentButtons (torrent, isSelected, detailId) {
    const infoHash = torrent.infoHash
    const active = ['downloading', 'seeding', 'new'].includes(torrent.status)
    return (
      <div className='torrent-controls'>
        {!torrent.error && TorrentPlayer.isPlayableTorrentSummary(torrent) && (
          <button type='button' className='shelf-button play' disabled={!infoHash} onClick={dispatcher('playFile', infoHash)}>
            <i className='icon' aria-hidden='true'>play_arrow</i>Stream
          </button>
        )}
        <button
          type='button' className='shelf-button download' disabled={!infoHash}
          aria-label={active ? 'Pause torrent' : 'Resume torrent'} title={active ? 'Pause transfer' : 'Resume transfer'}
          onClick={dispatcher('toggleTorrent', infoHash)}
        >
          <i className='icon' aria-hidden='true'>{active ? 'pause' : 'file_download'}</i>
        </button>
        <button
          type='button' className='shelf-button torrent-files' disabled={!infoHash}
          aria-label={'Show files for ' + (torrent.name || 'torrent')} aria-expanded={isSelected} aria-controls={isSelected ? detailId : undefined}
          onClick={dispatcher('toggleSelectTorrent', infoHash)} title='Show files'
        >
          <i className='icon' aria-hidden='true'>folder_open</i>
        </button>
        <button
          type='button' className='shelf-button torrent-more' disabled={!infoHash} aria-label={'More actions for ' + (torrent.name || 'torrent')}
          title='More actions' onClick={dispatcher('openTorrentContextMenu', infoHash)}
        >
          <i className='icon' aria-hidden='true'>more_horiz</i>
        </button>
      </div>
    )
  }

  // Show files, per-file download status and play buttons, and so on
  renderTorrentDetails (torrentSummary) {
    let filesElement
    if (torrentSummary.error || !torrentSummary.files) {
      let message = ''
      if (torrentSummary.error === 'path-missing') {
        // Special case error: this torrent's download dir or file is missing
        message = 'Missing path: ' + TorrentSummary.getFileOrFolder(torrentSummary)
      } else if (torrentSummary.error) {
        // General error for this torrent: just show the message
        message = torrentSummary.error.message || torrentSummary.error
      } else if (torrentSummary.status === 'paused') {
        // No file info, no infohash, and we're not trying to download from the DHT
        message = 'Failed to load torrent info. Click the download button to try again...'
      } else {
        // No file info, no infohash, trying to load from the DHT
        message = 'Downloading torrent info...'
      }
      filesElement = (
        <div key='files' className='files warning'>
          {message}
        </div>
      )
    } else {
      // We do know the files. List them and show download stats for each one
      const sortByName = this.props.state.saved.prefs.sortByName
      const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
      let fileRows = torrentSummary.files
        .map((file, index) => ({ file, index }))
        .filter(({ file }) => !file.path.includes('/.____padding_file/'))

      if (sortByName) {
        fileRows = fileRows.sort((a, b) => collator.compare(a.file.name, b.file.name))
      }

      fileRows = fileRows.map((obj) => this.renderFileRow(torrentSummary, obj.file, obj.index))

      filesElement = (
        <div key='files' className='files'>
          <table>
            <tbody>
              {fileRows}
            </tbody>
          </table>
        </div>
      )
    }

    return (
      <div key='details' className='torrent-details'>
        {filesElement}
      </div>
    )
  }

  // Show a single torrentSummary file in the details view for a single torrent
  renderFileRow (torrentSummary, file, index) {
    // First, find out how much of the file we've downloaded
    // Are we even torrenting it?
    const isSelected = torrentSummary.selections && torrentSummary.selections[index]
    let isDone = false // Are we finished torrenting it?
    let progress = ''
    if (torrentSummary.progress && torrentSummary.progress.files &&
        torrentSummary.progress.files[index]) {
      const fileProg = torrentSummary.progress.files[index]
      isDone = fileProg.numPiecesPresent === fileProg.numPieces
      progress = Math.floor(100 * fileProg.numPiecesPresent / fileProg.numPieces) + '%'
    }

    // Second, for media files where we saved our position, show how far we got
    let positionElem
    if (file.currentTime) {
      // Radial progress bar. 0% = start from 0:00, 270% = 3/4 of the way thru
      positionElem = this.renderRadialProgressBar(file.currentTime / file.duration)
    }

    // Finally, render the file as a table row
    const isPlayable = TorrentPlayer.isPlayable(file)
    const infoHash = torrentSummary.infoHash
    let icon
    let handleClick
    if (isPlayable) {
      icon = 'play_arrow' /* playable? add option to play */
      handleClick = dispatcher('playFile', infoHash, index)
    } else {
      icon = 'description' /* file icon, opens in OS default app */
      handleClick = isDone
        ? dispatcher('openPath', infoHash, index)
        : (e) => e.stopPropagation() // noop if file is not ready
    }
    // TODO: add a css 'disabled' class to indicate that a file cannot be opened/streamed
    let rowClass = ''
    if (!isSelected) rowClass = 'disabled' // File deselected, not being torrented
    if (!isDone && !isPlayable) rowClass = 'disabled' // Can't open yet, can't stream
    return (
      <tr key={index} onClick={handleClick}>
        <td className={'col-icon ' + rowClass}>
          {positionElem}
          <i className='icon'>{icon}</i>
        </td>
        <td className={'col-name ' + rowClass}>
          <button type='button' className='file-open' disabled={!isPlayable && !isDone} onClick={handleClick} title={file.name}>{file.name}</button>
        </td>
        <td className={'col-progress ' + rowClass}>
          {isSelected ? progress : ''}
        </td>
        <td className={'col-size ' + rowClass}>
          {prettyBytes(file.length)}
        </td>
        <td className='col-select'>
          <Checkbox aria-label={'Download ' + file.name} checked={!!isSelected} onClick={stopPropagation} onChange={dispatcher('toggleTorrentFile', infoHash, index)} />
        </td>
      </tr>
    )
  }

  renderRadialProgressBar (fraction, cssClass) {
    const rotation = 360 * fraction
    const transformFill = { transform: 'rotate(' + (rotation / 2) + 'deg)' }
    const transformFix = { transform: 'rotate(' + rotation + 'deg)' }

    return (
      <div key='radial-progress' className={'radial-progress ' + cssClass}>
        <div className='circle'>
          <div className='mask full' style={transformFill}>
            <div className='fill' style={transformFill} />
          </div>
          <div className='mask half'>
            <div className='fill' style={transformFill} />
            <div className='fill fix' style={transformFix} />
          </div>
        </div>
        <div className='inset' />
      </div>
    )
  }
}

function stopPropagation (e) {
  e.stopPropagation()
}

function getErrorMessage (torrentSummary) {
  const err = torrentSummary.error
  if (err === 'path-missing') {
    return (
      <span key='path-missing'>
        Path missing.<br />
        Reconnect your drive, then resume this torrent.
      </span>
    )
  }
  return typeof err === 'string' ? err : err.message || 'Unable to download this torrent.'
}
