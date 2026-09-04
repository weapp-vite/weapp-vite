import fs from 'node:fs/promises'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { cleanDevtoolsCache, cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'

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
          hasInteropRunner: typeof page?._runInteropE2E === 'function',
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

async function waitForReactInteropResult(
  app: Awaited<ReturnType<typeof launchAutomator>>,
  timeoutMs = PAGE_READY_TIMEOUT,
) {
  const startedAt = Date.now()
  let lastResult: unknown

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      lastResult = await app.evaluate(() => {
        return (async () => {
          const normalizeRoute = (value: unknown) => String(value || '')
            .split('?', 1)[0]
            .split('#', 1)[0]
            .replace(/^\/+/, '')
            .replace(/\/+$/g, '')
          const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
          const page = pages
            .slice()
            .reverse()
            .find((item: any) => [item?.route, item?.__route__, item?.path]
              .some(value => normalizeRoute(value) === 'pages/interop/index')) as any
          if (!page) {
            return {
              ok: false,
              reason: 'missing-page',
              routes: pages.map((item: any) => item?.route || item?.__route__ || item?.path || ''),
            }
          }
          if (typeof page._runInteropE2E !== 'function') {
            return {
              ok: false,
              reason: 'missing-method',
              route: page?.route || page?.__route__ || page?.path || '',
            }
          }
          try {
            const result = await page._runInteropE2E()
            return {
              ok: true,
              result,
            }
          }
          catch (error) {
            return {
              ok: false,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : '',
            }
          }
        })()
      })
      const result = (lastResult as any)?.result
      if ((lastResult as any)?.ok === true && Array.isArray(result?.props) && result.props.length === 6) {
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

  throw new Error(`Timed out waiting React interop result; lastResult=${JSON.stringify(lastResult)}`)
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

  it.runIf(runtimeProvider === 'devtools')('renders React hooks and dispatches host events through generic WXML', async () => {
    const app = getMiniProgram()
    await app.reLaunch('/pages/index/index')
    const page = await app.currentPage()
    if (!page) {
      throw new Error('Failed to launch React runtime spike page')
    }
    await waitForReactRuntimePageReady(app, '/pages/index/index', result => Array.isArray(result?.data?.root?.cn))

    const initialResult = await app.evaluate(() => {
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      const currentPage = pages[pages.length - 1] as any
      const findNode = (nodes: any[], predicate: (node: any) => boolean): any => {
        for (const node of nodes ?? []) {
          if (predicate(node)) {
            return node
          }
          const nested = findNode(node.cn, predicate)
          if (nested) {
            return nested
          }
        }
        return undefined
      }
      const readText = (id: string) => {
        const node = findNode(currentPage.data.root.cn, candidate => candidate.p?.id === id)
        return node?.cn?.map((child: any) => child.v ?? '').join('') ?? ''
      }
      const dispatch = (id: string) => {
        const node = findNode(currentPage.data.root.cn, candidate => candidate.p?.id === id)
        currentPage.eh({
          currentTarget: {
            dataset: {
              sid: node.sid,
            },
          },
          type: 'tap',
        })
      }

      const initialCount = readText('count')
      dispatch('increment')
      dispatch('append')
      return { initialCount }
    }) as Record<string, any>
    await page.waitFor(160)

    const result = await app.evaluate(() => {
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      const currentPage = pages[pages.length - 1] as any
      const findNode = (nodes: any[], predicate: (node: any) => boolean): any => {
        for (const node of nodes ?? []) {
          if (predicate(node)) {
            return node
          }
          const nested = findNode(node.cn, predicate)
          if (nested) {
            return nested
          }
        }
        return undefined
      }
      const readText = (id: string) => {
        const node = findNode(currentPage.data.root.cn, candidate => candidate.p?.id === id)
        return node?.cn?.map((child: any) => child.v ?? '').join('') ?? ''
      }
      let itemCount = 0
      const visit = (nodes: any[]) => {
        for (const node of nodes ?? []) {
          if (node.cl === 'item') {
            itemCount += 1
          }
          visit(node.cn)
        }
      }
      visit(currentPage.data.root.cn)
      return {
        countAfterTap: readText('count'),
        itemCount,
      }
    }) as Record<string, any>

    expect(initialResult.initialCount).toContain('count:0 doubled:0')
    expect(result.countAfterTap).toContain('count:1 doubled:2')
    expect(result.itemCount).toBe(3)
  })

  it.runIf(runtimeProvider === 'devtools')('renders the compiled native WXML page with binding-only payloads', async () => {
    const app = getMiniProgram()
    await app.reLaunch('/pages/static/index')
    const page = await app.currentPage()
    if (!page) {
      throw new Error('Failed to launch React static binding spike page')
    }
    await waitForReactRuntimePageReady(app, '/pages/static/index', result => Boolean(result?.data?.slots?.s3))

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

    await app.evaluate(() => {
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      const currentPage = pages[pages.length - 1] as any
      currentPage.eh({
        currentTarget: {
          dataset: {
            sid: 's4',
          },
        },
        type: 'tap',
      })
    })
    await page.waitFor(160)

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
  })

  it('passes props, change events and default slots across all six interop edges', async () => {
    const app = getMiniProgram()
    await app.reLaunch('/pages/interop/index')
    const page = await app.currentPage()
    if (!page) {
      throw new Error('Failed to launch React interop page')
    }
    await waitForReactRuntimePageReady(app, '/pages/interop/index', result => result?.hasInteropRunner === true)

    const interopPayload = await waitForReactInteropResult(app) as Record<string, any>
    const result = interopPayload.result as Record<string, any>

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
    for (const slot of result.slots) {
      expect(slot.width).toBeGreaterThan(0)
      expect(slot.height).toBeGreaterThan(0)
    }
  })
})
