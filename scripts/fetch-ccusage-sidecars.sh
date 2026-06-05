#!/usr/bin/env bash
# Fetch ccusage's prebuilt standalone native binaries and place them as Tauri sidecars.
# These binaries need no Node/npm at runtime, so the shipped app works without ccusage installed.
# Run before `tauri build` (and once before `tauri dev` to test the bundled path).
set -euo pipefail

CCUSAGE_VERSION="20.0.6"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/src-tauri/binaries"
mkdir -p "$DEST"

# pkg:rust-target-triple — Tauri matches the sidecar by the platform's target triple.
ENTRIES="
@ccusage/ccusage-linux-x64:x86_64-unknown-linux-gnu
@ccusage/ccusage-linux-arm64:aarch64-unknown-linux-gnu
@ccusage/ccusage-darwin-arm64:aarch64-apple-darwin
@ccusage/ccusage-darwin-x64:x86_64-apple-darwin
"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cd "$TMP"

for entry in $ENTRIES; do
  pkg="${entry%%:*}"
  triple="${entry##*:}"
  echo "→ $pkg@$CCUSAGE_VERSION → ccusage-$triple"
  tgz="$(npm pack "$pkg@$CCUSAGE_VERSION" --silent)"
  tar -xzf "$tgz"
  install -m 0755 package/bin/ccusage "$DEST/ccusage-$triple"
  rm -rf package "$tgz"
done

echo "✓ Sidecars written to src-tauri/binaries/ (ccusage $CCUSAGE_VERSION)"
ls -lah "$DEST"
