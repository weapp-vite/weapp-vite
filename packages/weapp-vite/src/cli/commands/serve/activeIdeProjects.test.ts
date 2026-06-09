import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  hasOtherActiveServeIdeProject,
  registerActiveServeIdeProject,
} from './activeIdeProjects'

const ACTIVE_IDE_PROJECTS_DIR = path.join(os.tmpdir(), 'weapp-vite-active-dev-open-projects')

async function cleanupRecords() {
  await fs.rm(ACTIVE_IDE_PROJECTS_DIR, { force: true, recursive: true })
}

describe('active serve ide projects', () => {
  afterEach(async () => {
    await cleanupRecords()
  })

  it('does not treat the current project as another active dev open project', async () => {
    const unregister = await registerActiveServeIdeProject('/workspace/current')

    await expect(hasOtherActiveServeIdeProject('/workspace/current')).resolves.toBe(false)

    await unregister()
  })

  it('detects another active dev open project and clears it after unregister', async () => {
    const unregister = await registerActiveServeIdeProject('/workspace/other')

    await expect(hasOtherActiveServeIdeProject('/workspace/current')).resolves.toBe(true)

    await unregister()

    await expect(hasOtherActiveServeIdeProject('/workspace/current')).resolves.toBe(false)
  })
})
