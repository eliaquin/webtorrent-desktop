const React = require('react')

const { dispatcher } = require('../lib/dispatcher')

class Header extends React.Component {
  render () {
    const page = this.props.state.location.url()
    const isMainPage = page === 'home' || page === 'preferences'
    return (
      <header
        className='header'
        onMouseMove={dispatcher('mediaMouseMoved')}
        onMouseEnter={dispatcher('mediaControlsMouseEnter')}
        onMouseLeave={dispatcher('mediaControlsMouseLeave')}
      >
        <nav className='app-navigation' aria-label='Main navigation'>
          {isMainPage && (
            <>
              <button type='button' aria-current={page === 'home' ? 'page' : undefined} onClick={page === 'home' ? undefined : dispatcher('backToList')}>
                <i className='icon' aria-hidden='true'>video_library</i>Library
              </button>
              <button type='button' aria-current={page === 'preferences' ? 'page' : undefined} onClick={page === 'preferences' ? undefined : dispatcher('preferences')}>
                <i className='icon' aria-hidden='true'>settings</i>Preferences
              </button>
            </>
          )}
          {!isMainPage && (
            <button type='button' className='back-to-library' onClick={dispatcher('backToList')}>
              <i className='icon' aria-hidden='true'>arrow_back</i>Back to library
            </button>
          )}
        </nav>
        {!isMainPage && <div className='title ellipsis'>{this.props.state.window.title}</div>}
      </header>
    )
  }
}

module.exports = Header
