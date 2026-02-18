import { describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { APP_ROOT, runBuild } from '../wevu-runtime.utils'

describe.sequential('wevu runtime class computed (weapp e2e)', () => {
  it('resolves class ternary with refs and computed values', async () => {
    await runBuild('weapp')

    const miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })

    try {
      const page = await miniProgram.reLaunch('/pages/class-computed/index')
      if (!page) {
        throw new Error('Failed to launch class-computed page')
      }

      const result = await page.callMethod('runE2E')
      if (!result?.ok) {
        throw new Error(`E2E failed for class-computed: ${JSON.stringify(result)}`)
      }

      expect(result.ok).toBe(true)
      expect(result.checks?.selectedDarkClassResolved).toBe(true)
      expect(result.checks?.unselectedClassResolved).toBe(true)
      expect(result.checks?.computedTernaryClassResolved).toBe(true)
    }
    finally {
      await miniProgram.close()
    }
  })
})
