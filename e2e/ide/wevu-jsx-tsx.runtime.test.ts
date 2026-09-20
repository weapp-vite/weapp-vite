import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import {
  buildWevuJsxApp,
  WEVU_JSX_APP_ROOT,
} from '../utils/wevu-jsx-tsx'
import { attachRuntimeErrorCollector } from './runtimeErrors'
import { JSX_ISLAND_CHECKPOINTS, JSX_OPTION_CHECKPOINTS, JSX_SETUP_CHECKPOINTS } from './wevuRuntimeDom/jsx'

const runtimeProvider = resolveRuntimeProviderName()
let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
let runtimeErrors: ReturnType<typeof attachRuntimeErrorCollector> | undefined

async function launchPage(route: string, readySelector: string) {
  const page = await miniProgram?.reLaunch(route)
  if (!page) {
    throw new Error(`Failed to launch JSX/TSX route: ${route}`)
  }
  await page.waitForRendered({ selector: readySelector, timeout: 20_000 })
  return page
}

async function waitForData(page: any, path: string, expected: unknown, timeoutMs = 10_000) {
  const startedAt = Date.now()
  let latest: unknown
  while (Date.now() - startedAt <= timeoutMs) {
    latest = await page.data(path)
    if (latest === expected) {
      return latest
    }
    await page.waitFor(120)
  }
  throw new Error(`Timed out waiting ${path}=${JSON.stringify(expected)}; latest=${JSON.stringify(latest)}`)
}

describe(`wevu JSX/TSX runtime [${runtimeProvider}]`, { concurrent: false }, () => {
  beforeAll(async () => {
    await buildWevuJsxApp('weapp', 'cjs')
    miniProgram = await launchAutomator({
      projectPath: WEVU_JSX_APP_ROOT,
      refreshProjectAfterConnect: true,
      retryWarmupTimeout: true,
      skipRelaunchPageRootCheck: true,
      warmupAllowRelaunch: false,
      warmupAnyPage: true,
    })
    runtimeErrors = attachRuntimeErrorCollector(miniProgram)
  }, 360_000)

  afterAll(async () => {
    runtimeErrors?.dispose()
    await miniProgram?.close()
    miniProgram = undefined
  })

  it('runs JSX and Vue-imported TSX option components', async (context) => {
    const dom = createDomAcceptance(context, 'apps/wevu-jsx-tsx-demo', JSX_OPTION_CHECKPOINTS)
    const marker = runtimeErrors?.mark() ?? 0
    const jsxPage = await launchPage('/pages/jsx-basic/index', '#jsx-count')
    await dom.check('jsx:initial', miniProgram!, jsxPage)
    expect(await jsxPage.callMethodWithOptions('runE2E', { routeOnly: true })).toEqual({
      initial: 0,
      next: 1,
    })
    await waitForData(jsxPage, 'count', 1)
    await dom.check('jsx:incremented', miniProgram!, jsxPage)

    const vueTsxPage = await launchPage('/pages/vue-tsx/index', '#vue-tsx-state')
    await dom.check('vue-tsx:initial', miniProgram!, vueTsxPage)
    expect(await vueTsxPage.callMethodWithOptions('runE2E', { routeOnly: true })).toEqual({
      initial: true,
      next: false,
    })
    await waitForData(vueTsxPage, 'enabled', false)
    await dom.check('vue-tsx:disabled', miniProgram!, vueTsxPage)
    expect(runtimeErrors?.getSince(marker)).toEqual([])
  })

  it('renders cross-file TSX and dispatches dynamic island and component events', async (context) => {
    const dom = createDomAcceptance(context, 'apps/wevu-jsx-tsx-demo', JSX_ISLAND_CHECKPOINTS)
    const marker = runtimeErrors?.mark() ?? 0
    const page = await launchPage('/pages/tsx-basic/index', '#tsx-island-button')
    await dom.check('island:initial', miniProgram!, page)
    const result = await page.callMethodWithOptions('runE2E', { routeOnly: true, timeout: 30_000 })

    expect(result).toMatchObject({
      handlerId: expect.stringMatching(/^i0:\d+$/),
      initial: 0,
      next: 1,
      nodeKind: 'element',
      nodeTag: 'button',
    })
    await waitForData(page, 'islandCount', 1)
    await dom.check('island:incremented', miniProgram!, page)

    expect(await page.callMethodWithOptions('emitInfoCardChange', { routeOnly: true })).toBe(true)
    await waitForData(page, 'lastCardEvent', 'info-card-change')
    await dom.check('island:component-event', miniProgram!, page)
    expect(runtimeErrors?.getSince(marker)).toEqual([])
  })

  it('runs setup render closures and SFC JSX/TSX script modes', async (context) => {
    const dom = createDomAcceptance(context, 'apps/wevu-jsx-tsx-demo', JSX_SETUP_CHECKPOINTS)
    const marker = runtimeErrors?.mark() ?? 0
    const setupPage = await launchPage('/pages/setup-render/index', '#setup-render-count')
    await dom.check('setup:initial', miniProgram!, setupPage)
    await setupPage.callMethodWithOptions('increment', { routeOnly: true })
    await waitForData(setupPage, 'count', 3)
    await dom.check('setup:incremented', miniProgram!, setupPage)

    const sfcJsxPage = await launchPage('/pages/sfc-script-jsx/index', '#sfc-jsx-count')
    await dom.check('sfc-jsx:initial', miniProgram!, sfcJsxPage)
    expect(await sfcJsxPage.callMethodWithOptions('runE2E', { routeOnly: true })).toEqual({
      initial: 4,
      next: 5,
    })
    await waitForData(sfcJsxPage, 'count', 5)
    await dom.check('sfc-jsx:incremented', miniProgram!, sfcJsxPage)

    const sfcSetupPage = await launchPage('/pages/sfc-script-setup-tsx/index', '#sfc-setup-tsx-label')
    await dom.check('sfc-setup:initial', miniProgram!, sfcSetupPage)
    await sfcSetupPage.callMethodWithOptions('__weapp_vite_inline', { routeOnly: true }, {
      currentTarget: {
        dataset: {
          wiTap: 'i0',
        },
      },
      type: 'tap',
    })
    await waitForData(sfcSetupPage, 'label', 'setup-tsx-updated')
    await dom.check('sfc-setup:updated', miniProgram!, sfcSetupPage)
    expect(runtimeErrors?.getSince(marker)).toEqual([])
  })
})
