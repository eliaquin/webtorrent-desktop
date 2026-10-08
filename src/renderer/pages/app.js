const createGetter = require('../../shared/lazy')
const React = require('react')

const Header = require('../components/header')
const { dispatcher } = require('../lib/dispatcher')

// Perf optimization: Needed immediately, so do not lazy load it below
const TorrentListPage = require('./torrent-list-page')

const Views = {
  home: createGetter(() => TorrentListPage),
  player: createGetter(() => require('./player-page')),
  'create-torrent': createGetter(() => require('./create-torrent-page')),
  preferences: createGetter(() => require('./preferences-page'))
}

const Modals = {
  'open-torrent-address-modal': createGetter(
    () => require('../components/open-torrent-address-modal')
  ),
  'remove-torrent-modal': createGetter(() => require('../components/remove-torrent-modal')),
  'update-available-modal': createGetter(() => require('../components/update-available-modal')),
  'unsupported-media-modal': createGetter(() => require('../components/unsupported-media-modal')),
  'delete-all-torrents-modal':
      createGetter(() => require('../components/delete-all-torrents-modal'))
}

const { createStore } = require('../lib/store')

function useScope (store, keys) {
  const scope = keys.join('|')
  const subscribe = React.useCallback(listener => store.subscribe(keys, listener), [store, scope])
  const snapshot = React.useCallback(() => store.version(keys), [store, scope])
  React.useSyncExternalStore(subscribe, snapshot)
  return store.state
}

function App (props) {
  const fallback = React.useMemo(() => props.store || createStore(props.state), [props.store, props.state])
  const state = useScope(fallback, ['location', 'window', 'playing.hideControls'])
  const classes = ['view-' + state.location.url(), 'is-' + process.platform]
  if (state.window.isFullScreen) classes.push('is-fullscreen')
  if (state.window.isFocused) classes.push('is-focused')
  if (state.playing.hideControls) classes.push('hide-video-controls')
  return (
    <div className={'app ' + classes.join(' ')}>
      <StoreHeader store={fallback} />
      <Errors store={fallback} />
      <div key='content' className='content'><View store={fallback} /></div>
      <Modal store={fallback} />
    </div>
  )
}

const StoreHeader = React.memo(function StoreHeader ({ store }) {
  const state = useScope(store, ['location', 'window', 'playing.fileName'])
  return <Header state={state} />
})

const View = React.memo(function View ({ store }) {
  const state = useScope(store, ['location'])
  const page = state.location.url()
  return <Page key={page} store={store} page={page} />
})

function Page ({ store, page }) {
  const keys = page === 'preferences'
    ? ['saved.prefs']
    : page === 'create-torrent'
      ? ['location']
      : page === 'player'
        ? ['playing', 'saved.torrents', 'server', 'devices', 'window']
        : ['saved.torrents', 'saved.prefs', 'selectedInfoHash', 'downloadPathStatus']
  const state = useScope(store, keys)
  const Contents = Views[page]()
  return <Contents state={state} />
}

const Modal = React.memo(function Modal ({ store }) {
  const state = useScope(store, ['modal', 'saved.torrents'])
  if (!state.modal) return null
  const Contents = Modals[state.modal.id]()
  return (
    <div key='modal' className='modal'>
      <div key='modal-background' className='modal-background' />
      <div key='modal-content' className='modal-content' role='dialog' aria-modal='true' aria-label='WebTorrent dialog'>
        <Contents state={state} />
      </div>
    </div>
  )
})

const Errors = React.memo(function Errors ({ store }) {
  const state = useScope(store, ['errors'])
  const [, expire] = React.useState(0)
  const recent = state.errors.filter(error => Date.now() - error.time < 5000)
  React.useEffect(() => {
    if (!recent.length) return
    const timeout = setTimeout(() => expire(value => value + 1), Math.max(1, Math.min(...recent.map(error => error.time + 5000 - Date.now()))))
    return () => clearTimeout(timeout)
  })
  return (
    <div key='errors' className={'error-popover ' + (recent.length ? 'visible' : 'hidden')}>
      <div key='title' className='title'>
        Error
        <button type='button' className='dismiss-errors' aria-label='Dismiss errors' onClick={dispatcher('dismissErrors')}>×</button>
      </div>
      {recent.map((error, index) => <div key={index} className='error'>{error.message}</div>)}
    </div>
  )
})

module.exports = App
