const { Button, TextField, Checkbox } = require('../components/ui')
const React = require('react')

const PathSelector = require('../components/path-selector')

const { dispatch } = require('../lib/dispatcher')
const config = require('../../config')
const native = require('../lib/native-api')

class PreferencesPage extends React.Component {
  constructor (props) {
    super(props)

    this.handleDownloadPathChange =
      this.handleDownloadPathChange.bind(this)

    this.handleOpenExternalPlayerChange =
      this.handleOpenExternalPlayerChange.bind(this)

    this.handleExternalPlayerPathChange =
      this.handleExternalPlayerPathChange.bind(this)

    this.handleStartupChange =
      this.handleStartupChange.bind(this)

    this.handleSoundNotificationsChange =
      this.handleSoundNotificationsChange.bind(this)

    this.handleSetGlobalTrackers =
      this.handleSetGlobalTrackers.bind(this)

    const globalTrackers = this.props.state.getGlobalTrackers().join('\n')

    this.state = {
      globalTrackers,
      nativePlayer: null
    }
  }

  componentDidMount () {
    this.mounted = true
    native.playerAvailable().then(nativePlayer => { if (this.mounted) this.setState({ nativePlayer }) }).catch(() => {
      if (this.mounted) this.setState({ nativePlayer: { available: false, message: 'Native VLC is unavailable.' } })
    })
  }

  componentWillUnmount () { this.mounted = false }

  videoEngineSelector () {
    if (process.platform !== 'darwin') return
    const availability = this.state.nativePlayer
    return (
      <Preference>
        <div className='preference-select'>
          <label htmlFor='video-engine'>Video player</label>
          <select id='video-engine' aria-label='Video player' value={this.props.state.saved.prefs.videoEngine || 'chromium'} onChange={event => dispatch('updatePreferences', 'videoEngine', event.target.value)}>
            <option value='chromium'>Built-in player</option>
            <option value='vlc' disabled={!availability?.available}>Native VLC (experimental)</option>
          </select>
        </div>
        <p>{availability?.available ? 'Native VLC plays video inside WebTorrent using your installed VLC app. Applies to the next video you open.' : availability?.message || 'Checking for VLC…'}</p>
      </Preference>
    )
  }

  downloadPathSelector () {
    return (
      <Preference>
        <PathSelector
          dialog={{
            title: 'Select download directory',
            properties: ['openDirectory']
          }}
          onChange={this.handleDownloadPathChange}
          title='Download location'
          value={this.props.state.saved.prefs.downloadPath}
        />
      </Preference>
    )
  }

  handleDownloadPathChange (filePath) {
    dispatch('updatePreferences', 'downloadPath', filePath)
  }

  openExternalPlayerCheckbox () {
    return (
      <Preference>
        <Checkbox
          className='control'
          role='switch'
          checked={!this.props.state.saved.prefs.openExternalPlayer}
          label='Play media in WebTorrent'
          onChange={this.handleOpenExternalPlayerChange}
        />
      </Preference>
    )
  }

  handleOpenExternalPlayerChange (e) {
    const isChecked = e.target.checked
    dispatch('updatePreferences', 'openExternalPlayer', !isChecked)
  }

  highestPlaybackPriorityCheckbox () {
    return (
      <Preference>
        <Checkbox
          className='control'
          role='switch'
          checked={this.props.state.saved.prefs.highestPlaybackPriority}
          label='Prioritize streaming'
          onChange={this.handleHighestPlaybackPriorityChange}
        />
        <p>Pause other active torrents while you watch to give playback all available bandwidth.</p>
      </Preference>
    )
  }

  handleHighestPlaybackPriorityChange (e) {
    const isChecked = e.target.checked
    dispatch('updatePreferences', 'highestPlaybackPriority', isChecked)
  }

  externalPlayerPathSelector () {
    const playerPath = this.props.state.saved.prefs.externalPlayerPath
    const playerName = this.props.state.getExternalPlayerName()

    const description = this.props.state.saved.prefs.openExternalPlayer
      ? `Torrent media files will always play in ${playerName}.`
      : `Torrent media files will play in ${playerName} if WebTorrent cannot play them.`

    return (
      <Preference>
        <PathSelector
          dialog={{
            title: 'Select media player app',
            properties: ['openFile']
          }}
          onChange={this.handleExternalPlayerPathChange}
          title='External player'
          value={playerPath}
        />
        <p>{description}</p>
      </Preference>
    )
  }

  handleExternalPlayerPathChange (filePath) {
    dispatch('updatePreferences', 'externalPlayerPath', filePath)
  }

  autoAddTorrentsCheckbox () {
    return (
      <Preference>
        <Checkbox
          className='control'
          role='switch'
          checked={this.props.state.saved.prefs.autoAddTorrents}
          label='Automatically add torrents'
          onChange={(e) => { this.handleAutoAddTorrentsChange(e) }}
        />
        <p>Add new .torrent files from your watched folder to the library.</p>
      </Preference>
    )
  }

  handleAutoAddTorrentsChange (e) {
    const isChecked = e.target.checked
    const torrentsFolderPath = this.props.state.saved.prefs.torrentsFolderPath
    if (isChecked && !torrentsFolderPath) {
      alert('Select a torrents folder first.') // eslint-disable-line
      e.preventDefault()
      return
    }

    dispatch('updatePreferences', 'autoAddTorrents', isChecked)

    if (isChecked) {
      dispatch('startFolderWatcher')
      return
    }

    dispatch('stopFolderWatcher')
  }

