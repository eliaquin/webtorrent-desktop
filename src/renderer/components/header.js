const React = require('react')

const { dispatcher } = require('../lib/dispatcher')

class Header extends React.Component {
  render () {
    const loc = this.props.state.location
    return (
      <div
        className='header'
        onMouseMove={dispatcher('mediaMouseMoved')}
        onMouseEnter={dispatcher('mediaControlsMouseEnter')}
        onMouseLeave={dispatcher('mediaControlsMouseLeave')}
        role='navigation'
      >
        {this.getTitle()}
        <div className='nav left float-left'>
          <button
            type='button'
            className={'back ' + (loc.hasBack() ? '' : 'disabled')}
            title='Back'
            onClick={dispatcher('back')}
            disabled={!loc.hasBack()}
            aria-label='Back'
          >
            <i className='icon' aria-hidden='true'>chevron_left</i>
          </button>
          <button
            type='button'
            className={'forward ' + (loc.hasForward() ? '' : 'disabled')}
            title='Forward'
            onClick={dispatcher('forward')}
            disabled={!loc.hasForward()}
            aria-label='Forward'
          >
            <i className='icon' aria-hidden='true'>chevron_right</i>
          </button>
        </div>
        <div className='nav right float-right'>
          {this.getSettingsButton()}
        </div>
      </div>
    )
  }

  getTitle () {
    if (process.platform !== 'darwin') return null
    const state = this.props.state
    return (<div className='title ellipsis'>{state.window.title}</div>)
  }

  getSettingsButton () {
    const state = this.props.state
    if (state.location.url() !== 'home') return null
    return (
      <button type='button' className='header-settings' aria-label='Preferences' title='Preferences' onClick={dispatcher('preferences')}>
        <i className='icon' aria-hidden='true'>settings</i>
      </button>
    )
  }
}

module.exports = Header
