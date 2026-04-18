import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, it } from 'vitest'
import {
  DEFAULT_VSCODE_USER_SETTINGS,
  ensureVscodeUserSettings,
} from '../scripts/vscode-e2e-shared'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, { force: true, recursive: true })))
})

it('writes default user settings for isolated vscode sessions', async () => {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-vscode-settings-'))
  tempDirs.push(userDataDir)

  await ensureVscodeUserSettings(userDataDir)

  const settingsPath = path.join(userDataDir, 'User', 'settings.json')
  const settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'))

  assert.deepEqual(settings, DEFAULT_VSCODE_USER_SETTINGS)
})

it('preserves unrelated settings while applying weapp-vite defaults', async () => {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-vscode-settings-'))
  tempDirs.push(userDataDir)

  const settingsPath = path.join(userDataDir, 'User', 'settings.json')
  await fs.mkdir(path.dirname(settingsPath), { recursive: true })
  await fs.writeFile(settingsPath, `${JSON.stringify({
    'editor.fontSize': 16,
    'security.workspace.trust.enabled': true,
  }, null, 2)}\n`, 'utf8')

  await ensureVscodeUserSettings(userDataDir, {
    'files.autoSave': 'afterDelay',
  })

  const settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'))

  assert.deepEqual(settings, {
    'editor.fontSize': 16,
    'security.workspace.trust.enabled': false,
    'workbench.iconTheme': 'weapp-vite-file-icons',
    'files.autoSave': 'afterDelay',
  })
})
