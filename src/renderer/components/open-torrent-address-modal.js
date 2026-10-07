const { TextField } = require('./ui')
const React = require('react')
const { clipboard } = require('@electron/remote')

const ModalOKCancel = require('./modal-ok-cancel')
const { dispatch, dispatcher } = require('../lib/dispatcher')
const { isMagnetLink } = require('../lib/torrent-player')

module.exports = class OpenTorrentAddressModal extends React.Component {
  render () {
    return (
      <div className='open-torrent-address-modal'>
        <p><label htmlFor='torrent-address-field'>Enter torrent address or magnet link</label></p>
        <div>
          <TextField
            id='torrent-address-field'
            className='control'
            ref={(c) => { this.torrentURL = c }}
            fullWidth
            onKeyDown={handleKeyDown.bind(this)}
          />
        </div>
        <ModalOKCancel
          cancelText='CANCEL'
          onCancel={dispatcher('exitModal')}
          okText='OK'
          onOK={handleOK.bind(this)}
        />
      </div>
    )
  }

  componentDidMount () {
    this.torrentURL.focus()
    const clipboardContent = clipboard.readText()

    if (isMagnetLink(clipboardContent)) {
      this.torrentURL.value = clipboardContent
      this.torrentURL.select()
    }
  }
}

function handleKeyDown (e) {
  if (e.key === 'Enter') handleOK.call(this) /* hit Enter to submit */
}

function handleOK () {
  const torrentURL = this.torrentURL.value
  dispatch('exitModal')
  dispatch('addTorrent', torrentURL)
}
