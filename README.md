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
  <a href="https://github.com/eliaquin/webtorrent-desktop/actions/workflows/ci.yml"><img src="https://github.com/eliaquin/webtorrent-desktop/actions/workflows/ci.yml/badge.svg" alt="GitHub CI action"></a>
  <a href="https://github.com/eliaquin/webtorrent-desktop/releases"><img src="https://img.shields.io/github/release/eliaquin/webtorrent-desktop.svg" alt="github release version"></a>
  <a href="https://github.com/eliaquin/webtorrent-desktop/releases"><img src="https://img.shields.io/github/downloads/eliaquin/webtorrent-desktop/total.svg" alt="github release downloads"></a>
  <a href="https://standardjs.com"><img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg" alt="Standard - JavaScript Style Guide"></a>
</p>

This is Eliaquin's personal fork of [WebTorrent Desktop](https://github.com/webtorrent/webtorrent-desktop),
with React 19, Electron 44 and WebTorrent 3. Original authorship and license are preserved.

## Install

Download this fork's builds from [its GitHub releases](https://github.com/eliaquin/webtorrent-desktop/releases)
when a release is available, or build locally using the instructions below.
Homebrew's `webtorrent` cask installs the upstream project, not this personal fork.

Embedded subtitle extraction and video posters use system FFmpeg. On macOS,
install it with `brew install ffmpeg`.

## How to Contribute

### Get the code

Use Node.js 24 LTS (or Node.js 22.12+). Node.js 16 and 18 are no longer supported.

```
$ git clone https://github.com/eliaquin/webtorrent-desktop.git
$ cd webtorrent-desktop
$ npm ci
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

The React UI runs in sandboxed, isolated windows. A small preload exposes
allowlisted application commands, requests and events. Filesystem operations and
native dialogs run in the main process; torrent networking, casting discovery,
subtitle extraction and posters run in a utility process. IPC sender/frame checks
and token-protected media endpoints remain in place.

Legacy casting packages use `vendor/ip-compat` backed by `ipaddr.js`. Torrent
blocklists use `vendor/ip-set-compat` backed by Node's IPv4/IPv6 `BlockList`; this
also avoids the upstream package's pnpm-only install script. Parser overrides
keep legacy casting dependencies on patched XML/protobuf versions. Tests cover
these compatibility APIs. See [SECURITY-AUDIT.md](SECURITY-AUDIT.md).

### Run all checks

```sh
npm run test-all
```

Tests cover store subscriptions, local TCP peers and verified resume, security,
React component interactions, subtitle conversion/races, and the full packaged
app flow through Playwright. Integration tests create local media and temporary
profiles; they do not depend on public torrents or screen-specific golden images.
Linux CI uses Xvfb. `WEBTORRENT_PACKAGED_APP` can target a packaged executable for
security and integration checks.

### Architecture

- `src/main/`: native windows, IPC, OS integration and atomic profile persistence.
- `src/engine/`: utility-process torrent, casting and media processing services.
- `src/renderer/`: browser-only React UI and scoped state subscriptions.
- `src/shared/`: state model, shared helpers and IPC channel declarations.
- `bin/build.js`: esbuild compilation, UI bundling and sandboxed preload bundles.

UI state belongs to a private store. Components subscribe to the branches they
use; download progress does not rerender the preferences page. Media DOM updates
run after React commits, with playback events driving progress and volume.

Usage diagnostics remain local and bounded in memory; crash uploads are disabled.
Update checks use this fork's GitHub releases and require manual installation.

### Cleanup

`npm run clean` removes only generated build files. Downloads, saved settings and
build backups are preserved. An intentional profile reset requires quitting the
app and running `npm run reset-app -- --confirm-profile-reset`.

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
