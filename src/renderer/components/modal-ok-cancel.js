const { Button } = require('./ui')
const React = require('react')

module.exports = class ModalOKCancel extends React.Component {
  render () {
    const cancelStyle = { marginRight: 10, color: 'black' }
    const { cancelText, onCancel, okText, onOK, okDisabled = false, okAutoFocus = true } = this.props
    return (
      <div className='float-right'>
        <Button
          variant='flat'
          className='control cancel'
          style={cancelStyle}
          label={cancelText}
          onClick={onCancel}
        />
        <Button
          className='control ok'
          primary
          label={okText}
          onClick={onOK}
          disabled={okDisabled}
          autoFocus={okAutoFocus}
        />
      </div>
    )
  }
}
