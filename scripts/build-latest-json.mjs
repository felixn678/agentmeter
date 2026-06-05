#!/usr/bin/env node
// Build latest.json for tauri-plugin-updater by merging per-platform signatures
// from the matrix build artifacts. Runs in the `publish` job of release-build.yml
// (RED-TEAM C4: single writer avoids the matrix race that clobbers other
// platforms when each job races to upload its own latest.json).
//
// Usage:
//   node scripts/build-latest-json.mjs <tag> <artifacts-dir> [notes-file] > latest.json
//
// Inputs:
//   <tag>            e.g. "v0.3.0"   (used in download URL + version field)
//   <artifacts-dir>  workflow artifacts directory (download-artifact unpacks here)
//   [notes-file]     optional path to release notes markdown; defaults to ""
//
// Output:
//   Tauri v2 latest.json on stdout.
//
// Algorithm:
//   1. Glob all *.sig files under <artifacts-dir>
//   2. Map each sig file to a Tauri platform key by inspecting the underlying
//      artifact filename (.app.tar.gz, .AppImage, .nsis.zip, etc.)
//   3. Read signature content as text (minisign base64 blob)
//   4. Build URL as https://github.com/${REPO}/releases/download/<tag>/<basename>
//      where REPO = owner/name read from GITHUB_REPOSITORY env, or defaulted.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'

const [, , tag, artifactsDir, notesFile] = process.argv
if (!tag || !artifactsDir) {
  console.error('Usage: build-latest-json.mjs <tag> <artifacts-dir> [notes-file]')
  process.exit(2)
}

const REPO = process.env.GITHUB_REPOSITORY ?? 'felixn678/agentmeter'
const version = tag.replace(/^v/, '')

// Walk artifactsDir recursively, collect every file path.
function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

// Infer Tauri platform key from the .sig file's underlying asset filename.
// Tauri v2 keys: darwin-aarch64, darwin-x86_64, linux-x86_64,
//                windows-x86_64 (.nsis.zip / .msi.zip), etc.
function platformOf(sigPath) {
  const asset = sigPath.replace(/\.sig$/, '').toLowerCase()
  // macOS — .app.tar.gz; arch encoded in the artifact dirname OR filename.
  if (asset.endsWith('.app.tar.gz')) {
    if (asset.includes('aarch64') || asset.includes('arm64')) return 'darwin-aarch64'
    if (asset.includes('x64') || asset.includes('x86_64')) return 'darwin-x86_64'
    // Fallback: dirname carries the matrix label (bundle-mac-arm64 / bundle-mac-x64).
    if (asset.includes('mac-arm64')) return 'darwin-aarch64'
    if (asset.includes('mac-x64')) return 'darwin-x86_64'
  }
  if (asset.endsWith('.appimage')) return 'linux-x86_64'
  if (asset.endsWith('.nsis.zip')) return 'windows-x86_64'
  return null
}

const sigs = walk(artifactsDir).filter((p) => p.endsWith('.sig'))
const platforms = {}

for (const sigPath of sigs) {
  const platform = platformOf(sigPath)
  if (!platform) {
    console.error(`Skipping unrecognized sig: ${sigPath}`)
    continue
  }
  const signature = readFileSync(sigPath, 'utf8').trim()
  const assetName = basename(sigPath).replace(/\.sig$/, '')
  const url = `https://github.com/${REPO}/releases/download/${tag}/${assetName}`
  if (platforms[platform]) {
    console.error(`Duplicate platform ${platform}: ${platforms[platform].url} vs ${url}`)
    process.exit(1)
  }
  platforms[platform] = { signature, url }
}

if (Object.keys(platforms).length === 0) {
  console.error(`No platform signatures found under ${artifactsDir}`)
  process.exit(1)
}

const notes = notesFile ? readFileSync(notesFile, 'utf8').trim() : ''
const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  platforms,
}

process.stdout.write(JSON.stringify(manifest, null, 2) + '\n')
