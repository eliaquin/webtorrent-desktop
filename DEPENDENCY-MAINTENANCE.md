# Dependency maintenance review — October 13, 2026

Reviewed all direct runtime, development and optional dependencies. The one-year cutoff is October 13, 2025. npm latest-version publication dates identify candidates; the most recent default-branch GitHub commit is a secondary activity signal, not proof of code quality or support. Dates below are UTC. Transitive packages are covered by the lockfile and npm audit, not an exhaustive upstream maintenance audit.

## Changes applied

- Removed `airplayer`, `chromecasts` and `dlnacasts` and all app casting functionality.
- Upgraded `bitfield` from 4.2.0 to 5.0.1 and `chokidar` from 4.0.3 to 5.0.0. Both support the repository's Node requirement; the Electron runtime and esbuild bundle can consume their ESM exports.
- Replaced `drag-drop`, `languagedetect`, `srt-to-vtt` and `prettier-bytes` locally; removed `network-address` and the casting-only protobuf override.
- Restricted playback HTTP endpoints to loopback and removed casting IPC channels and receiver-origin exceptions. Torrent peer networking remains separate.
- Added regression coverage for drop handling, subtitle conversion/labels, byte formatting, bitfield rendering and Chokidar folder monitoring.

## Libraries with releases older than one year

