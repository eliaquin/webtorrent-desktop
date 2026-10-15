const config = require('../../config')
const { Button } = require('./ui')
const ModalOKCancel = require('./modal-ok-cancel')
const { dispatch } = require('../lib/dispatcher')

module.exports = function UpdateAvailableModal ({ state }) {
  const update = state.modal
  if (update.status !== 'available') {
    const messages = {
      checking: ['Checking for updates…', 'Looking for a newer version of WebTorrent.'],
      current: ['No updates available', `You’re using WebTorrent v${config.APP_VERSION}. No newer download is available for this computer.`],
      error: ['Couldn’t check for updates', 'Check your internet connection and try again.']
    }
    const [title, message] = messages[update.status] || messages.error
    return (
      <div className='update-available-modal'>
        <h2>{title}</h2>
        <p role='status'>{message}</p>
        {update.status === 'error'
          ? <ModalOKCancel cancelText='Close' onCancel={() => dispatch('exitModal')} okText='Try again' onOK={() => { dispatch('exitModal'); dispatch('checkForUpdates') }} />
          : <Button primary label='Close' onClick={() => dispatch('exitModal')} />}
      </div>
    )
  }
  return (
    <div className='update-available-modal'>
      <h2>A new version is available</h2>
      <p>WebTorrent v{update.version} is ready. Would you like to download it?</p>
      <p>Your downloads and preferences will stay in place when you update the app.</p>
      {update.downloadError && <p role='alert'>Couldn’t open the download in your browser. Please try again.</p>}
      <Button variant='flat' label='Skip this version' onClick={() => dispatch('skipVersion', update.version)} />
      <ModalOKCancel
        cancelText='Not now'
        onCancel={() => dispatch('exitModal')}
        okText={update.opening ? 'Opening…' : update.directDownload ? 'Download' : 'View downloads'}
        okDisabled={update.opening}
        onOK={() => dispatch('downloadUpdate')}
      />
    </div>
  )
}
