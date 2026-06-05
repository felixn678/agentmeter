#!/usr/bin/env bash
# Embed the freshly-built AgentmeterWidget.appex into a Tauri-produced
# agentmeter.app and re-sign the whole bundle deep.
#
# Usage:
#   ./embed-widget.sh [<path/to/agentmeter.app>]
# Defaults to the most recent Release bundle under src-tauri/target/.
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "::error::embed-widget.sh runs only on macOS" >&2
  exit 1
fi

cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"

# Resolve the appex from the build-appex.sh artifact pointer, or rebuild it.
APPEX_PTR="build/.appex-path"
if [[ -f "$APPEX_PTR" ]] && [[ -d "$(cat "$APPEX_PTR")" ]]; then
  APPEX=$(cat "$APPEX_PTR")
else
  echo "→ No fresh appex; running build-appex.sh first"
  ./build-appex.sh
  APPEX=$(cat "$APPEX_PTR")
fi

# Resolve the target .app: explicit arg, or autodetect under target/.
APP="${1:-}"
if [[ -z "$APP" ]]; then
  APP=$(
    find "$ROOT/src-tauri/target" -type d -name 'agentmeter.app' \
      -path '*/release/bundle/macos/*' -print 2>/dev/null \
      | head -n1
  )
fi
if [[ -z "$APP" || ! -d "$APP" ]]; then
  echo "::error::Could not locate agentmeter.app. Run pnpm tauri build first or pass the path." >&2
  exit 1
fi

# Pick the same signing identity as build-appex.sh used (env override wins).
if [[ -z "${CODESIGN_ID:-}" ]]; then
  CODESIGN_ID=$(
    security find-identity -v -p codesigning 2>/dev/null \
      | awk '/"Apple Development:/ { sub(/^[^"]+"/, ""); sub(/"[^"]*$/, ""); print; exit }'
  )
fi
if [[ -z "$CODESIGN_ID" ]]; then
  echo "::error::No signing identity. Set CODESIGN_ID or sign in to Xcode first." >&2
  exit 1
fi
echo "→ Using signing identity: $CODESIGN_ID"

PLUGINS_DIR="$APP/Contents/PlugIns"
mkdir -p "$PLUGINS_DIR"
EMBEDDED="$PLUGINS_DIR/AgentmeterWidget.appex"
rm -rf "$EMBEDDED"
cp -R "$APPEX" "$EMBEDDED"
echo "→ Embedded: $EMBEDDED"

# Re-sign nested-first, then the outer .app deep. Order matters; if you sign the
# outer bundle first, the nested appex signature is invalidated.
codesign --force --options runtime --timestamp=none \
  --sign "$CODESIGN_ID" \
  "$EMBEDDED"
echo "→ Signed appex"

codesign --force --deep --options runtime --timestamp=none \
  --sign "$CODESIGN_ID" \
  "$APP"
echo "→ Re-signed app deep"

codesign --verify --deep --strict --verbose=2 "$APP"
echo "✓ Verified: $APP"
echo ""
echo "Next steps:"
echo "  cp -R \"$APP\" /Applications/"
echo "  open -a /Applications/agentmeter.app"
echo "  # then Notification Center → Edit Widgets → search 'agentmeter'"
