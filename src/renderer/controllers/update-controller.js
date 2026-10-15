const { dispatch } = require('../lib/dispatcher')

module.exports = class UpdateController {
  constructor (state, {
    check = () => require('electron').ipcRenderer.invoke('native:check-updates'),
    open = url => require('electron').shell.openExternal(url)
  } = {}) {
    this.state = state
    this.check = check
    this.open = open
    this.seen = new Set()
    this.pending = null
    this.request = 0
    this.checking = false
  }

  updateAvailable (update) {
    if (this.seen.has(update.version) || this.state.saved.skippedVersions?.includes(update.version)) return
    if (!this.pending?.manual) this.pending = { update, manual: false }
    this.maybeShow()
  }

  maybeShow () {
    if (!this.pending || this.state.modal) return
    if (!this.pending.manual && this.state.location.url() === 'player') return
    const { update } = this.pending
    this.pending = null
    if (update.status === 'available') this.seen.add(update.version)
    this.state.modal = { id: 'update-available-modal', ...update }
  }

  async checkForUpdates () {
    if (this.checking) return
    this.checking = true
    const request = ++this.request
    const checkingModal = { id: 'update-available-modal', status: 'checking' }
    if (!this.state.modal) this.state.modal = checkingModal
    let result
    try { result = await this.check() } catch { result = { status: 'error' } }
    if (request !== this.request) return
    this.checking = false
    if (this.state.modal?.id === 'update-available-modal' && this.state.modal.status === 'checking') this.state.modal = null
    this.pending = { update: result, manual: true } // Explicit checks include skipped versions.
    this.maybeShow()
    dispatch('update')
  }

  dismiss () {
    this.request++
    this.checking = false
    this.pending = null
    this.state.modal = null
  }

  skipVersion (version) {
    const skipped = this.state.saved.skippedVersions || []
    this.state.saved.skippedVersions = [...new Set([...skipped, version])]
    this.dismiss()
    dispatch('stateSave')
  }

  async download () {
    const modal = this.state.modal
    if (modal?.status !== 'available' || modal.opening) return
    modal.opening = true
    modal.downloadError = false
    try {
      await this.open(modal.downloadURL)
      if (this.state.modal === modal) this.dismiss()
    } catch {
      modal.opening = false
      modal.downloadError = true
    }
    dispatch('update')
  }
}
