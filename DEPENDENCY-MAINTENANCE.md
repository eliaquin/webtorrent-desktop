# Dependency maintenance review — October 13, 2026

Reviewed all direct runtime, development and optional dependencies. The one-year cutoff is October 13, 2025. npm latest-version publication dates identify candidates; the most recent default-branch GitHub commit is a secondary activity signal, not proof of code quality or support. Dates below are UTC. Transitive packages are covered by the lockfile and npm audit, not an exhaustive upstream maintenance audit.

## Changes applied

- Removed `airplayer`, `chromecasts` and `dlnacasts` and all app casting functionality.
- Upgraded `bitfield` from 4.2.0 to 5.0.1 and `chokidar` from 4.0.3 to 5.0.0. Both support the repository's Node requirement; the Electron runtime and esbuild bundle can consume their ESM exports.
- Replaced `drag-drop`, `languagedetect`, `srt-to-vtt` and `prettier-bytes` locally; removed `network-address` and the casting-only protobuf override.
- Restricted playback HTTP endpoints to loopback and removed casting IPC channels and receiver-origin exceptions. Torrent peer networking remains separate.
- Added regression coverage for drop handling, subtitle conversion/labels, byte formatting, bitfield rendering and Chokidar folder monitoring.

## Follow-up replacement in 0.27.1

- Replaced `location-history` with app-owned navigation. Page hooks keep their load-before-destroy order; failed loads preserve back/forward stacks, cancellation discards the current page, and pending hooks block overlapping transitions.
- Replaced `vlc-command` with executable lookup using filesystem checks, macOS application bundles, Windows registry/install directories and PATH. Flatpak uses separate executable/argument fields, including during launch. Custom external player paths remain supported.
- Replaced `cross-zip` with native archive tools: macOS `ditto`, Unix `zip`, and Windows .NET ZIP creation through PowerShell. Temporary output protects existing archives from failed builds and removes stale entries on rebuild. User paths never become PowerShell source.
- Replaced `standard` and its old ESLint/plugin tree with ESLint 10.12.0, ESLint Stylistic 5.10.0, ESLint React 5.26.5, import-x 4.17.1, Node plugin 18.4.1 and Promise plugin 7.3.0. These releases were published within the last year. TypeScript 6.0.3 is a development-only dependency for the React linter's JavaScript compiler API; TypeScript 7 does not provide that API compatibly. Globals 17.13.0 supplies runtime names.
- The former Standard base/style rules are explicit in `bin/lint-rules.json`, with the original MIT license retained. ESLint 10 checks JSX references directly; current React checks cover list keys, deprecated lifecycle methods, state mutation, child/HTML conflicts and unsafe link targets. A few legacy React conventions (handler names, boolean/fragment shorthand, duplicate JSX props, string refs, `isMounted` and class render-return checks) are not carried over. The configured rule set is tested; this is not a claim of exact rule-for-rule equivalence. Only two unused React imports and three JSX indentation blocks changed.
- The follow-up lockfile has 125 fewer package entries than 0.27.0 (611 to 486), including development tools and platform-specific optional packages. The four replaced dependencies are absent throughout the lockfile.
- Retained `winreg` as the remaining inactive direct dependency. Replacing Windows association writes and ownership-sensitive uninstall behavior requires a real Windows test environment. The current adapter also remains the Windows registry reader for VLC discovery. `pathe` and `minimist` still have recent repository activity and are retained.

