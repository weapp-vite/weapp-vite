import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { sharedStyleCheckpoints } from './coreWorkflowDom'

const REPO_ROOT = path.resolve(import.meta.dirname, '../..')
const CLI_PATH = path.join(REPO_ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.join(
  REPO_ROOT,
  'test/fixture-projects/weapp-vite/subPackages-shared-styles',
)
let miniProgram: any

async function relaunch(route: string, selector: string) {
  const normalizedRoute = route.replace(/^\//, '')
  const currentPage = await miniProgram.currentPage({ appFunctionFallback: false }).catch(() => null)
  const page = currentPage?.path === normalizedRoute
    ? currentPage
    : await miniProgram.reLaunch(route)
  if (!page) {
    throw new Error(`Failed to reLaunch shared styles route: ${route}`)
  }
  await page.waitForRendered({ selector, timeout: 10_000 })
  return page
}

describe('e2e app: main-package shared styles', { concurrent: false }, () => {
  beforeAll(async () => {
    if (resolveRuntimeProviderName() === 'devtools') {
      await cleanupResidualIdeProcesses()
    }
    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: APP_ROOT,
      platform: 'weapp',
      skipNpm: true,
      label: 'ide:shared-styles',
    })
    miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      skipRelaunchPageRootCheck: true,
      skipWarmup: true,
    })
  }, 120_000)

  afterAll(async () => {
    await miniProgram?.close?.()
    miniProgram = undefined
    if (resolveRuntimeProviderName() === 'devtools') {
      await cleanupResidualIdeProcesses()
    }
  })

  it('loads main, normal subpackage and independent subpackage styles in one session', async (ctx) => {
    const provider = resolveRuntimeProviderName()
    const dom = createDomAcceptance(ctx, 'test/fixture-projects/weapp-vite/subPackages-shared-styles', sharedStyleCheckpoints(provider))
    const mainPage = await relaunch('/pages/index/index', '#shared-styles-main-page')
    await dom.check('main', miniProgram, mainPage)

    const normalPage = await relaunch('/packageA/pages/foo/index', '#shared-styles-normal-page')
    await dom.check('subpackage', miniProgram, normalPage)

    const independentPage = await relaunch('/packageB/pages/bar/index', '#shared-styles-independent-page')
    await dom.check('independent', miniProgram, independentPage)

    const runtimeErrors = miniProgram?.__weappViteRuntimeLogMeta?.entries
      ?.filter((entry: { level?: string }) => entry.level === 'error' || entry.level === 'exception')
      ?? []
    expect(runtimeErrors).toEqual([])
  })
})
