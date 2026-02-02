import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { launchAutomator } from './utils/automator'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from './wevu-runtime.utils'

describe.sequential('wevu runtime hmr (weapp dev)', () => {
  it('runs hmr scenario in dev server', async () => {
    await fs.remove(DIST_ROOT)

    const dev = execa('node', [CLI_PATH, APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      stdio: 'pipe',
    })

    try {
      await waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000)

      const miniProgram = await launchAutomator({
        projectPath: APP_ROOT,
      })

      try {
        const page = await miniProgram.reLaunch('/pages/hmr/index')
        if (!page) {
          throw new Error('Failed to launch HMR page')
        }
        const result = await page.callMethod('runE2E')
        expect(result?.ok).toBe(true)
      }
      finally {
        await miniProgram.close()
      }
    }
    finally {
      dev.kill('SIGTERM')
      const killTimer = setTimeout(() => {
        dev.kill('SIGKILL')
      }, 5_000)
      await dev.catch(() => undefined)
      clearTimeout(killTimer)
    }
  })
})
