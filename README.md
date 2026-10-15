<h1 align="center">
  TorrentCat
</h1>

<p align="center">Stream torrents while they download, with a refreshed library and expanded playback options.</p>

<p align="center">
  <a href="https://github.com/eliaquin/webtorrent-desktop/actions/workflows/ci.yml"><img src="https://github.com/eliaquin/webtorrent-desktop/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/eliaquin/webtorrent-desktop/releases/latest"><img src="https://img.shields.io/github/release/eliaquin/webtorrent-desktop.svg" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license"></a>
</p>

TorrentCat is an independently maintained fork of [WebTorrent Desktop](https://github.com/webtorrent/webtorrent-desktop),
built on the work of WebTorrent, LLC and the [original contributors](AUTHORS.md).
TorrentCat focuses on the Mac experience, media playback and a modernized codebase.
It is not an official WebTorrent release and is not affiliated with or endorsed by
the upstream project.

## Download for Mac

| Your Mac | Latest signed and notarized installer |
| --- | --- |
| Apple Silicon (M-series) | **[Download for Apple Silicon](https://github.com/eliaquin/webtorrent-desktop/releases/latest/download/TorrentCat-mac-arm64.dmg)** |
| Intel | **[Download for Intel](https://github.com/eliaquin/webtorrent-desktop/releases/latest/download/TorrentCat-mac-x64.dmg)** |

Open the DMG and drag **TorrentCat** into **Applications**. To update, quit the
app and replace it; your downloads and preferences stay in place.

When upgrading from this fork’s WebTorrent app, quit WebTorrent before opening
TorrentCat. TorrentCat reuses the existing profile, torrent library and download
locations. Once it is installed, you can remove the old WebTorrent application
bundle; keep its application-support folder. Windows portable users should keep
their existing `Portable Settings` folder beside the new executable.

[Release notes, ZIP downloads and checksums](https://github.com/eliaquin/webtorrent-desktop/releases/latest).
These links always point to the latest published release; no GitHub account is needed.
Homebrew’s `webtorrent` cask installs the upstream project.

**Binary releases are macOS-only.** This fork does not generate, sign or distribute
Windows or Linux binaries. Their platform code and local build tools remain
available for anyone who wants to [compile from source](docs/DEVELOPMENT.md#package-locally).

## What TorrentCat adds

- **Refreshed library and preferences:** responsive poster shelves, search and
  status filters, per-file selection, visible stream/pause actions, and reorganized
  settings and navigation.
- **More playback options:** optional native VLC inside the app, plus the built-in
  player and external-player support. VLC can be installed after the app and
  detected without rebuilding or restarting.
- **Better subtitles and audio:** embedded text subtitles, visible track selection,
  subtitle language labels, optional FFmpeg setup, and cached AAC playback copies
  for audio the built-in player cannot decode.
- **Download-aware playback:** torrent progress in the player, improved download
  resume, and recovery when a saved download location is missing.
- **Update notifications:** checks at startup and every six hours, with **Download**,
  **Not now** and **Skip this version**. Prompts wait until you leave the player or
  close another dialog. **TorrentCat → Check for Updates…** checks on demand.
  Downloads open in your browser for manual installation.
- **Modernized internals:** React 19, Electron 44, WebTorrent 3, isolated sandboxed
  UI windows, a separate torrent/media process, updated dependencies and expanded
  automated tests.
- **Mac release automation:** patch versions, Intel and Apple Silicon builds,
  Developer ID signing, Apple notarization and permanent latest-download links.

AirPlay, Chromecast and DLNA casting have been removed from this fork.

## Playback setup

The built-in player is the default. For native VLC playback, install **VLC 3** in
Applications and select **Preferences → Playback → Video player → Native VLC
(experimental)**. This requires macOS 13+ and VLC matching the app’s architecture.
Keep VLC installed: its libraries are loaded from your VLC installation. After
installing it, open Preferences or return to the app window to refresh detection.
If native playback cannot start, the app explains why and uses the built-in player.

Embedded subtitle extraction, video posters and built-in-player audio conversion
use **FFmpeg/FFprobe**. The subtitle menu offers optional setup; with Homebrew:

```sh
brew install ffmpeg
```

For the built-in player, embedded text subtitles and audio conversion become
available after the selected file finishes downloading. Image subtitles and full
ASS styling are not supported by WebVTT conversion. Audio conversion preserves
the original torrent files for seeding. [Playback details](docs/DEVELOPMENT.md#playback-checks-and-dependencies).

## Build and contribute

Use Node.js 24 LTS (or 22.13+) and npm 10+:

```sh
git clone https://github.com/eliaquin/webtorrent-desktop.git
cd webtorrent-desktop
npm ci
npm start
```

See [development and local packaging](docs/DEVELOPMENT.md),
[Mac release automation](docs/RELEASING.md),
[security architecture](SECURITY-AUDIT.md) and
[dependency maintenance](DEPENDENCY-MAINTENANCE.md).
Please report TorrentCat issues in [this repository](https://github.com/eliaquin/webtorrent-desktop/issues).

## Privacy

Usage diagnostics stay local and bounded in memory; crash report uploads are
disabled. Update checks contact GitHub for this repository’s releases. Torrent
networking still connects to peers and trackers; local media endpoints bind only
to localhost.

## Credits and license

TorrentCat is derived from [WebTorrent Desktop](https://github.com/webtorrent/webtorrent-desktop)
by **WebTorrent, LLC**, Feross Aboukhadijeh and the many contributors listed in
[AUTHORS.md](AUTHORS.md). Their authorship, copyright notices and contribution
history are preserved. TorrentCat is maintained by [Eliaquin](https://github.com/eliaquin)
and is independent of the upstream project.

[MIT License](LICENSE). Copyright (c) WebTorrent, LLC.
Third-party components retain their respective licenses and notices.
