<h1 align="center">
  <br>
  <a href="https://webtorrent.io">
    <img src="https://webtorrent.io/img/WebTorrent.png" alt="WebTorrent" width="200">
  </a>
  <br>
  WebTorrent Desktop
  <br>
  <br>
</h1>

<h4 align="center">The streaming torrent app. For Mac, Windows, and Linux.</h4>

<p align="center">
  <a href="https://discord.gg/cnXkm4Z"><img src="https://img.shields.io/discord/612575111718895616" alt="discord"></a>
  <a href="https://github.com/webtorrent/webtorrent-desktop/actions/workflows/ci.yml"><img src="https://github.com/webtorrent/webtorrent-desktop/actions/workflows/ci.yml/badge.svg" alt="GitHub CI action"></a>
  <a href="https://github.com/webtorrent/webtorrent-desktop/releases"><img src="https://img.shields.io/github/release/webtorrent/webtorrent-desktop.svg" alt="github release version"></a>
  <a href="https://github.com/webtorrent/webtorrent-desktop/releases"><img src="https://img.shields.io/github/downloads/webtorrent/webtorrent-desktop/total.svg" alt="github release downloads"></a>
  <a href="https://standardjs.com"><img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg" alt="Standard - JavaScript Style Guide"></a>
</p>

## Install

### Recommended Install

