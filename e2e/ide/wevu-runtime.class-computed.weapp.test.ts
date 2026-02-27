import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { APP_ROOT, runBuild } from '../wevu-runtime.utils'

let sharedMiniProgram: any = null
let sharedBuildPrepared = false

async function getSharedMiniProgram() {
  if (!sharedBuildPrepared) {
    await runBuild('weapp')
    sharedBuildPrepared = true
  }
  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })
  }
  return sharedMiniProgram
}

async function releaseSharedMiniProgram(miniProgram: any) {
  if (!sharedMiniProgram || sharedMiniProgram === miniProgram) {
    return
  }
  await miniProgram.close()
}

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await miniProgram.close()
}

describe.sequential('wevu runtime class computed (weapp e2e)', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('resolves class ternary with refs and computed values', async () => {
    const miniProgram = await getSharedMiniProgram()

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
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
