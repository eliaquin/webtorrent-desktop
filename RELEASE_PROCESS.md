# Releasing the personal fork

Releases belong to `eliaquin/webtorrent-desktop`. The app checks this repository
for newer stable releases and opens its download page. It does not install
upstream WebTorrent builds or consume the old upstream update feed.

1. Use Node 24 LTS and run `npm ci`, then `npm run test-all`. FFmpeg is required
   for media tests; run Electron suites under Xvfb on Linux.
2. Update `CHANGELOG.md` and the package version with
   `npm version patch --no-git-tag-version` (or the appropriate minor/major bump).
   Commit the source and lockfile changes, merge to `main`, tag the resulting
   commit as `v<version>`, and push that tag to the personal fork.
3. Build on each target platform, using that platform's native architecture:

   ```sh
   npm run package -- darwin --arch arm64 --sign
   npm run package -- win32 --arch x64 --sign
   npm run package -- linux --arch x64
   ```

   Run each command on its corresponding OS. Native torrent/WebRTC modules must
   match the target architecture; cross-building is not validated. Electron 44
   supports macOS x64/arm64, Linux x64/arm64 and Windows x64/arm64; the retired
   32-bit ARM Linux target is no longer built by default.

   Public macOS builds require `APPLE_SIGNING_IDENTITY` and
   `APPLE_NOTARY_PROFILE` (a `notarytool` keychain profile). Public Windows
   installers require the signing certificate/password expected by
   `bin/package.js`. An ad hoc macOS signature is suitable for a local build,
   but is not a substitute for Developer ID signing and notarization.
4. Smoke-test the packaged application, including local torrent creation,
   streaming, seeking, embedded and external subtitles, pause/resume, preferences,
   export, casting and OS integrations. The automated packaged smoke check is:

   ```sh
   WEBTORRENT_PACKAGED_APP="/absolute/path/to/WebTorrent.app/Contents/MacOS/WebTorrent" npm run test-integration
   ```

   Physical casting and OS-specific integrations still need a device check.
   Verify downloads with Gatekeeper/SmartScreen on the actual target platform.
5. Collect the current-version artifacts in `dist/`, run `npm run checksums`,
   then explicitly run `npm run release` to create a **draft** GitHub release
   with the GitHub CLI. The command requires an already-pushed version tag and
   attaches only the current version's artifacts. Review assets and signatures
   before publishing the draft through GitHub.

Packaging preserves `dist/backups/`. `npm run clean` only removes generated
`build/` files. To reset the app profile, quit the app and explicitly run
`npm run reset-app -- --confirm-profile-reset`; that command preserves downloads
but removes settings, history and cached metadata.
