# TorrentCat Mac releases

[Back to README](../README.md)

This fork distributes macOS binaries only. Windows and Linux packaging remains
available for local builds, but CI does not generate or publish those binaries.

## Automated releases

Application, dependency and build changes pushed to `main` start **Prepare patch
release**. After the full CI suite passes, it increments the patch version in
`package.json` and `package-lock.json`, commits that version to `main`, and starts
**Publish signed Mac release**. That workflow builds both Mac architectures and
publishes the GitHub release only after notarization, Gatekeeper verification and
checksum validation. Documentation-only changes do not create a release.

Merging or pushing these changes to `main` authorizes the full build and release
pipeline, including artifact uploads and public GitHub publication, without a
separate confirmation. Commit messages do not opt out of release automation.
See [AGENTS.md](../AGENTS.md) for the repository's standing delivery instructions.

If Apple is still processing, the release stays a draft. A scheduled workflow
checks pending releases every 30 minutes (subject to GitHub scheduling delays)
and resumes their saved submissions automatically. Public releases include stable
installer filenames for the README links as well as versioned installers, ZIPs
and `SHA256SUMS.txt`. The in-app update checker uses only published stable releases
with a compatible download, never drafts or CI artifacts.

To start a patch release manually, run **Prepare patch release** on `main` or
`npm run release`. Minor or major version changes remain an explicit maintainer
decision. Failed builds remain private drafts; fix and rerun the original failed
job before resuming a draft that lacks recovery artifacts.

## Installer names and upgrade compatibility

New builds use `TorrentCat.app`, the `TorrentCat` executable and DMG volume,
`TorrentCat-vVERSION-darwin-ARCH.dmg` / `.zip`, and
`TorrentCat-vVERSION-SHA256SUMS.txt`. Published releases also provide
`TorrentCat-mac-ARCH.dmg` for the README’s stable links.

The release publisher retains identical `WebTorrent-vVERSION-darwin-ARCH`
DMG/ZIP aliases so existing installations can discover the update, and
`WebTorrent-mac-ARCH.dmg` aliases for existing download links. All aliases are
covered by the published checksums. TorrentCat’s update checker accepts both
names, preferring TorrentCat. Recovery and publication of pending releases
continue to use their original source revision and verified artifacts.

## Manual Mac builds

Signed builds require `APPLE_SIGNING_IDENTITY` and an `APPLE_NOTARY_PROFILE`
created with `xcrun notarytool store-credentials`. Unsigned local builds do not
require Apple credentials.

Run **Actions → Signed macOS builds → Run workflow** on `main` to produce separate
Apple Silicon (`arm64`) and Intel (`x64`) DMG/ZIP downloads. The manual **Package
macOS** workflow uses the same signed Mac jobs. Each app is signed with Developer ID,
notarized, stapled, and verified with Gatekeeper before packaging. Downloads are
available in the workflow's artifacts for 30 days; publishing a GitHub release
is a separate action.

Apple's processing can outlast a CI job. The workflow saves the signed app and
submission ID first as `macos-ARCH-notarization-pending`, then waits up to five
minutes. A successful workflow with a **Pending Apple approval** summary means
the submission was saved, not that the installers are ready. Pending artifacts
are recovery files and must not be distributed as approved installers.

To check again, run **Signed macOS builds** on `main` and enter the original
workflow run ID in **resume_run_id** (the number in the run's URL). This restores
the exact signed app and checks the same Apple submission without rebuilding or
resubmitting it. Once accepted, the workflow staples and verifies it, then uploads
`macos-arm64-signed` and `macos-x64-signed` with DMG/ZIP downloads. Resume within
the 30-day artifact retention period. Apple rejections fail the job and include
diagnostics; delays leave the submission pending for another resume. Runs from
before this recovery mechanism cannot be resumed because they saved no app.

Configure these repository Actions secrets (never commit their contents):

| Secret | Value |
| --- | --- |
| `APPLE_CERTIFICATE_BASE64` | Base64-encoded PKCS#12 (`.p12`) containing the Developer ID Application certificate and private key |
| `APPLE_CERTIFICATE_PASSWORD` | Password protecting that PKCS#12 file |
| `APPLE_SIGNING_IDENTITY` | Full `Developer ID Application: … (TEAMID)` certificate identity |
| `APPLE_API_KEY_BASE64` | Base64-encoded App Store Connect team API private key (`.p8`) |
| `APPLE_API_KEY_ID` | App Store Connect API key ID |
| `APPLE_API_ISSUER` | App Store Connect API issuer ID |

Use a dedicated App Store Connect team key with App Manager access for
notarization. Signing is restricted to this repository's `main` branch and is
never triggered by pull requests. Each job uses an ephemeral password-protected
keychain and removes the keychain and temporary credential files even on failure.
The downloaded app contains Apple's notarization ticket, not signing credentials.
For local signing with a separate keychain, also set `APPLE_KEYCHAIN` to its path.

The Mac app can only be packaged from **macOS**.
