import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/wevu-subpackage-placement')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

function normalizeRoute(value: string) {
  return String(value || '').replace(/^\/+/, '').replace(/\/+$/g, '')
}

async function waitForRenderedPage(page: any, route: string, timeoutMs = 15_000) {
  const start = Date.now()
  let latest: unknown
  while (Date.now() - start <= timeoutMs) {
    if (typeof page?.renderedNodes === 'function') {
      latest = await page.renderedNodes('.page', {
        timeout: 5_000,
      })
      if (Array.isArray(latest) && latest.length > 0) {
        return latest
      }
    }
    await page.waitFor(220)
  }
  throw new Error(`Timed out waiting rendered page for ${route}; latest=${JSON.stringify(latest)}`)
}

async function buildFixture() {
  await fs.remove(DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: 'ide:wevu-subpackage-placement',
  })
}

async function openRoute(miniProgram: any, route: string, options: { preferCurrent?: boolean } = {}) {
  if (options.preferCurrent) {
    const currentPage = await miniProgram.currentPage({
      appFunctionFallback: false,
      retries: 1,
      timeout: 2_500,
    }).catch(() => null)
    if (normalizeRoute(currentPage?.path) === normalizeRoute(route)) {
      return currentPage
    }
  }
  return await miniProgram.reLaunch(route)
}

let sharedMiniProgram: any = null
let sharedBuildPrepared = false

async function getSharedMiniProgram() {
  if (!sharedBuildPrepared) {
    await buildFixture()
    sharedBuildPrepared = true
  }
  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      skipWarmup: true,
      timeout: 120_000,
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

describe.sequential('e2e app: wevu-subpackage-placement', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('reLaunches main, normal subpackage, and independent subpackage vue routes', async () => {
    const miniProgram = await getSharedMiniProgram()

    const routeCases = [
      {
        route: '/pages/index/index',
        expected: { count: 1, double: 2 },
      },
      {
        route: '/subpackages/normal-wevu/pages/entry/index',
        expected: { count: 1, double: 2 },
      },
      {
        route: '/subpackages/normal-wevu/pages/detail/index',
        expected: { count: 1, double: 2, from: 'direct' },
      },
      {
        route: '/subpackages/independent-wevu/pages/entry/index',
        expected: { count: 11, double: 22 },
      },
      {
        route: '/subpackages/independent-wevu/pages/detail/index',
        expected: { count: 11, double: 22, from: 'direct' },
      },
    ]

    for (const [index, routeCase] of routeCases.entries()) {
      const page = await openRoute(miniProgram, routeCase.route, {
        preferCurrent: index === 0,
      })
      if (!page) {
        throw new Error(`Failed to launch route: ${routeCase.route}`)
      }

      await waitForRenderedPage(page, routeCase.route)
      await expect(page.callMethodWithOptions('runE2E', { routeOnly: true })).resolves.toMatchObject(routeCase.expected)
    }
  })
})
