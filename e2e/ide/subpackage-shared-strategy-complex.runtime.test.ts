import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')

interface FixtureSuiteOptions {
  suiteName: string
  label: string
  appRoot: string
  warmupRootSelector: string
  routes: Array<{
    dataPaths: string[]
    expected: string[]
    rootSelector: string
    route: string
  }>
}

const ROUTE_RENDER_TIMEOUT = 15_000
const ROUTE_RENDER_POLL_DELAY = 250

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function stringifyDataValue(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value)
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
  const { suiteName, label, appRoot, routes, warmupRootSelector } = options

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
        warmupRootSelectors: [warmupRootSelector],
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

  describe.sequential(suiteName, () => {
    afterAll(async () => {
      await closeSharedMiniProgram()
    })

    it('reLaunches all key routes and renders shared markers', async () => {
      const miniProgram = await getSharedMiniProgram()

      try {
        for (const routeCase of routes) {
          const page = await miniProgram.reLaunch(routeCase.route)
          if (!page) {
            throw new Error(`Failed to launch route: ${routeCase.route}`)
          }

          const renderedSnapshot = await readRenderedRouteSnapshot(page, routeCase)

          for (const token of routeCase.expected) {
            expect(renderedSnapshot).toContain(token)
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
  warmupRootSelector: '#complex-a-main',
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
  warmupRootSelector: '#complex-b-home',
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
