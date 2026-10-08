const { TextField } = require('./ui')
const React = require('react')
const { clipboard } = require('../lib/native-api')

const ModalOKCancel = require('./modal-ok-cancel')
const { dispatch, dispatcher } = require('../lib/dispatcher')
const { isMagnetLink } = require('../lib/torrent-player')
const { getTorrentAddressError } = require('../../shared/torrent-address')

module.exports = class OpenTorrentAddressModal extends React.Component {
  constructor (props) {
    super(props)
    this.state = { address: '', error: '' }
    this.edited = false
    this.submitted = false
  }

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
            spellCheck={false}
            value={this.state.address}
            onChange={event => {
              this.edited = true
              this.setState({ address: event.target.value, error: '' })
            }}
            aria-invalid={!!this.state.error}
            aria-describedby={this.state.error ? 'torrent-address-error' : undefined}
            onKeyDown={handleKeyDown.bind(this)}
          />
        </div>
        {this.state.error && <p id='torrent-address-error' className='error-text' role='alert'>{this.state.error}</p>}
        <ModalOKCancel
          cancelText='CANCEL'
          onCancel={dispatcher('exitModal')}
          okText='OK'
          okDisabled={!this.state.address.trim()}
          okAutoFocus={false}
          onOK={handleOK.bind(this)}
        />
      </div>
    )
  }

  componentDidMount () {
    this.mounted = true
    this.torrentURL.focus()
    clipboard.readTextAsync().then(clipboardContent => {
      if (!this.mounted || this.edited || this.submitted || !isMagnetLink(clipboardContent) || getTorrentAddressError(clipboardContent)) return
      this.setState({ address: clipboardContent.trim() }, () => {
        if (this.mounted && !this.edited && !this.submitted) this.torrentURL.select()
      })
    }).catch(() => {})
  }

  componentWillUnmount () {
    this.mounted = false
  }
}

function handleKeyDown (e) {
  if (e.key !== 'Enter' || e.isComposing || e.nativeEvent?.isComposing) return
  e.preventDefault()
  e.stopPropagation()
  handleOK.call(this)
}

function handleOK () {
  if (this.submitted) return
  const torrentURL = this.state.address.trim()
  const error = getTorrentAddressError(torrentURL)
  if (error) {
    this.setState({ error })
    this.torrentURL.focus()
    return
  }
  this.submitted = true
  dispatch('exitModal')
  dispatch('addTorrent', torrentURL)
}