Implementation references: [ESLint flat-config migration](https://eslint.org/docs/latest/use/configure/migration-guide), [ESLint React migration](https://eslint-react.xyz/docs/migrating-from-eslint-plugin-react), and [ESLint Stylistic rules](https://eslint.style/rules). New versions and publication dates were checked against the npm registry.

## Libraries with releases older than one year

| Library | Latest release | Latest repository commit | Decision and substitution evaluation |
| --- | --- | --- | --- |
| [chromecasts](https://registry.npmjs.org/chromecasts) | 1.10.2 · 2021-10-04 | [2021-10-04](https://github.com/mafintosh/chromecasts/commits) | Removed, including discovery, controls, IPC, UI and HTTP receiver exceptions. |
| [dlnacasts](https://registry.npmjs.org/dlnacasts) | 0.1.0 · 2016-05-13 | [2016-05-13](https://github.com/grunjol/dlnacasts/commits) | Removed together with the remaining casting implementation. |
| [drag-drop](https://registry.npmjs.org/drag-drop) | 7.2.0 · 2021-06-30 | [2021-06-30](https://github.com/feross/drag-drop/commits) | Replaced with local DOM event handling and paginated directory traversal; original File objects preserve Electron path lookup. |
| [languagedetect](https://registry.npmjs.org/languagedetect) | 2.0.0 · 2019-11-05 | [2020-07-09](https://github.com/FGRibreau/node-language-detect/commits) | Replaced with filename language tags, Intl.DisplayNames, Unicode script checks and conservative word hints. Ambiguous captions keep the filename. |
| [location-history](https://registry.npmjs.org/location-history) | 1.1.2 · 2020-05-10 | [2020-05-10](https://github.com/feross/location-history/commits) | Replaced in 0.27.1 with app-owned navigation and regression tests for hooks, history, cancellation, failures and concurrent navigation. |
| [network-address](https://registry.npmjs.org/network-address) | 1.1.2 · 2017-01-17 | [2017-01-17](https://github.com/mafintosh/network-address/commits) | Removed. The media server binds to 127.0.0.1; no LAN URL is needed after casting removal. |
| [pathe](https://registry.npmjs.org/pathe) | 2.0.3 · 2025-02-11 | [2026-07-08](https://github.com/unjs/pathe/commits) | Retained: recent repository activity despite an older release. Browser path semantics are still needed by the sandboxed UI. |
| [prettier-bytes](https://registry.npmjs.org/prettier-bytes) | 1.0.4 · 2017-05-15 | [2017-05-15](https://github.com/Flet/prettier-bytes/commits) | Replaced with a local decimal-unit formatter, retaining the existing UI rounding. |
| [srt-to-vtt](https://registry.npmjs.org/srt-to-vtt) | 1.1.3 · 2018-08-16 | [2018-08-16](https://github.com/mafintosh/srt-to-vtt/commits) | Replaced with bounded file reading, TextDecoder and local cue conversion. Tested UTF-8, BOM-marked UTF-16 and Windows-1252; unmarked legacy encodings are not auto-detected. |
| [vlc-command](https://registry.npmjs.org/vlc-command) | 1.2.0 · 2019-08-23 | [2019-08-23](https://github.com/feross/vlc-command/commits) | Replaced in 0.27.1 with executable/PATH lookup, existing Windows registry queries and separate Flatpak launcher arguments. Lookup and launch contracts are tested without requiring physical VLC installs. |
| [winreg](https://registry.npmjs.org/winreg) | 1.2.5 · 2023-10-20 | [2023-10-20](https://github.com/fresc81/node-winreg/commits) | Retained for now. Prefer a narrow reg.exe adapter for file/protocol registration; Electron protocol APIs alone do not replace all current registry entries. Requires Windows tests for install/uninstall, registry views, spaces and quoting before migration. |
| [cross-zip](https://registry.npmjs.org/cross-zip) | 4.0.1 · 2024-02-12 | [2024-02-12](https://github.com/feross/cross-zip/commits) | Replaced in 0.27.1 with native platform archive tools. macOS and Unix archive/extract tests verify contents, symlinks, executable modes and failed-build preservation. Windows command construction is tested; native Windows ZIP execution remains a platform check. |
| [minimist](https://registry.npmjs.org/minimist) | 1.2.8 · 2023-02-09 | [2025-12-29](https://github.com/minimistjs/minimist/commits) | Retained: recent repository activity despite an older release. Node util.parseArgs is a viable later simplification, but argument compatibility is not part of the requested library removals. |
| [standard](https://registry.npmjs.org/standard) | 17.1.2 · 2024-09-13 | [2025-07-11](https://github.com/standard/standard/commits) | Replaced in 0.27.1 with ESLint 10, an explicit flat configuration and maintained plugins. See the migration scope above. |

`airplayer` was removed explicitly; its former dependency was a GitHub fork/ref rather than an npm version. No statistical language-detection model is bundled by the replacement. Filename tags work for languages supported by Intl; content hints cover English, Spanish, French, German, Italian, Portuguese, Dutch, Russian, Japanese, Korean, Greek and Hebrew. Other or ambiguous text keeps its filename.

## Deprecated transitive packages still retained

The clean 0.27.1 install also exposed deprecated transitive packages. They were traced with `npm ls`; a major-version override is not a safe drop-in substitution for these APIs/install scripts:

- `glob` 7 / `inflight` and `rimraf` 2 come from Debian/Windows installer tooling (`electron-installer-common`, older nested ASAR tooling, and `temp`). Replace them through an installer migration or upstream update, with Windows/Linux artifact validation. macOS packaging uses current ASAR tooling and the new archive helper.
- `prebuild-install` comes from `node-datachannel` through WebTorrent's WebRTC transport. Replacing its native-addon installation mechanism requires upstream support and native build checks; disabling the transport would remove app functionality.
- `node-domexception` comes from `node-fetch` through `parse-torrent`'s fetch ponyfill. The practical replacement is upstream native fetch/DOMException use; a local override would need to reproduce Blob and stream compatibility for third-party consumers.

These are retained transitively, not reported as maintained. The complete npm audit still reports zero known vulnerabilities. This remains a direct-dependency review plus evaluation of the observed deprecation warnings, not an exhaustive review of every transitive repository.

## Remaining direct dependencies with recent releases

Active runtime projects were evaluated and retained; the previous runtime upgrades and the follow-up lint tool replacements are applied. An active upstream does not imply that every pinned major is the latest.

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

The 0.27.1 follow-up passed `npm run test-all`, including `test-maintenance`, security, UI, media, torrent integration and a zero-finding npm audit. The new maintenance checks also run in CI. Windows registry integration, native Windows archive execution, Windows/Linux packaging and physical VLC/Flatpak installations still need checks on their target platforms.
