#!/usr/bin/env bash
# Build the agentmeter Widget Extension (.appex) on macOS.
#
# Usage:
#   ./build-appex.sh                  # uses $CODESIGN_ID or auto-pick free-team cert
#   CODESIGN_ID="Apple Development: you@example.com (TEAMID)" ./build-appex.sh
#
# Prints the resulting .appex path on success.
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "::error::build-appex.sh runs only on macOS" >&2
  exit 1
fi

cd "$(dirname "$0")"

if [[ ! -d AgentmeterWidget.xcodeproj ]]; then
  if ! command -v xcodegen >/dev/null; then
    echo "::error::AgentmeterWidget.xcodeproj is missing and xcodegen is not installed." >&2
    echo "Install with: brew install xcodegen" >&2
    exit 1
  fi
  echo "→ Generating Xcode project (xcodegen)…"
  xcodegen generate
fi

# Pick a signing identity. The widget MUST be signed with a real cert to load
# (PlugInKit rejects ad-hoc). Prefer the user's free-team Apple Development cert
# if CODESIGN_ID is unset.
if [[ -z "${CODESIGN_ID:-}" ]]; then
  CODESIGN_ID=$(
    security find-identity -v -p codesigning 2>/dev/null \
      | awk '/"Apple Development:/ { sub(/^[^"]+"/, ""); sub(/"[^"]*$/, ""); print; exit }'
  )
  if [[ -z "$CODESIGN_ID" ]]; then
    echo "::error::No 'Apple Development' identity found." >&2
    echo "Sign in to Xcode → Preferences → Accounts with your Apple ID first," >&2
    echo "or pass CODESIGN_ID=\"<identity>\" explicitly." >&2
    exit 1
  fi
  echo "→ Auto-picked signing identity: $CODESIGN_ID"
fi

DERIVED="$(pwd)/build"
rm -rf "$DERIVED"

xcodebuild \
  -project AgentmeterWidget.xcodeproj \
  -scheme AgentmeterWidget \
  -configuration Release \
  -derivedDataPath "$DERIVED" \
  CODE_SIGN_IDENTITY="$CODESIGN_ID" \
  CODE_SIGN_STYLE=Automatic \
  | sed -E 's/^/   /'

APPEX=$(find "$DERIVED/Build/Products/Release" -name 'AgentmeterWidget.appex' -print -quit)
if [[ -z "$APPEX" || ! -d "$APPEX" ]]; then
  echo "::error::xcodebuild succeeded but AgentmeterWidget.appex was not found" >&2
  exit 1
fi

echo "✓ Built: $APPEX"
echo "$APPEX" > "$DERIVED/.appex-path"
