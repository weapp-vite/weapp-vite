import fs from 'node:fs/promises'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'
import { cleanDevtoolsCache, cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { counterCheckpoint, GENERIC_ROUTE, INTEROP_EDGES, INTEROP_ROUTE, interopCheckpoint, REACT_FIXTURE, reactControl, STATIC_ROUTE } from './reactRuntimeDom'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/react-runtime-spike')
const DIST_ROOT = path.resolve(APP_ROOT, 'dist')
const PAGE_READY_TIMEOUT = 20_000
const STARTUP_READY_TIMEOUT = 15_000
const STARTUP_ATTEMPTS = 3

let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
const runtimeProvider = resolveRuntimeProviderName()

function getMiniProgram() {
  if (!miniProgram) {
    throw new Error('React runtime spike automator is not initialized')
  }
  return miniProgram
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForReactRuntimePageReady(
  app: Awaited<ReturnType<typeof launchAutomator>>,
  route: string,
  predicate: (page: any) => boolean,
  timeoutMs = PAGE_READY_TIMEOUT,
) {
  const startedAt = Date.now()
  let lastResult: unknown

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      lastResult = await app.evaluate((expectedRoute: string) => {
        const normalizeRoute = (value: unknown) => String(value || '')
          .split('?', 1)[0]
          .split('#', 1)[0]
          .replace(/^\/+/, '')
          .replace(/\/+$/g, '')
        const expected = normalizeRoute(expectedRoute)
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
        const page = pages
          .slice()
          .reverse()
          .find((item: any) => [item?.route, item?.__route__, item?.path]
            .some(value => normalizeRoute(value) === expected)) as any
        return {
          data: page?.data,
          hasReactEventHandler: typeof page?.__weapp_vite_react_event === 'function',
          hasRuntimeEventHandler: typeof page?.eh === 'function',
          ready: Boolean(page),
          route: page?.route || page?.__route__ || page?.path || '',
        }
      }, route)
      if ((lastResult as any)?.ready && predicate(lastResult)) {
        return lastResult
      }
    }
    catch (error) {
      lastResult = {
        error: error instanceof Error ? error.message : String(error),
      }
    }
    await delay(220)
  }

  throw new Error(`Timed out waiting React runtime page ${route}; lastResult=${JSON.stringify(lastResult)}`)
}

async function closeReactRuntimeSpikeAutomator(app: Awaited<ReturnType<typeof launchAutomator>> | undefined) {
  try {
    await app?.close()
  }
  catch {}
}

async function launchReactRuntimeSpikeAutomator() {
  let lastError: unknown

  for (let attempt = 1; attempt <= STARTUP_ATTEMPTS; attempt += 1) {
    const app = await launchAutomator({
      projectPath: APP_ROOT,
      engineBuildFallbackSettleMs: 5_000,
      maxLaunchRetries: 7,
      refreshProjectAfterConnect: true,
      skipRelaunchPageRootCheck: true,
      skipWarmup: true,
    })

    try {
      await app.reLaunch('/pages/index/index')
      await waitForReactRuntimePageReady(
        app,
        '/pages/index/index',
        result => Array.isArray(result?.data?.root?.cn),
        STARTUP_READY_TIMEOUT,
      )
      return app
    }
    catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      process.stdout.write(`[react-runtime-spike:start-retry] attempt=${attempt}/${STARTUP_ATTEMPTS} reason=${message.replace(/\s+/g, ' ').slice(0, 240)}\n`)
      await closeReactRuntimeSpikeAutomator(app)
      if (attempt < STARTUP_ATTEMPTS) {
        await cleanDevtoolsCache('compile', { cwd: APP_ROOT }).catch(() => {})
        await cleanupResidualIdeProcesses().catch(() => {})
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'React runtime spike startup failed'))
}