Download the latest version of WebTorrent Desktop from
[the official website](https://webtorrent.io/desktop/):

### [✨ Download WebTorrent Desktop ✨](https://webtorrent.io/desktop/)

### Advanced Install

- Download specific installer files from the [GitHub releases](https://github.com/webtorrent/webtorrent-desktop/releases) page.

- Use [Homebrew-Cask](https://github.com/caskroom/homebrew-cask) to install from the command line:

  ```
  $ brew install --cask webtorrent
  ```

- Try the (unstable) development version by cloning the Git repository. See the
  ["How to Contribute"](#how-to-contribute) instructions.

## Screenshots

<p align="center">
  <img src="https://webtorrent.io/img/screenshot-player3.png" alt="screenshot" align="center">
  <img src="https://webtorrent.io/img/screenshot-main.png" width="612" height="749" alt="screenshot" align="center">
</p>

## How to Contribute

### Get the code

Use Node.js 24 LTS (or Node.js 22.12+). Node.js 16 and 18 are no longer supported.

```
$ git clone https://github.com/webtorrent/webtorrent-desktop.git
$ cd webtorrent-desktop
$ npm install
```

### Run the app

```
$ npm start
```

### Watch the code

Restart the app automatically every time code changes. Useful during development.

```
$ npm run watch
```

### Run linters

```
$ npm test
```

### Security checks

```
$ npm run audit
$ npm run test-security
$ npm run test-subtitles
```

Subtitle tests require FFmpeg. Linux CI runs Electron tests under Xvfb.

The dependency audit was reduced from 67 affected packages (including five
critical) to zero known advisories on October 7, 2026. This includes development
and optional dependencies. npm advisories do not cover every possible bug or
external tools such as the system FFmpeg installation.

The application now runs Node APIs in isolated preloads, blocks page scripts,
navigation and popups, validates IPC senders, and protects media/caption servers
with random access tokens and Host/Origin checks. Preloads still require
`sandbox: false`; migrating their filesystem/network work to utility processes
would further reduce the impact of a future Chromium or preload compromise.

Legacy network packages use `vendor/ip-compat`, a small replacement for their IP
APIs built on `ipaddr.js`, rather than the unpatched `ip` dependency. Explicit
XML, protobuf, Browserslist and temporary-file overrides keep transitive packages
on patched versions; security regression tests cover the required legacy APIs.

### Run integration tests

Run the React UI interaction checks in Electron, without WebDriver:

```
$ npm run test-ui
```

These checks cover preferences, torrent creation, download toggling, modal keyboard
behavior, and native controls. They do not connect to torrent networks.

Run the existing screenshot integration suite:

```
$ npm run test-integration
```

The integration tests use Playwright and Tape. They click through the app, taking screenshots and
comparing each one to a reference. Why screenshots?

* Ad-hoc checking makes the tests a lot more work to write
* Even diffing the whole HTML is not as thorough as screenshot diffing. For example, it wouldn't
  catch an bug where hitting ESC from a video doesn't correctly restore window size.
* Chrome's own integration tests use screenshot diffing iirc
* Small UI changes will break a few tests, but the fix is as easy as deleting the offending
  screenshots and running the tests, which will recreate them with the new look.
* The resulting Github PR will then show, pixel by pixel, the exact UI changes that were made! See
  https://github.com/blog/817-behold-image-view-modes

For MacOS, you'll need a Retina screen for the integration tests to pass. Your screen should have
the same resolution as a 2018 MacBook Pro 13".

For Windows, you'll need Windows 10 with a 1366x768 screen.

When running integration tests, keep the mouse on the edge of the screen and don't touch the mouse
or keyboard while the tests are running.

### Package the app

Builds app binaries for Mac, Linux, and Windows.

```
$ npm run package
```

To build for one platform:

```
$ npm run package -- [platform] [options]
```

Where `[platform]` is `darwin`, `linux`, `win32`, or `all` (default).

The following optional arguments are available:

- `--sign` - Sign the application (Mac, Windows)
- `--package=[type]` - Package single output type.
   - `deb` - Debian package
   - `rpm` - RedHat package
   - `zip` - Linux zip file
   - `dmg` - Mac disk image
   - `exe` - Windows installer
   - `portable` - Windows portable app
   - `all` - All platforms (default)

Note: Even with the `--package` option, the auto-update files (.nupkg for Windows,
-darwin.zip for Mac) will always be produced.

#### Windows build notes

The Windows app can be packaged from **any** platform.

Note: Windows code signing only works from **Windows**, for now.

Note: To package the Windows app from non-Windows platforms,
[Wine](https://www.winehq.org/) and [Mono](https://www.mono-project.com/) need
to be installed. For example on Mac, first install
[XQuartz](http://www.xquartz.org/), then run:

```
$ brew install wine mono
```

(Requires the [Homebrew](http://brew.sh/) package manager.)

#### Mac build notes

Signed builds require `APPLE_SIGNING_IDENTITY` and an `APPLE_NOTARY_PROFILE`
created with `xcrun notarytool store-credentials`. Unsigned local builds do not
require Apple credentials.

The Mac app can only be packaged from **macOS**.

#### Linux build notes

The Linux app can be packaged from **any** platform.

If packaging from Mac, install system dependencies with Homebrew by running:

```
npm run install-system-deps
```
#### Recommended readings to start working in the app

Electron (Framework to make native apps for Windows, OSX and Linux in Javascript):
https://electronjs.org/docs/tutorial/quick-start

React.js (Framework to work with Frontend UI):
https://react.dev/learn

UI controls are local React components backed by native HTML controls in
`src/renderer/components/ui/`, styled in `static/main.css`. No component framework
or theme provider is required.

Embedded text subtitles (including ASS/SSA in MKV files) are extracted to WebVTT
when the playing file has finished downloading. This requires `ffmpeg` and
`ffprobe` on PATH; macOS builds also look in the standard Homebrew locations.
On macOS, install them with `brew install ffmpeg`. Image subtitles such as PGS
and VobSub are not supported. WebVTT conversion preserves text and timing, but
does not reproduce ASS fonts, positioning, or animation.

### Privacy

WebTorrent Desktop collects some basic usage stats to help us make the app better.
For example, we track how well the play button works. How often does it succeed?
Time out? Show a missing codec error?

The app never sends any personally identifying information, nor does it track which
torrents you add.

## License

MIT. Copyright (c) [WebTorrent, LLC](https://webtorrent.io).
