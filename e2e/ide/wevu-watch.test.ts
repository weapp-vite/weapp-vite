import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-lifecycle-wevu-ts')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

async function runBuild() {
  await fs.remove(DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    skipNpm: true,
    cwd: APP_ROOT,
    label: 'ide:wevu-watch',
  })
}

describe.sequential('wevu watch controls (e2e)', () => {
  it('supports pause/resume/stop via destructuring', async () => {
    await runBuild()
    const miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })

    try {
      const page = await miniProgram.reLaunch('/pages/index/index')
      if (!page) {
        throw new Error('Failed to launch index page')
      }
      const logs = await page.callMethod('runWatchE2E')
      expect(logs).toEqual([2])
      const storedLogs = await page.data('__watchLogs')
      expect(storedLogs).toEqual([2])
    }
    finally {
      await miniProgram.close()
    }
  })
})
