const { Button, TextField } = require('./ui')
const path = require('path')

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
    const id = this.props.id || this.props.title.replaceAll(' ', '-').toLowerCase()
    const text = this.props.value || ''
    return (
      <div className={'path-selector ' + (this.props.className || '')}>
        <label htmlFor={id}>{this.props.title}</label>
        <div className='path-selector-controls'>
          <TextField
            className='control' readOnly id={id} value={text}
            placeholder='Not selected' title={text || 'Not selected'}
          />
          <Button
            className='control' label='Change…' aria-label={'Change ' + this.props.title.toLowerCase()} onClick={this.handleClick}
          />
        </div>
      </div>
    )
  }
}

module.exports = PathSelector
