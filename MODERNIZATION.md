# Modernization work

Scope accepted: complete the cleanup proposed in this conversation, preserving
existing torrent data, settings, playback, subtitles and casting controls.

- [x] Separate ordinary build cleanup from explicit application reset.
- [x] Remove obsolete PropTypes and unused dependencies; replace small wrappers
  with built-in APIs where behavior is equivalent.
- [x] Remove `@electron/remote` and expose explicit application APIs over IPC.
- [x] Replace the hidden torrent browser window with a utility process and enable
  sandboxing in the UI windows.
- [x] Replace global mutable state and whole-app interval rendering with a
  subscription-based store and targeted updates.
- [x] Upgrade WebTorrent from 1.x to the current 3.x API, verifying transfer,
  streaming, file selections, torrent creation and resume behavior.
- [x] Consolidate integration testing around Playwright and local fixtures.
- [x] Update personal-fork metadata, release documentation, updater and telemetry.
- [x] Complete security/UI/playback checks and rebuild the installed app and
  release artifacts; preserve an installed-app backup.

Completion requires implementation and meaningful verification for every item;
dependency audit results alone do not prove the architectural changes.

## Verification

Completed on October 7, 2026. Version 0.25.0 uses Electron 44.7.0,
its bundled Node 24.21.0, React 19.3.0 and WebTorrent 3.0.21.

- A clean Node 24 installation and `npm run test-all` passed: lint, guarded
  cleanup, scoped store updates, local peer transfers and verified resume,
  security, UI, embedded subtitles and native application integration.
- Security and integration tests also passed against the packaged macOS arm64
  application, including video/audio, seeking, captions, posters, byte ranges,
  export, atomic profile persistence, sandboxed file paths and simulated casting.
- `npm audit --audit-level=low` reports zero known vulnerabilities.
- The installed `/Applications/WebTorrent.app` is version 0.25.0 and passes
  `codesign --verify --deep --strict`. Signing is ad hoc for local use.
- Signed ZIP and DMG artifacts are in `dist/`; their SHA-256 checksums, ZIP
  integrity and DMG image checksum were verified.
- The previous installed app and 0.24 artifacts are preserved in
  `dist/backups/before-modernization-20261007-193441`. User settings and
  downloaded data were retained.

Physical casting devices and Windows/Linux packages still require platform
smoke testing. Public distribution requires developer signing and notarization;
the release workflow creates a draft for review.