| Library | Latest release | Latest repository commit | Decision and substitution evaluation |
| --- | --- | --- | --- |
| [chromecasts](https://registry.npmjs.org/chromecasts) | 1.10.2 · 2021-10-04 | [2021-10-04](https://github.com/mafintosh/chromecasts/commits) | Removed, including discovery, controls, IPC, UI and HTTP receiver exceptions. |
| [dlnacasts](https://registry.npmjs.org/dlnacasts) | 0.1.0 · 2016-05-13 | [2016-05-13](https://github.com/grunjol/dlnacasts/commits) | Removed together with the remaining casting implementation. |
| [drag-drop](https://registry.npmjs.org/drag-drop) | 7.2.0 · 2021-06-30 | [2021-06-30](https://github.com/feross/drag-drop/commits) | Replaced with local DOM event handling and paginated directory traversal; original File objects preserve Electron path lookup. |
| [languagedetect](https://registry.npmjs.org/languagedetect) | 2.0.0 · 2019-11-05 | [2020-07-09](https://github.com/FGRibreau/node-language-detect/commits) | Replaced with filename language tags, Intl.DisplayNames, Unicode script checks and conservative word hints. Ambiguous captions keep the filename. |
| [location-history](https://registry.npmjs.org/location-history) | 1.1.2 · 2020-05-10 | [2020-05-10](https://github.com/feross/location-history/commits) | Retained for now. Prefer an app-owned navigation state machine over a new router dependency. Replacement must preserve asynchronous setup/destroy, cancellation, failed navigation and back/forward stacks; a separate navigation migration is safer than bundling it with dependency removal. |
| [network-address](https://registry.npmjs.org/network-address) | 1.1.2 · 2017-01-17 | [2017-01-17](https://github.com/mafintosh/network-address/commits) | Removed. The media server binds to 127.0.0.1; no LAN URL is needed after casting removal. |
| [pathe](https://registry.npmjs.org/pathe) | 2.0.3 · 2025-02-11 | [2026-07-08](https://github.com/unjs/pathe/commits) | Retained: recent repository activity despite an older release. Browser path semantics are still needed by the sandboxed UI. |
| [prettier-bytes](https://registry.npmjs.org/prettier-bytes) | 1.0.4 · 2017-05-15 | [2017-05-15](https://github.com/Flet/prettier-bytes/commits) | Replaced with a local decimal-unit formatter, retaining the existing UI rounding. |
| [srt-to-vtt](https://registry.npmjs.org/srt-to-vtt) | 1.1.3 · 2018-08-16 | [2018-08-16](https://github.com/mafintosh/srt-to-vtt/commits) | Replaced with bounded file reading, TextDecoder and local cue conversion. Tested UTF-8, BOM-marked UTF-16 and Windows-1252; unmarked legacy encodings are not auto-detected. |
| [vlc-command](https://registry.npmjs.org/vlc-command) | 1.2.0 · 2019-08-23 | [2019-08-23](https://github.com/feross/vlc-command/commits) | Retained for now. Prefer app-owned executable lookup using fs.access, PATH and Windows registry queries, with explicit command/argument separation. Verify standard, custom and Flatpak VLC installs on macOS, Windows and Linux before replacing the current discovery contract. |
| [winreg](https://registry.npmjs.org/winreg) | 1.2.5 · 2023-10-20 | [2023-10-20](https://github.com/fresc81/node-winreg/commits) | Retained for now. Prefer a narrow reg.exe adapter for file/protocol registration; Electron protocol APIs alone do not replace all current registry entries. Requires Windows tests for install/uninstall, registry views, spaces and quoting before migration. |
| [cross-zip](https://registry.npmjs.org/cross-zip) | 4.0.1 · 2024-02-12 | [2024-02-12](https://github.com/feross/cross-zip/commits) | Retained for now. Prefer the packager archive API or a maintained ZIP writer. Verify Windows executables, macOS symlinks/modes and large archives before changing the distribution format. |
| [minimist](https://registry.npmjs.org/minimist) | 1.2.8 · 2023-02-09 | [2025-12-29](https://github.com/minimistjs/minimist/commits) | Retained: recent repository activity despite an older release. Node util.parseArgs is a viable later simplification, but argument compatibility is not part of the requested library removals. |
| [standard](https://registry.npmjs.org/standard) | 17.1.2 · 2024-09-13 | [2025-07-11](https://github.com/standard/standard/commits) | Retained for now. Prefer current ESLint with an explicit repository style configuration. This is development-only; replacement should preserve JSX/CommonJS/browser globals and equivalent rule coverage without unrelated formatting churn. |

`airplayer` was removed explicitly; its former dependency was a GitHub fork/ref rather than an npm version. No statistical language-detection model is bundled by the replacement. Filename tags work for languages supported by Intl; content hints cover English, Spanish, French, German, Italian, Portuguese, Dutch, Russian, Japanese, Korean, Greek and Hebrew. Other or ambiguous text keeps its filename.

## Remaining direct dependencies with recent releases

Active projects were evaluated and retained; only the two explicitly requested version upgrades are applied. An active upstream does not imply that every pinned major is the latest.

| Library | Version retained/selected | Latest stable | Latest publication |
| --- | --- | --- | --- |
| [bitfield](https://registry.npmjs.org/bitfield) | 5.0.1 | 5.0.1 | 2026-03-17 |
| [chokidar](https://registry.npmjs.org/chokidar) | 5.0.0 | 5.0.0 | 2025-11-25 |
| [create-torrent](https://registry.npmjs.org/create-torrent) | 6.1.3 | 6.1.3 | 2026-07-23 |
| [iso-639-1](https://registry.npmjs.org/iso-639-1) | 2.1.15 | 3.1.6 | 2026-07-02 |
| [music-metadata](https://registry.npmjs.org/music-metadata) | 12.0.0 | 12.2.0 | 2026-10-12 |
| [parse-torrent](https://registry.npmjs.org/parse-torrent) | 11.0.24 | 11.0.24 | 2026-07-26 |
| [react](https://registry.npmjs.org/react) | 19.3.0 | 19.3.0 | 2026-09-09 |
| [react-dom](https://registry.npmjs.org/react-dom) | 19.3.0 | 19.3.0 | 2026-09-09 |
| [semver](https://registry.npmjs.org/semver) | 7.8.5 | 7.8.5 | 2026-06-19 |
| [webtorrent](https://registry.npmjs.org/webtorrent) | 3.0.21 | 3.0.21 | 2026-07-27 |
| [@electron/notarize](https://registry.npmjs.org/@electron/notarize) | 3.1.1 | 3.1.2 | 2026-10-09 |
| [@electron/osx-sign](https://registry.npmjs.org/@electron/osx-sign) | 2.7.1 | 2.7.1 | 2026-09-28 |
| [@electron/packager](https://registry.npmjs.org/@electron/packager) | 20.3.0 | 20.3.0 | 2026-08-11 |
| [electron](https://registry.npmjs.org/electron) | 44.7.0 | 44.7.2 | 2026-10-14 |
| [electron-winstaller](https://registry.npmjs.org/electron-winstaller) | 5.4.4 | 5.4.4 | 2026-07-01 |
| [esbuild](https://registry.npmjs.org/esbuild) | 0.28.2 | 0.28.2 | 2026-08-08 |
| [node-api-headers](https://registry.npmjs.org/node-api-headers) | 1.9.0 | 1.9.0 | 2026-05-22 |
| [open](https://registry.npmjs.org/open) | 8.4.2 | 11.0.4 | 2026-09-14 |
| [playwright](https://registry.npmjs.org/playwright) | 1.64.0 | 1.64.0 | 2026-10-07 |
| [plist](https://registry.npmjs.org/plist) | 3.1.1 | 5.0.0 | 2026-05-03 |
| [electron-installer-debian](https://registry.npmjs.org/electron-installer-debian) | 4.0.0 | 4.0.0 | 2026-06-24 |
| [electron-installer-redhat](https://registry.npmjs.org/electron-installer-redhat) | 4.0.0 | 4.0.0 | 2026-06-29 |

## Validation and limits

`npm run test-all` passed, including the full npm audit with zero known vulnerabilities. The lockfile contains 145 fewer packages, with no newly added packages. Tests use temporary profiles and local torrent fixtures. `test-dependency-helpers` covers local subtitle and byte-formatting helpers; Electron UI checks cover native drop events and bitfield ranges; integration checks exercise production folder watching, actual media playback, drag/drop path handling and disabled casting controls.

Windows registry integration, Windows/Linux packaging and physical VLC installations still need checks on their target platforms before the retained platform wrappers are migrated.
