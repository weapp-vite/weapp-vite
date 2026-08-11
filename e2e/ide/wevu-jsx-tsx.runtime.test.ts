import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import {
  buildWevuJsxApp,
  WEVU_JSX_APP_ROOT,
} from '../utils/wevu-jsx-tsx'
import { attachRuntimeErrorCollector } from './runtimeErrors'

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

describe.sequential(`wevu JSX/TSX runtime [${runtimeProvider}]`, () => {
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

  it('runs JSX and Vue-imported TSX option components', async () => {
    const marker = runtimeErrors?.mark() ?? 0
    const jsxPage = await launchPage('/pages/jsx-basic/index', '#jsx-count')
    expect(await jsxPage.callMethodWithOptions('runE2E', { routeOnly: true })).toEqual({
      initial: 0,
      next: 1,
    })
    await waitForData(jsxPage, 'count', 1)

    const vueTsxPage = await launchPage('/pages/vue-tsx/index', '#vue-tsx-state')
    expect(await vueTsxPage.callMethodWithOptions('runE2E', { routeOnly: true })).toEqual({
      initial: true,
      next: false,
    })
    await waitForData(vueTsxPage, 'enabled', false)
    expect(runtimeErrors?.getSince(marker)).toEqual([])
  })

  it('renders cross-file TSX and dispatches dynamic island and component events', async () => {
    const marker = runtimeErrors?.mark() ?? 0
    const page = await launchPage('/pages/tsx-basic/index', '#tsx-island-button')
    const result = await page.callMethodWithOptions('runE2E', { routeOnly: true, timeout: 30_000 })

    expect(result).toMatchObject({
      handlerId: expect.stringMatching(/^i0:\d+$/),
      initial: 0,
      next: 1,
      nodeKind: 'element',
      nodeTag: 'button',
    })
    await waitForData(page, 'islandCount', 1)

    expect(await page.callMethodWithOptions('emitInfoCardChange', { routeOnly: true })).toBe(true)
    await waitForData(page, 'lastCardEvent', 'info-card-change')
    expect(runtimeErrors?.getSince(marker)).toEqual([])
  })

  it('runs setup render closures and SFC JSX/TSX script modes', async () => {
    const marker = runtimeErrors?.mark() ?? 0
    const setupPage = await launchPage('/pages/setup-render/index', '#setup-render-count')
    await setupPage.callMethodWithOptions('increment', { routeOnly: true })
    await waitForData(setupPage, 'count', 3)

    const sfcJsxPage = await launchPage('/pages/sfc-script-jsx/index', '#sfc-jsx-count')
    expect(await sfcJsxPage.callMethodWithOptions('runE2E', { routeOnly: true })).toEqual({
      initial: 4,
      next: 5,
    })
    await waitForData(sfcJsxPage, 'count', 5)

    const sfcSetupPage = await launchPage('/pages/sfc-script-setup-tsx/index', '#sfc-setup-tsx-label')
    await sfcSetupPage.callMethodWithOptions('__weapp_vite_inline', { routeOnly: true }, {
      currentTarget: {
        dataset: {
          wiTap: 'i0',
        },
      },
      type: 'tap',
    })
    await waitForData(sfcSetupPage, 'label', 'setup-tsx-updated')
    expect(runtimeErrors?.getSince(marker)).toEqual([])
  })
})