  torrentsFolderPathSelector () {
    const torrentsFolderPath = this.props.state.saved.prefs.torrentsFolderPath

    return (
      <Preference>
        <PathSelector
          dialog={{
            title: 'Select folder to watch for new torrents',
            properties: ['openDirectory']
          }}
          onChange={this.handleTorrentsFolderPathChange}
          title='Folder to watch'
          value={torrentsFolderPath}
        />
      </Preference>
    )
  }

  handleTorrentsFolderPathChange (filePath) {
    dispatch('updatePreferences', 'torrentsFolderPath', filePath)
  }

  setDefaultAppButton () {
    const isFileHandler = this.props.state.saved.prefs.isFileHandler
    if (isFileHandler) {
      return (
        <Preference>
          <div className='preference-label'>Default torrent app</div>
          <p className='preference-status'><i className='icon' aria-hidden='true'>check_circle</i>WebTorrent is your default torrent app.</p>
        </Preference>
      )
    }
    return (
      <Preference>
        <div className='preference-label'>Default torrent app</div>
        <p>Open torrent files and magnet links with WebTorrent by default.</p>
        <Button
          className='control'
          onClick={this.handleSetDefaultApp}
          label='Make WebTorrent the default'
        />
      </Preference>
    )
  }

  handleStartupChange (e) {
    const isChecked = e.target.checked
    dispatch('updatePreferences', 'startup', isChecked)
  }

  setStartupCheckbox () {
    if (config.IS_PORTABLE) {
      return
    }

    return (
      <Preference>
        <Checkbox
          className='control'
          role='switch'
          checked={this.props.state.saved.prefs.startup}
          label='Open WebTorrent on startup'
          onChange={this.handleStartupChange}
        />
      </Preference>
    )
  }

  soundNotificationsCheckbox () {
    return (
      <Preference>
        <Checkbox
          className='control'
          role='switch'
          checked={this.props.state.saved.prefs.soundNotifications}
          label='Enable sounds'
          onChange={this.handleSoundNotificationsChange}
        />
      </Preference>
    )
  }

  handleSoundNotificationsChange (e) {
    const isChecked = e.target.checked
    dispatch('updatePreferences', 'soundNotifications', isChecked)
  }

  handleSetDefaultApp () {
    dispatch('updatePreferences', 'isFileHandler', true)
  }

  setGlobalTrackers () {
    return (
      <Preference>
        <label className='preference-label' htmlFor='global-trackers'>Global trackers</label>
        <p id='trackers-description'>Add one tracker URL per line. These trackers are used for every torrent.</p>
        <TextField
          className='torrent-trackers control'
          aria-label='Global trackers'
          id='global-trackers'
          aria-describedby='trackers-description'
          fullWidth
          multiline
          rows={4}
          rowsMax={10}
          value={this.state.globalTrackers}
          onChange={this.handleSetGlobalTrackers}
        />
      </Preference>
    )
  }

  handleSetGlobalTrackers (e) {
    const globalTrackers = e.target.value
    this.setState({ globalTrackers })

    const announceList = globalTrackers
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s !== '')

    dispatch('updatePreferences', 'globalTrackers', announceList)
    dispatch('updateGlobalTrackers', announceList)
  }

  render () {
    const sections = [
      { id: 'folders', title: 'Folders', icon: 'folder_open', description: 'Choose where your downloads live and how torrents are added.', contents: <>{this.downloadPathSelector()}{this.torrentsFolderPathSelector()}{this.autoAddTorrentsCheckbox()}</> },
      { id: 'playback', title: 'Playback', icon: 'play_circle_outline', description: 'Make yourself comfortable. Choose how your media plays.', contents: <>{this.openExternalPlayerCheckbox()}{this.videoEngineSelector()}{this.externalPlayerPathSelector()}{this.highestPlaybackPriorityCheckbox()}</> },
      { id: 'general', title: 'General', icon: 'tune', description: 'A few everyday details, just the way you like them.', contents: <>{this.setStartupCheckbox()}{this.soundNotificationsCheckbox()}{this.setDefaultAppButton()}</> },
      { id: 'trackers', title: 'Trackers', icon: 'wifi', description: 'Help your torrents find peers on the network.', contents: this.setGlobalTrackers() }
    ]
    return (
      <section className='preferences-page' aria-labelledby='preferences-title'>
        <div className='preferences-heading'>
          <div><h1 id='preferences-title'>Preferences</h1><p>Make WebTorrent feel like home.</p></div>
          <span className='preferences-autosave'><i className='icon' aria-hidden='true'>check_circle</i>Changes save automatically</span>
        </div>
        <div className='preferences-layout'>
          <nav className='preferences-index' aria-label='Preference sections'>
            {sections.map(section => (
              <button
                type='button' key={section.id} onClick={() => {
                  const heading = document.getElementById('preferences-' + section.id)
                  heading.focus({ preventScroll: true })
                  heading.scrollIntoView({ block: 'start' })
                }}
              >
                <i className='icon' aria-hidden='true'>{section.icon}</i>{section.title}
              </button>
            ))}
          </nav>
          <div className='preferences-sections'>
            {sections.map(section => (
              <PreferencesSection key={section.id} id={'preferences-' + section.id} title={section.title} description={section.description}>
                {section.contents}
              </PreferencesSection>
            ))}
          </div>
        </div>
      </section>
    )
  }
}

function PreferencesSection ({ id, title, description, children }) {
  return (
    <section className='preferences-section' aria-labelledby={id}>
      <div className='preferences-section-heading'>
        <h2 id={id} tabIndex={-1}>{title}</h2>
        <p>{description}</p>
      </div>
      <div className='preferences-card'>{children}</div>
    </section>
  )
}

function Preference ({ children }) {
  return <div className='preference'>{children}</div>
}

module.exports = PreferencesPage
