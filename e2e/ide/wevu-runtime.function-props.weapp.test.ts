import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { APP_ROOT, runBuild } from '../wevu-runtime.utils'
import { FUNCTION_PROPS_CHECKPOINTS } from './wevuRuntimeDom/functionProps'

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

async function runRouteE2E(miniProgram: any, route: string, dom: ReturnType<typeof createDomAcceptance>, id: string) {
  const page = await miniProgram.reLaunch(route)
  if (!page) {
    throw new Error(`Failed to launch route: ${route}`)
  }
  await dom.check(`${id}-initial`, miniProgram, page)
  const result = await page.callMethodWithOptions('runE2E', {
    routeOnly: true,
    timeout: 60_000,
  })
  if (!result?.ok) {
    throw new Error(`E2E failed for ${route}: ${JSON.stringify(result)}`)
  }
  await dom.check(`${id}-invoked`, miniProgram, page)
  return result
}

describe('wevu runtime function props (weapp e2e)', { concurrent: false }, () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('passes compiler-marked function props and respects allowFunctionProps false', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/wevu-runtime-e2e', FUNCTION_PROPS_CHECKPOINTS)
    const miniProgram = await getSharedMiniProgram()

    const autoResult = await runRouteE2E(miniProgram, '/pages/function-props-auto/index', dom, 'auto')
    expect(autoResult.checks?.callbackReceived).toBe(true)
    expect(autoResult.checks?.handlerReceived).toBe(true)
    expect(autoResult.checks?.staticMemberValueReceived).toBe(true)
    expect(autoResult.checks?.computedMemberValueReceived).toBe(true)
    expect(autoResult.checks?.staticMemberHandlerIsFunction).toBe(true)
    expect(autoResult.checks?.parentCallbackCalled).toBe(true)
    expect(autoResult.checks?.parentHandlerCalled).toBe(true)

    const disabledResult = await runRouteE2E(miniProgram, '/pages/function-props-disabled/index', dom, 'disabled')
    expect(disabledResult.checks?.callbackFiltered).toBe(true)
    expect(disabledResult.checks?.handlerFiltered).toBe(true)
    expect(disabledResult.checks?.parentCallbackNotCalled).toBe(true)

    const dynamicResult = await runRouteE2E(miniProgram, '/pages/function-props-dynamic/index', dom, 'dynamic')
    expect(dynamicResult.checks?.dynamicHandlerReceived).toBe(true)
    expect(dynamicResult.checks?.parentDynamicHandlerCalled).toBe(true)

    const nonFunctionResult = await runRouteE2E(miniProgram, '/pages/non-function-prop-bind/index', dom, 'value')
    expect(nonFunctionResult.checks?.selectedReceived).toBe(true)
    expect(nonFunctionResult.checks?.selectedTypeString).toBe(true)
  })
})
