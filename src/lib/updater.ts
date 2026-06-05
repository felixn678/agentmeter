// Auto-update flow for agentmeter.
//
// Signing: Tauri verifies the downloaded payload against the minisign pubkey
// baked into tauri.conf.json. The signature gate happens INSIDE plugin-updater's
// downloadAndInstall() — we don't roll our own.
//
// This wrapper adds layers the plugin doesn't:
//   1. .deb / apt-installed Linux: skip — the plugin would clobber the dpkg path
//   2. Downgrade guard: refuse anything <= current version
//   3. Explicit user consent before installing
import { check } from '@tauri-apps/plugin-updater'
import { ask, message } from '@tauri-apps/plugin-dialog'
import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import semver from 'semver'

export async function checkForUpdate(showNoUpdateDialog = false): Promise<void> {
  const supported = await invoke<boolean>('is_auto_update_supported')
  if (!supported) {
    if (showNoUpdateDialog) {
      await message(
        "Auto-update isn't available for this install.\n\nRun `sudo apt upgrade agentmeter` to update.",
        { kind: 'info', title: 'agentmeter' },
      )
    }
    return
  }

  let update
  try {
    update = await check()
  } catch (err) {
    // Network outage, 404 before first release, malformed latest.json — silent
    // unless the user explicitly asked.
    if (showNoUpdateDialog) {
      await message(`Could not check for updates: ${err}`, {
        kind: 'warning',
        title: 'agentmeter',
      })
    }
    return
  }

  if (!update) {
    if (showNoUpdateDialog) {
      await message("You're on the latest version.", {
        kind: 'info',
        title: 'agentmeter',
      })
    }
    return
  }

  const current = await getVersion()
  if (!semver.gt(update.version, current)) {
    // Signed but not newer — downgrade attempt or stale latest.json. Refuse.
    console.warn(
      `Update ${update.version} is not newer than ${current}; ignoring`,
    )
    return
  }

  const accepted = await ask(
    `agentmeter ${update.version} is available.\n\nRelease notes:\n${update.body ?? '(none)'}\n\nInstall and restart?`,
    {
      kind: 'info',
      title: 'Update available',
      okLabel: 'Install & Restart',
      cancelLabel: 'Later',
    },
  )
  if (!accepted) return

  await update.downloadAndInstall()
  // downloadAndInstall relaunches via the plugin — control doesn't return here.
}
