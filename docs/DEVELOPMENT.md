# Development

[Back to README](../README.md)

## Get the code

Use Node.js 24 LTS (or Node.js 22.13+). Node.js 16 and 18 are no longer supported.

```
$ git clone https://github.com/eliaquin/webtorrent-desktop.git
$ cd webtorrent-desktop
$ npm ci
```

## Run the app

```
$ npm start
```

## Watch the code

Restart the app automatically every time code changes. Useful during development.

```
$ npm run watch
```

## Run linters

```
$ npm test
```

## Security checks

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
native dialogs run in the main process; torrent networking,
subtitle extraction and posters run in a utility process. IPC sender/frame checks
and token-protected media endpoints remain in place.

Torrent discovery uses `vendor/ip-compat` backed by `ipaddr.js`. Torrent
blocklists use `vendor/ip-set-compat` backed by Node's IPv4/IPv6 `BlockList`; this
also avoids the upstream package's pnpm-only install script. Parser overrides
keep remaining dependencies on patched XML versions. Tests cover
these compatibility APIs. See [SECURITY-AUDIT.md](../SECURITY-AUDIT.md).

## Run all checks

```sh
npm run test-all
```

Tests cover store subscriptions, local TCP peers and verified resume, security,
React component interactions, subtitle conversion/races, and the full packaged
app flow through Playwright. Integration tests create local media and temporary
profiles; they do not depend on public torrents or screen-specific golden images.
Linux CI uses Xvfb. `WEBTORRENT_PACKAGED_APP` can target a packaged executable for
security and integration checks.

## Architecture

- `src/main/`: native windows, IPC, OS integration and atomic profile persistence.
- `src/engine/`: utility-process torrent and media processing services.
- `src/renderer/`: browser-only React UI and scoped state subscriptions.
- `src/shared/`: state model, shared helpers and IPC channel declarations.
- `bin/build.js`: esbuild compilation, UI bundling and sandboxed preload bundles.

UI state belongs to a private store. Components subscribe to the branches they
use; download progress does not rerender the preferences page. Media DOM updates
run after React commits, with playback events driving progress and volume.

The library uses a responsive media shelf with poster previews, search, status
filters and visible stream/pause controls. Open a poster or its Files button to
choose individual files; More actions opens the native torrent menu. Add torrent
accepts magnet links and torrent addresses or opens the native torrent-file picker.
Search and filters are local to the library view and reset when leaving it.

Usage diagnostics remain local and bounded in memory; crash uploads are disabled.
Update checks use this fork's GitHub releases and require manual installation.

## Cleanup

`npm run clean` removes only generated build files. Downloads, saved settings and
build backups are preserved. An intentional profile reset requires quitting the
app and running `npm run reset-app -- --confirm-profile-reset`.

## Package locally

The platform code and packaging tools remain available for macOS, Windows and
Linux. This fork only distributes signed, notarized **macOS** binaries; Windows
and Linux are source-build options without maintained binary releases.

Choose the platform explicitly (output goes into `dist/`):

```sh
npm run package -- darwin --arch arm64
npm run package -- darwin --arch x64
npm run package -- win32 --arch x64
npm run package -- linux --arch x64
```

macOS packaging requires a Mac. Unsigned local Mac builds need no Apple
credentials. See [Mac releases](RELEASING.md) for signing and notarization.
The native VLC bridge requires Apple's command line tools (`clang++`); VLC itself
is not needed at build time. Headers are pinned in `native/vendor/libvlc`, and the
bridge is compiled by `npm run build`. `WEBTORRENT_VLC_PATH` can select a custom
VLC `Contents/MacOS` directory at runtime.

Windows packaging uses `electron-winstaller`; cross-packaging requires Wine and
Mono. Linux DEB/RPM packaging requires `fakeroot`, `dpkg` and `rpm`; on macOS,
`npm run install-system-deps` installs them through Homebrew.

`--package=TYPE` limits the output (`dmg`, `exe`, `portable`, `deb`, `rpm`, or `zip`,
depending on the platform). With no platform, the legacy packaging command tries
all platforms, so the explicit commands above are preferred for local builds.

## Playback checks and dependencies

Run `npm run test-native-player` for native session and authorization checks.
`npm run test-native-integration` requires a Mac with VLC and FFmpeg and exercises
torrent playback, controls, subtitles, fullscreen and teardown.

`npm run test-maintenance` checks navigation, VLC discovery, archive preservation
and lint configuration. UI controls are local React components backed by native
HTML in `src/renderer/components/ui/`, styled in `static/main.css`.

Embedded text subtitles are converted to WebVTT after the selected file finishes
downloading. This preserves text and timing, but not ASS fonts, positioning or
animation. Image subtitles such as PGS and VobSub are not supported by that path.

When Chromium cannot decode an audio track, FFmpeg can create an AAC playback
copy after the selected file finishes downloading. The original video packets
are retained; playback resumes at the same position. Copies are reused from
`AudioCache` in the application configuration directory and may be deleted while
the app is closed. Original torrent files stay intact for seeding. Failures offer
an external-player fallback, which receives the original torrent stream.

See [dependency maintenance](../DEPENDENCY-MAINTENANCE.md) for local replacements,
retained dependencies and the removal of AirPlay, Chromecast and DLNA casting.
