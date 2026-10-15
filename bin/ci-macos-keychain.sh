#!/bin/bash
set -euo pipefail
# Never enable shell tracing here: arguments include signing credentials.
: "${RUNNER_TEMP:?This script requires a GitHub Actions runner}"
keychain_path="$RUNNER_TEMP/webtorrent-signing.keychain-db"
certificate_path="$RUNNER_TEMP/webtorrent-certificate.p12"
api_key_path="$RUNNER_TEMP/webtorrent-notary.p8"

case "${1:-}" in
  cleanup)
    if [ -f "$keychain_path" ]; then
      security delete-keychain "$keychain_path"
    fi
    rm -f "$certificate_path" "$api_key_path"
    ;;
  prepare)
    : "${GITHUB_ENV:?}"
    : "${APPLE_CERTIFICATE_BASE64:?Missing certificate secret}"
    : "${APPLE_CERTIFICATE_PASSWORD:?Missing certificate password secret}"
    : "${APPLE_API_KEY_BASE64:?Missing notarization API key secret}"
    : "${APPLE_API_KEY_ID:?Missing notarization key ID secret}"
    : "${APPLE_API_ISSUER:?Missing notarization issuer secret}"
    umask 077
    printf '%s' "$APPLE_CERTIFICATE_BASE64" | base64 --decode > "$certificate_path"
    printf '%s' "$APPLE_API_KEY_BASE64" | base64 --decode > "$api_key_path"
    keychain_password="$(openssl rand -hex 32)"
    echo "::add-mask::$keychain_password"
    security create-keychain -p "$keychain_password" "$keychain_path"
    security set-keychain-settings -lut 7200 "$keychain_path"
    security unlock-keychain -p "$keychain_password" "$keychain_path"
    security import "$certificate_path" -P "$APPLE_CERTIFICATE_PASSWORD" -k "$keychain_path" -T /usr/bin/codesign -T /usr/bin/security
    security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$keychain_password" "$keychain_path" >/dev/null
    security list-keychains -d user -s "$keychain_path" "$HOME/Library/Keychains/login.keychain-db"
    xcrun notarytool store-credentials webtorrent-ci --keychain "$keychain_path" \
      --key "$api_key_path" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_API_ISSUER"
    rm -f "$certificate_path" "$api_key_path"
    {
      echo "APPLE_KEYCHAIN=$keychain_path"
      echo 'APPLE_NOTARY_PROFILE=webtorrent-ci'
    } >> "$GITHUB_ENV"
    ;;
  *) echo 'Usage: ci-macos-keychain.sh prepare|cleanup' >&2; exit 1 ;;
esac
