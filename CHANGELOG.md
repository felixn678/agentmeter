# Changelog

## [0.6.0](https://github.com/felixn678/agentmeter/compare/v0.5.0...v0.6.0) (2026-06-05)


### Features

* **macos-widget:** snapshot data bridge to widget sandbox container ([e268d85](https://github.com/felixn678/agentmeter/commit/e268d8580d6b3894cd160bf0aeeda9f23de589e4))
* **macos-widget:** WidgetKit extension + local pipeline (Phase 2 + 3) ([4d222c7](https://github.com/felixn678/agentmeter/commit/4d222c76fdd7918f46be21b38581f1c34d4991f5))


### Bug Fixes

* **macos-widget:** real-Mac signing fixes for build-appex.sh ([6ef7155](https://github.com/felixn678/agentmeter/commit/6ef7155f40c83bc43ed500c7cab7f2018340efd7))

## [0.5.0](https://github.com/felixn678/agentmeter/compare/v0.4.1...v0.5.0) (2026-06-05)


### Features

* **release:** minimum system requirements + bilingual release runbook ([2679a83](https://github.com/felixn678/agentmeter/commit/2679a83d5ba3b8c1af48dbcdfb358cdc52668326))


### Bug Fixes

* **ci:** dedup AppImage upload between DEST + INSTALLERS ([e40a368](https://github.com/felixn678/agentmeter/commit/e40a3681a7e34f6a5830ac966670a678ed61c7d4))
* **ci:** pass --repo to gh release upload in publish-updater-json ([3ed3eb1](https://github.com/felixn678/agentmeter/commit/3ed3eb1a0dabf64d47f4cdba95b779397fd32e96))

## [0.4.1](https://github.com/felixn678/agentmeter/compare/v0.4.0...v0.4.1) (2026-06-05)


### Bug Fixes

* **ci:** use array of sig patterns to avoid set -e + && exit trap ([357df5d](https://github.com/felixn678/agentmeter/commit/357df5d122b3357b2e7014a1501043b332607977))

## [0.4.0](https://github.com/felixn678/agentmeter/compare/v0.3.0...v0.4.0) (2026-06-05)


### Features

* auto-refresh the tray title on the fetch interval ([14c9e1b](https://github.com/felixn678/agentmeter/commit/14c9e1b36cf0b521b5947dd69c766cd6accfba4b))
* categorized settings hub ([693ed31](https://github.com/felixn678/agentmeter/commit/693ed31be3ab4fb96caeb2152936bb2059980da0))


### Bug Fixes

* **ci:** drop tauri-action, build directly so sigs survive for upload ([fd62d24](https://github.com/felixn678/agentmeter/commit/fd62d24287d0972a483d24571d244ac4f68f8cf5))
* **ci:** find updater sig defensively + add debug ls ([85d436b](https://github.com/felixn678/agentmeter/commit/85d436b22ec3f256cb173c455af00efb9c882578))
* **ci:** pass GITHUB_TOKEN to tauri-action for release upload ([2c81232](https://github.com/felixn678/agentmeter/commit/2c81232c4b5f785ee3b3d8bd24c79af39ade0e2f))
* **ci:** release-build trigger workflow_dispatch only ([87ee9bc](https://github.com/felixn678/agentmeter/commit/87ee9bc5212b40b030e5bd93b9972cb3674c7c5e))
* **ci:** remove duplicate env: block in upload step ([b901ddc](https://github.com/felixn678/agentmeter/commit/b901ddcf5f4db27725404ea842d262229e518a0a))
* **ci:** revert flow-style rust-toolchain with: block ([85dab2b](https://github.com/felixn678/agentmeter/commit/85dab2b374bf7f503af5c7d277f75f617add3ce1))
* **ci:** upload .sig files + build latest.json manually ([4f81bca](https://github.com/felixn678/agentmeter/commit/4f81bcaf7c2762d6d2c96438f9a3a644f974c961))
* **release:** drop empty APPLE_* env vars so macOS unsigned builds succeed ([669a1b1](https://github.com/felixn678/agentmeter/commit/669a1b16714781e5591856ff2a770f1c97f61c97))
* **updater:** enable createUpdaterArtifacts so Tauri emits .app.tar.gz + .sig ([ccedb28](https://github.com/felixn678/agentmeter/commit/ccedb28591affec01b105b09e932cb1f1b0251ca))

## [0.3.0](https://github.com/felixn678/agentmeter/compare/v0.2.0...v0.3.0) (2026-06-05)


### Features

* floating desktop widget window ([b0fe8bf](https://github.com/felixn678/agentmeter/commit/b0fe8bfa9d62ee392564ecdddea99f4529849e2d))
* **updater:** integrate tauri-plugin-updater v2 with signing + .deb guard ([a24f033](https://github.com/felixn678/agentmeter/commit/a24f033e222aba34546035828476f40f205121bc))

## [0.2.0](https://github.com/felixn678/agentmeter/compare/v0.1.0...v0.2.0) (2026-06-05)


### Features

* budget settings and OS notifications ([c402df1](https://github.com/felixn678/agentmeter/commit/c402df1fa64cf1893f781f9e0685c78f49b5b589))
* **core:** bundle ccusage as a sidecar so the app runs without Node ([e27773e](https://github.com/felixn678/agentmeter/commit/e27773eab754779ea7eb8b110ed0e20bcd31112d))
* **dashboard:** analytics charts, Today view, and orange theme ([f7cb797](https://github.com/felixn678/agentmeter/commit/f7cb797507273e6a3c4fe15d081046198b7df73a))
* **dashboard:** live burn-rate Now card and average-based trend ([4a438e3](https://github.com/felixn678/agentmeter/commit/4a438e3d37358c7dea6e83c90de366f78009faae))
* orange gauge app and tray icon matching the brand mark ([5a138f3](https://github.com/felixn678/agentmeter/commit/5a138f3c6c8b2a4fcfef4bc8ef69bec1eca3218b))
* **ui:** redesign dashboard and migrate styling to Tailwind + shadcn-style ([d93c6d3](https://github.com/felixn678/agentmeter/commit/d93c6d379cb908d1d066fe079eaa5458c8384588))


### Performance Improvements

* **dashboard:** preload all granularities and revalidate every 30s ([350e848](https://github.com/felixn678/agentmeter/commit/350e848010f62c20ccb647edc877793698fbe66c))
