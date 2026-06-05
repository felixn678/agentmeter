# Changelog

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
