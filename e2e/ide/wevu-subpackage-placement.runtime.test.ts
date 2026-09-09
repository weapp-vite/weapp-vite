import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'
import { subpackagePlacementCheckpoints, subpackagePlacementRoutes } from './subpackagePlacementDom'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/wevu-subpackage-placement')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

function normalizeRoute(value: string) {
  return String(value || '').replace(/^\/+/, '').replace(/\/+$/g, '')
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
      retryWarmupTimeout: true,
      timeout: 120_000,
      warmupRootSelectors: ['.page'],
      warmupRoute: '/pages/index/index',
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

describe('e2e app: wevu-subpackage-placement', { concurrent: false }, () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('reLaunches main, normal subpackage, and independent subpackage vue routes', async (context) => {
    const dom = createDomAcceptance(context, 'e2e-apps/wevu-subpackage-placement', subpackagePlacementCheckpoints)
    const miniProgram = await getSharedMiniProgram()
    for (const [index, routeCase] of subpackagePlacementRoutes.entries()) {
      const page = await openRoute(miniProgram, routeCase.route, {
        preferCurrent: index === 0,
      })
      if (!page) {
        throw new Error(`Failed to launch route: ${routeCase.route}`)
      }

      await dom.check(`${routeCase.id}:initial`, miniProgram, page)
      await expect(page.callMethodWithOptions('runE2E', { routeOnly: true })).resolves.toMatchObject(routeCase.expected)
      await dom.check(`${routeCase.id}:result`, miniProgram, page)
    }
  })
})
