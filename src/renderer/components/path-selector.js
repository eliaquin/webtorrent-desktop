const { Button, TextField } = require('./ui')
const path = require('path')

const colors = require('./ui/colors')
const native = require('../lib/native-api')
const React = require('react')

// Lets you pick a file or directory.
// Uses the system Open File dialog.
// You can't edit the text field directly.
/**
 * @typedef {{className?: string, dialog?: object, id?: string, onChange?: (path: string) => void, title: string, value?: string}} PathSelectorProps
 * @extends {React.Component<PathSelectorProps>}
 */
class PathSelector extends React.Component {
  constructor (props) {
    super(props)
    this.handleClick = this.handleClick.bind(this)
  }

  async handleClick () {
    const opts = Object.assign({
      defaultPath: path.dirname(this.props.value || ''),
      properties: ['openFile', 'openDirectory']
    }, this.props.dialog)

    const filenames = await native.choosePath(opts)
    if (!Array.isArray(filenames)) return
    this.props.onChange && this.props.onChange(filenames[0])
  }

  render () {
    const id = this.props.title.replace(' ', '-').toLowerCase()
    const wrapperStyle = {
      alignItems: 'center',
      display: 'flex',
      width: '100%'
    }
    const labelStyle = {
      flex: '0 auto',
      marginRight: 10,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
    const textareaStyle = {
      color: colors.grey50
    }
    const textFieldStyle = {
      flex: '1'
    }
    const text = this.props.value || ''
    const buttonStyle = {
      marginLeft: 10
    }

    return (
      <div className={this.props.className} style={wrapperStyle}>
        <label htmlFor={id} className='label' style={labelStyle}>
          {this.props.title}:
        </label>
        <TextField
          className='control' readOnly id={id} value={text}
          inputStyle={textareaStyle} style={textFieldStyle}
        />
        <Button
          className='control' label='Change' onClick={this.handleClick}
          style={buttonStyle}
        />
      </div>
    )
  }
}

module.exports = PathSelector
