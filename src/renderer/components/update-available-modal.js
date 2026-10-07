const React = require('react')
const { shell } = require('electron')
const config = require('../../config')

const ModalOKCancel = require('./modal-ok-cancel')
const { dispatch } = require('../lib/dispatcher')

module.exports = class UpdateAvailableModal extends React.Component {
  render () {
    const state = this.props.state
    return (
      <div className='update-available-modal'>
        <p><strong>A new version of WebTorrent is available: v{state.modal.version}</strong></p>
        <p>
          Download the new version from the releases page for this personal fork.
        </p>
        <ModalOKCancel
          cancelText='SKIP THIS RELEASE'
          onCancel={handleSkip}
          okText='SHOW DOWNLOAD PAGE'
          onOK={handleShow}
        />
      </div>
    )

    function handleShow () {
      shell.openExternal(config.GITHUB_URL_RELEASES)
      dispatch('exitModal')
    }

    function handleSkip () {
      dispatch('skipVersion', state.modal.version)
      dispatch('exitModal')
    }
  }
}
