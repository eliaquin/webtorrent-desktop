// Navigation hooks load the next page before destroying the current one. Keep
// history unchanged when loading fails, and ignore navigation while a hook runs.
class Navigation {
  constructor () {
    this._back = []
    this._forward = []
    this._current = null
    this._pending = false
  }

  current () { return this._current }
  url () { return this._current?.url ?? null }
  hasBack () { return this._back.length > 0 }
  hasForward () { return this._forward.length > 0 }

  go (page, cb = () => {}) {
    if (this._pending) return cb(null)
    if (!page || !('url' in page)) throw new Error('Missing required `url` property')
    this._transition(page, () => {
      if (this._current) this._back.push(this._current)
      this.clearForward()
    }, cb)
  }

  back (cb) { this._previous(false, cb) }
  cancel (cb) { this._previous(true, cb) }

  _previous (cancel, cb = () => {}) {
    if (this._pending || !this.hasBack()) return cb(null)
    this._transition(this._back.at(-1), () => {
      this._back.pop()
      if (!cancel) this._forward.push(this._current)
    }, cb)
  }

  forward (cb = () => {}) {
    if (this._pending || !this.hasForward()) return cb(null)
    this._transition(this._forward.at(-1), () => {
      this._forward.pop()
      if (this._current) this._back.push(this._current)
    }, cb)
  }

  clearForward (url) {
    this._forward = url == null ? [] : this._forward.filter(page => page.url !== url)
  }

  backToFirst (cb = () => {}) {
    if (this._pending || !this.hasBack()) return cb(null)
    this.back(err => err ? cb(err) : this.backToFirst(cb))
  }

  _transition (page, commit, cb) {
    this._pending = true
    let settled = false
    const finish = err => {
      this._pending = false
      cb(err || null)
    }
    const loaded = err => {
      if (settled) return
      settled = true
      if (err) return finish(err)
      const previous = this._current
      commit()
      this._current = page
      let cleanup
      try {
        cleanup = previous?.destroy?.()
      } catch (err) {
        return finish(err)
      }
      if (cleanup?.then) cleanup.then(() => finish(), finish)
      else finish()
    }
    try {
      if (page.setup) page.setup(loaded)
      else loaded()
    } catch (err) {
      if (settled) throw err
      loaded(err)
    }
  }
}

module.exports = Navigation
