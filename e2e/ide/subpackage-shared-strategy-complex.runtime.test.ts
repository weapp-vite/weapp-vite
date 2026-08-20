import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { isLikelyRelaunchRetryableError, launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')

interface FixtureSuiteOptions {
  suiteName: string
  label: string
  appRoot: string
  routes: Array<{
    dataPaths: string[]
    expected: string[]
    rootSelector: string
    route: string
  }>
}

const ROUTE_RENDER_TIMEOUT = 15_000
const ROUTE_RENDER_POLL_DELAY = 250
const ROUTE_LAUNCH_ATTEMPTS = 3
const ROUTE_RECOVERY_DELAY = 800

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function stringifyDataValue(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function compactErrorMessage(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').trim()
}

function isRecoverableDevtoolsRouteError(error: unknown) {
  const message = compactErrorMessage(error)
  return isLikelyRelaunchRetryableError(error)
    || message.includes('DevTools did not respond to protocol method')
    || message.includes('DEVTOOLS_PROTOCOL_TIMEOUT')
    || message.includes('Execution context was destroyed')
    || message.includes('Target closed')
    || message.includes('Connection closed')
    || message.includes('WebSocket is not open')
    || message.includes('socket hang up')
}

function normalizeRoute(route: string) {
  return route.split('?', 1)[0].replace(/^\/+/, '').replace(/\/+$/g, '')
}

function isExpectedRoutePage(page: any, route: string) {
  return normalizeRoute(String(page?.path ?? '')) === normalizeRoute(route)
}

async function readRenderedRouteSnapshot(page: any, routeCase: FixtureSuiteOptions['routes'][number]) {
  if (typeof page?.waitForRendered === 'function') {
    await page.waitForRendered({
      selector: routeCase.rootSelector,
      timeout: ROUTE_RENDER_TIMEOUT,
    })
  }

  const start = Date.now()
  let latestSnapshot = ''

  while (Date.now() - start <= ROUTE_RENDER_TIMEOUT) {
    const values = await Promise.all(routeCase.dataPaths.map(async dataPath => page.data(dataPath)))
    latestSnapshot = values.map(stringifyDataValue).join('|')
    if (routeCase.expected.every(token => latestSnapshot.includes(token))) {
      return latestSnapshot
    }
    await sleep(ROUTE_RENDER_POLL_DELAY)
  }

  throw new Error(`Timed out waiting route data markers: route=${routeCase.route} selector=${routeCase.rootSelector} dataPaths=${routeCase.dataPaths.join(',')} latest=${latestSnapshot.slice(0, 500)}`)
}

function createRuntimeSuite(options: FixtureSuiteOptions) {
  const { suiteName, label, appRoot, routes } = options

  async function runBuild() {
    const outputRoot = path.join(appRoot, 'dist')
    await fs.remove(outputRoot)

    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: appRoot,
      platform: 'weapp',
      cwd: appRoot,
      label,
      skipNpm: true,
    })
  }

  let sharedMiniProgram: any = null
  let sharedBuildPrepared = false

  async function getSharedMiniProgram() {
    if (!sharedBuildPrepared) {
      await runBuild()
      sharedBuildPrepared = true
    }
    if (!sharedMiniProgram) {
      sharedMiniProgram = await launchAutomator({
        projectPath: appRoot,
        skipRelaunchPageRootCheck: true,
        skipWarmup: true,
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

  async function restartSharedMiniProgram(route: string, attempt: number, error: unknown) {
    process.stdout.write(`[subpackage-shared-strategy:route-recover] label=${label} route=${route} attempt=${attempt}/${ROUTE_LAUNCH_ATTEMPTS} reason=${compactErrorMessage(error).slice(0, 240)}\n`)
    await closeSharedMiniProgram().catch(() => {})
    await sleep(ROUTE_RECOVERY_DELAY)
    return await getSharedMiniProgram()
  }

  async function relaunchRouteAndReadSnapshot(routeCase: FixtureSuiteOptions['routes'][number]) {
    let lastError: unknown

    for (let attempt = 1; attempt <= ROUTE_LAUNCH_ATTEMPTS; attempt += 1) {
      const miniProgram = await getSharedMiniProgram()
      try {
        process.stdout.write(`[subpackage-shared-strategy:route] label=${label} route=${routeCase.route} attempt=${attempt}/${ROUTE_LAUNCH_ATTEMPTS}\n`)
        const currentPage = await miniProgram.currentPage?.({
          appFunctionFallback: false,
        }).catch(() => null)
        const page = isExpectedRoutePage(currentPage, routeCase.route)
          ? currentPage
          : await miniProgram.reLaunch(routeCase.route)
        if (!page) {
          throw new Error(`Failed to launch route: ${routeCase.route}`)
        }

        return {
          miniProgram,
          renderedSnapshot: await readRenderedRouteSnapshot(page, routeCase),
        }
      }
      catch (error) {
        lastError = error
        if (attempt >= ROUTE_LAUNCH_ATTEMPTS || !isRecoverableDevtoolsRouteError(error)) {
          throw error
        }
        await restartSharedMiniProgram(routeCase.route, attempt, error)
      }
    }

    throw new Error(`Failed to launch route ${routeCase.route}: ${compactErrorMessage(lastError ?? 'route data not ready')}`)
  }

  describe.sequential(suiteName, () => {
    afterAll(async () => {
      await closeSharedMiniProgram()
    })

    it('reLaunches all key routes and renders shared markers', async () => {
      let miniProgram = await getSharedMiniProgram()

      try {
        for (const routeCase of routes) {
          const result = await relaunchRouteAndReadSnapshot(routeCase)
          miniProgram = result.miniProgram

          for (const token of routeCase.expected) {
            expect(result.renderedSnapshot).toContain(token)
          }
        }
      }
      finally {
        await releaseSharedMiniProgram(miniProgram)
      }
    })
  })
}

createRuntimeSuite({
  suiteName: 'e2e app: subpackage-shared-strategy-complex-a runtime',
  label: 'ide:subpackage-shared-strategy-complex-a',
  appRoot: path.resolve(import.meta.dirname, '../../e2e-apps/subpackage-shared-strategy-complex-a'),
  routes: [
    {
      route: '/pages/index/index',
      rootSelector: '#complex-a-main',
      dataPaths: ['mainSummary'],
      expected: ['__SP_COMPLEX_A_CORE__', '__SP_COMPLEX_A_TRANSITIVE__'],
    },
    {
      route: '/subpackages/item/index',
      rootSelector: '#complex-a-item',
      dataPaths: ['itemSummary'],
      expected: ['__SP_COMPLEX_A_SUB_ONLY__', '__SP_COMPLEX_A_NPM_SUB_ONLY__', '__SP_COMPLEX_A_PAIR_ONLY__', '__SP_COMPLEX_A_NPM_SINGLE__'],
    },
    {
      route: '/subpackages/user/index',
      rootSelector: '#complex-a-user',
      dataPaths: ['userSummary', 'asyncSummary'],
      expected: ['__SP_COMPLEX_A_SUB_ONLY__', '__SP_COMPLEX_A_NPM_SUB_ONLY__', '__SP_COMPLEX_A_PAIR_ONLY__'],
    },
    {
      route: '/subpackages/report/index',
      rootSelector: '#complex-a-report',
      dataPaths: ['reportSummary'],
      expected: ['__SP_COMPLEX_A_SUB_ONLY__', '__SP_COMPLEX_A_NPM_SUB_ONLY__'],
    },
  ],
})

createRuntimeSuite({
  suiteName: 'e2e app: subpackage-shared-strategy-complex-b runtime',
  label: 'ide:subpackage-shared-strategy-complex-b',
  appRoot: path.resolve(import.meta.dirname, '../../e2e-apps/subpackage-shared-strategy-complex-b'),
  routes: [
    {
      route: '/pages/home/index',
      rootSelector: '#complex-b-home',
      dataPaths: ['homeSummary'],
      expected: ['__SP_COMPLEX_B_BASE__', '__SP_COMPLEX_B_MATH__'],
    },
    {
      route: '/subpackages/alpha/index',
      rootSelector: '#complex-b-alpha',
      dataPaths: ['alphaSummary'],
      expected: ['__SP_COMPLEX_B_RUNTIME_CHAIN__', '__SP_COMPLEX_B_EDGE__', '__SP_COMPLEX_B_NPM_SUB_ONLY__'],
    },
    {
      route: '/subpackages/beta/index',
      rootSelector: '#complex-b-beta',
      dataPaths: ['betaSummary'],
      expected: ['__SP_COMPLEX_B_CLUSTER__', '__SP_COMPLEX_B_NPM_SUB_ONLY__', '__SP_COMPLEX_B_NPM_SINGLE__'],
    },
    {
      route: '/subpackages/gamma/index',
      rootSelector: '#complex-b-gamma',
      dataPaths: ['gammaSummary', 'lazySummary'],
      expected: ['__SP_COMPLEX_B_RUNTIME_CHAIN__', '__SP_COMPLEX_B_EDGE__', '__SP_COMPLEX_B_NPM_SUB_ONLY__'],
    },
  ],
})
