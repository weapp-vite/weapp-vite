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

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await miniProgram.close()
}

async function runRouteE2E(miniProgram: any, route: string) {
  const page = await miniProgram.reLaunch(route)
  if (!page) {
    throw new Error(`Failed to launch route: ${route}`)
  }
  const result = await page.callMethod('runE2E')
  if (!result?.ok) {
    throw new Error(`E2E failed for ${route}: ${JSON.stringify(result)}`)
  }
  return result
}

describe.sequential('wevu runtime function props (weapp e2e)', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('passes compiler-marked function props and respects allowFunctionProps false', async () => {
    const miniProgram = await getSharedMiniProgram()

    const autoResult = await runRouteE2E(miniProgram, '/pages/function-props-auto/index')
    expect(autoResult.checks?.callbackReceived).toBe(true)
    expect(autoResult.checks?.parentCallbackCalled).toBe(true)

    const disabledResult = await runRouteE2E(miniProgram, '/pages/function-props-disabled/index')
    expect(disabledResult.checks?.callbackFiltered).toBe(true)
    expect(disabledResult.checks?.parentCallbackNotCalled).toBe(true)
  })
})
