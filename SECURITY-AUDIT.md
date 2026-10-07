# Security remediation — October 7, 2026

The full npm dependency audit initially identified 67 affected packages: five
critical, 40 high, 20 moderate and two low. After remediation, both `npm audit`
and `npm audit --omit=dev` report **zero known vulnerabilities**. These are
affected-package counts, not counts of distinct CVEs. No audit exclusions or
severity filters were used to achieve this result.

## Dependency changes

| Area | Remediation |
| --- | --- |
| Electron | Upgraded 27.3.11 to 44.7.0, including its Chromium and Node runtime. |
| Casting XML and protobuf | Updated plist, XML parsers and protobufjs; overrides keep legacy casting packages on patched transitive versions. |
| IP classification | Replaced unpatched `ip` with a small local compatibility module using `ipaddr.js`; regression checks cover alternative loopback and IPv4-mapped IPv6 representations. |
| Media metadata | Upgraded music-metadata to 12.0.0 and adapted asynchronous ESM loading. |
| Development and packaging | Replaced Spectron with Playwright, migrated Electron packaging/signing tools, removed obsolete dependency scanners and watchers, and replaced appdmg with macOS built-in tools. |
| Other transitive dependencies | Updated Babel and pinned patched Browserslist, temporary-file and trim-newlines dependencies. |

Node 24 is the recommended development runtime. Clean lockfile installs are used
in CI and packaging. GitHub Actions are pinned to verified commit hashes, with
workflow permissions limited to their tasks.

## Application hardening

- Disabled page Node integration and enabled context isolation in all app windows.
  Trusted application code runs in isolated preloads.
- Removed inline page scripts and added restrictive content security policies.
  Blocked remote navigation, popups, webviews and permission requests.
- Validated IPC sender identity and local top-level frame URLs; a spoofed window
  title no longer grants access to privileged messages.
- Required random 256-bit URL tokens for torrent and casting subtitle servers,
  with Host and Origin validation. Poster extraction binds to loopback.
- Restricted FFmpeg and ffprobe subtitle extraction to local file/pipe protocols.
- Removed the macOS debugger entitlement and replaced hardcoded signing details
  with environment/keychain configuration.

## Validation

A clean Node 24 install passed lint, security checks, React UI checks, subtitle
checks and the full npm audit. The native Apple Silicon packaged app also passed
the security suite using a temporary profile, preserving the user's torrents.
Checks include real offline torrent seeding and HTTP streaming/ranges, IP
classification, casting parser compatibility, metadata parsing, rejected media
requests, DNS rebinding protection, isolated globals, CSP, popup/navigation
blocking, forged IPC rejection and preference/About window startup.

The installed app, ZIP and DMG were rebuilt. The local build uses an ad hoc macOS
signature; public distribution still requires an Apple Developer signature and
notarization. The previous installed app is retained under `dist/backups/`.

## Remaining limits

The isolated preloads still use `sandbox: false` because the legacy application
performs filesystem and networking work there. Moving these operations into
utility processes and exposing narrowly scoped IPC would improve containment;
that architectural migration is not completed by this remediation.

Physical Chromecast, AirPlay and DLNA devices and Windows/Linux packages were
not available for local validation. Parser and authorization compatibility were
tested, but hardware casting remains a manual check.

Zero npm findings is a snapshot of known advisories, not proof that every possible
vulnerability is eliminated. The system FFmpeg installation, operating system,
remote services and previously unknown bugs are outside the npm audit. Repeat
the audit and security tests when dependencies or advisory data change.
