import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { APP_ROOT, runBuild } from '../wevu-runtime.utils'
import { CLASS_COMPUTED_CHECKPOINTS } from './wevuRuntimeDom/reactivity'

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

describe('wevu runtime class computed (weapp e2e)', { concurrent: false }, () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('resolves class ternary with refs and computed values', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/wevu-runtime-e2e', CLASS_COMPUTED_CHECKPOINTS)
    const miniProgram = await getSharedMiniProgram()

    try {
      const page = await miniProgram.reLaunch('/pages/class-computed/index')
      if (!page) {
        throw new Error('Failed to launch class-computed page')
      }

      await dom.check('initial', miniProgram, page)
      const result = await page.callMethodWithOptions('runE2E', {
        routeOnly: true,
        timeout: 60_000,
      })
      if (!result?.ok) {
        throw new Error(`E2E failed for class-computed: ${JSON.stringify(result)}`)
      }

      expect(result.ok).toBe(true)
      expect(result.checks?.selectedDarkClassResolved).toBe(true)
      expect(result.checks?.unselectedClassResolved).toBe(true)
      expect(result.checks?.computedTernaryClassResolved).toBe(true)
      await dom.check('updated', miniProgram, page)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