describe('react runtime spike (weapp e2e)', { concurrent: false }, () => {
  beforeAll(async () => {
    await cleanupResidualIdeProcesses()
    await cleanDevtoolsCache('all', { cwd: APP_ROOT })
    await fs.rm(DIST_ROOT, { force: true, recursive: true })
    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: APP_ROOT,
      platform: 'weapp',
      cwd: APP_ROOT,
      label: 'ide:react-runtime-spike',
      skipNpm: true,
    })

    miniProgram = await launchReactRuntimeSpikeAutomator()
  }, 360_000)

  afterAll(async () => {
    await closeReactRuntimeSpikeAutomator(miniProgram)
    miniProgram = undefined
  })

  it('renders React hooks and dispatches host events through generic WXML', async (context) => {
    const dom = createDomAcceptance(context, REACT_FIXTURE, [
      counterCheckpoint({ id: 'initial', action: '首屏显示初始 hooks、context、输入和 keyed 列表', mode: 'generic', count: 0 }),
      counterCheckpoint({ id: 'incremented', action: '点击 increment 更新 count 和 memo doubled', mode: 'generic', count: 1 }),
      counterCheckpoint({ id: 'appended', action: '点击 append 保留已有 keyed 项并新增 item-2', mode: 'generic', count: 1, appended: true }),
      counterCheckpoint({ id: 'input-updated', action: '输入 Ada 并渲染受控问候文本', mode: 'generic', count: 1, appended: true, name: 'Ada' }),
    ])
    const app = getMiniProgram()
    await app.reLaunch(GENERIC_ROUTE)
    const page = await app.currentPage()
    if (!page) {
      throw new Error('Failed to launch React runtime spike page')
    }
    await dom.check('initial', app, page)
    await (await reactControl(page, '#increment')).tap()
    await dom.check('incremented', app, page)
    await (await reactControl(page, '#append')).tap()
    await dom.check('appended', app, page)
    await (await reactControl(page, '#name-input')).input('Ada')
    await dom.check('input-updated', app, page)
  })

  it('renders the compiled native WXML page with binding-only payloads', async (context) => {
    const dom = createDomAcceptance(context, REACT_FIXTURE, [
      counterCheckpoint({ id: 'initial', action: '首屏显示静态绑定的 counter 和问候', mode: 'static', count: 0 }),
      counterCheckpoint({ id: 'incremented', action: '点击 increment 通过最小 setData payload 更新文本', mode: 'static', count: 1 }),
      counterCheckpoint({ id: 'input-updated', action: '输入 Ada 更新静态 input binding 和问候', mode: 'static', count: 1, name: 'Ada' }),
    ])
    const app = getMiniProgram()
    await app.reLaunch(STATIC_ROUTE)
    const page = await app.currentPage()
    if (!page) {
      throw new Error('Failed to launch React static binding spike page')
    }
    await dom.check('initial', app, page)

    const initialCount = await app.evaluate(() => {
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      const currentPage = pages[pages.length - 1] as any
      const originalSetData = currentPage.setData
      currentPage.__reactStaticPayloads = []
      currentPage.setData = function (payload: Record<string, unknown>, callback?: () => void) {
        currentPage.__reactStaticPayloads.push(payload)
        return originalSetData.call(currentPage, payload, callback)
      }
      return currentPage.data.slots.s3.text
    })

    await (await reactControl(page, '#increment')).tap()
    await dom.check('incremented', app, page)

    const result = await app.evaluate(() => {
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      const currentPage = pages[pages.length - 1] as any
      const payloads = currentPage.__reactStaticPayloads ?? []
      return {
        countAfterTap: currentPage.data.slots.s3.text,
        payloadBytes: payloads.map((payload: Record<string, unknown>) => JSON.stringify(payload).length),
        payloads,
      }
    }) as Record<string, any>

    expect(initialCount).toBe('count:0 doubled:0')
    expect(result.countAfterTap).toBe('count:1 doubled:2')
    expect(result.payloads).toEqual([{ 'slots.s3.text': 'count:1 doubled:2' }])
    expect(result.payloadBytes).toEqual([37])
    await (await reactControl(page, '#name-input')).input('Ada')
    await dom.check('input-updated', app, page)
  })

  it('passes props, change events and default slots across all six interop edges', async (context) => {
    const dom = createDomAcceptance(context, REACT_FIXTURE, [
      interopCheckpoint(0, runtimeProvider),
      ...INTEROP_EDGES.map((_, index) => interopCheckpoint(index + 1, runtimeProvider)),
    ])
    const app = getMiniProgram()
    await app.reLaunch(INTEROP_ROUTE)
    const page = await app.currentPage()
    if (!page) {
      throw new Error('Failed to launch React interop page')
    }
    await dom.check('initial', app, page)
    for (const edge of INTEROP_EDGES) {
      await (await reactControl(page, edge.action, edge.scope)).tap()
      await dom.check(edge.id, app, page)
    }

    const result = await page.callMethodWithOptions('_readInteropE2E', { routeOnly: true, timeout: 30_000 }) as Record<string, any>

    expect(result.props).toEqual([
      { label: 'react-to-native', value: 1 },
      { label: 'react-to-wevu', value: 2 },
      { label: 'native-to-wevu', value: 3 },
      { label: 'native-to-react', value: 4 },
      { label: 'wevu-to-native', value: 5 },
      { label: 'wevu-to-react', value: 6 },
    ])
    expect(result.reactResults).toEqual(['native:2', 'wevu:3'])
    expect(result.nativeParent).toMatchObject({ reactResult: 'react:5', wevuResult: 'wevu:4' })
    expect(result.wevuParent).toMatchObject({ nativeResult: 'native:6', reactResult: 'react:7' })
    expect(result.slots.map((slot: any) => slot.name)).toEqual([
      'react-to-native',
      'react-to-wevu',
      'native-to-wevu',
      'native-to-react',
      'wevu-to-native',
      'wevu-to-react',
    ])
  })
})
