/* globals document */

const { _electron } = require('playwright')

// Small Playwright adapter for the existing screenshot scenarios.
module.exports = class Application {
  constructor (options) {
    this.options = options
    this.client = {
      waitUntilWindowLoaded: () => this.page.waitForLoadState(),
      windowByIndex: async () => {
        if (!this.application.windows().some(page => page.url().endsWith('/main.html'))) {
          await this.application.waitForEvent('window', { predicate: page => page.url().endsWith('/main.html') })
        }
        this.page = this.application.windows().find(page => page.url().endsWith('/main.html')) || this.page
      },
      waitUntilTextExists: (selector, text, timeout = 30000) => this.page.waitForFunction(({ selector, text }) => Array.from(document.querySelectorAll(selector)).some(el => el.textContent.includes(text)), { selector, text }, { timeout }),
      click: selector => this.page.locator(selector).first().click(),
      moveToObject: selector => this.page.locator(selector).first().hover()
    }
    this.webContents = {
      executeJavaScript: code => this.application.evaluate(({ BrowserWindow }, code) => {
        const document = code === 'testOfflineMode()' ? '/webtorrent.html' : '/main.html'
        const win = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().endsWith(document))
        return win.webContents.executeJavaScriptInIsolatedWorld(999, [{ code }])
      }, code),
      getTitle: () => this.page.title()
    }
    this.browserWindow = {
      focus: () => this.page.bringToFront(),
      getTitle: () => this.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(win => win.webContents.getURL().endsWith('/main.html')).getTitle()),
      capturePage: () => this.page.screenshot()
    }
  }

  async start () {
    this.application = await _electron.launch({
      executablePath: require('electron'),
      args: this.options.args,
      env: { ...process.env, ...this.options.env },
      timeout: 30000
    })
    this.page = this.application.windows().find(page => page.url().endsWith('/main.html')) || await this.application.firstWindow()
    this.page.setDefaultTimeout(30000)
    return this
  }

  async stop () {
    if (this.application) await this.application.close()
  }
}
