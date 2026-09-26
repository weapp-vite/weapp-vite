import type { TestContext } from 'vitest'
import { afterAll, describe, expect, it } from 'vitest'
import { COMPOSITION_API_E2E_NAMES } from '../../e2e-apps/wevu-runtime-e2e/src/shared/compositionApiCoverage'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { APP_ROOT, runBuild } from '../wevu-runtime.utils'

const EXPECTED_APIS = COMPOSITION_API_E2E_NAMES

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

async function assertCoverageForRoute(context: TestContext, miniProgram: any, route: string, vue: boolean) {
  const suffix = vue ? '-vue' : ''
  const dom = createDomAcceptance(context, 'e2e-apps/wevu-runtime-e2e', [
    { id: 'composition:initial', route, action: '检查组合式 API 初始绑定值', nodes: [
      { selector: `#api-ref${suffix}`, text: vue ? 'composition api vue anchor' : 'composition api anchor' },
      { selector: '#composition-reactive', text: 'reactive: 0 / 1' },
      { selector: '#composition-derived', text: 'computed: 0' },
      { selector: '#composition-custom', text: `custom: alpha${suffix}` },
      { selector: '#composition-form', text: `form: init-title${suffix}` },
      { selector: '#composition-model', text: `model: raw-title${suffix}` },
      { selector: '#composition-store', text: 'store: 1' },
      { selector: '#composition-lifecycle', text: 'beforeUnmount callbacks: 0' },
    ] },
    { id: 'composition:result', route, action: '执行 API 后检查响应式、计算、模型与 store 结果', nodes: [
      { selector: '#composition-reactive', text: 'reactive: 5 / 2' },
      { selector: '#composition-derived', text: 'computed: 10' },
      { selector: '#composition-custom', text: `custom: beta${suffix}` },
      { selector: '#composition-form', text: `form: bind-model-value${suffix}-2` },
      { selector: '#composition-model', text: `model: from-props${suffix}` },
      { selector: '#composition-store', text: 'store: 2' },
      { selector: '#composition-lifecycle', text: 'beforeUnmount callbacks: 1' },
    ] },
  ])
  const page = await miniProgram.reLaunch(route)
  if (!page) {
    throw new Error(`Failed to launch ${route}`)
  }
  await page.waitForRendered({ selector: '.page', timeout: 20_000 })
  await dom.check('composition:initial', miniProgram, page)

  const result = await page.callMethodWithOptions('runE2E', {
    routeOnly: true,
    timeout: 60_000,
  })
  await dom.check('composition:result', miniProgram, page)
  if (!result?.ok) {
    throw new Error(`Coverage failed for ${route}: ${JSON.stringify(result?.details ?? {}, null, 2)}`)
  }
  expect(result?.ok).toBe(true)

  const checks = result?.checks ?? {}
  const details = result?.details ?? {}
  const expectedApis = Array.isArray(details.expectedApis) ? details.expectedApis : []
  expect([...expectedApis].sort()).toEqual([...EXPECTED_APIS].sort())

  for (const api of EXPECTED_APIS) {
    expect(checks[api], `route ${route} api ${api} should be covered`).toBe(true)
  }

  expect(Array.isArray(details.failedApis)).toBe(true)
  expect(details.failedApis).toEqual([])
}

describe('wevu composition api (weapp e2e)', { concurrent: false }, () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('covers all public composition APIs on the TS page', async (context) => {
    const miniProgram = await getSharedMiniProgram()

    try {
      await assertCoverageForRoute(context, miniProgram, '/pages/composition-api/index', false)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('covers all public composition APIs on the Vue SFC page', async (context) => {
    const miniProgram = await getSharedMiniProgram()

    try {
      await assertCoverageForRoute(context, miniProgram, '/pages/composition-api-vue/index', true)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
