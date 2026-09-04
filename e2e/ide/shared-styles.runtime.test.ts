import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator, resetAutomatorRuntimeLogs } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'

const REPO_ROOT = path.resolve(import.meta.dirname, '../..')
const CLI_PATH = path.join(REPO_ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.join(
  REPO_ROOT,
  'test/fixture-projects/weapp-vite/subPackages-shared-styles',
)
let miniProgram: any

function runWithTimeout<T>(factory: () => Promise<T>, timeoutMs: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    factory(),
    new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`Timeout in ${label} after ${timeoutMs}ms`)), timeoutMs)
    }),
  ]).finally(() => clearTimeout(timer))
}

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

async function readStyle(element: any, property: string, route: string) {
  return await runWithTimeout(
    () => element.style(property),
    5_000,
    `read ${property} on ${route}`,
  )
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

  it('loads main, normal subpackage and independent subpackage styles in one session', async () => {
    const provider = resolveRuntimeProviderName()
    const mainPage = await relaunch('/pages/index/index', '#shared-styles-main-page')
    resetAutomatorRuntimeLogs(miniProgram)
    const mainProbe = await mainPage.$('#shared-styles-main-page')
    expect(mainProbe).not.toBeNull()
    const mainColor = provider === 'devtools'
      ? await readStyle(mainProbe, 'color', '/pages/index/index')
      : undefined
    const mainBorderColor = provider === 'devtools'
      ? await readStyle(mainProbe, 'border-top-color', '/pages/index/index')
      : undefined

    const normalPage = await relaunch('/packageA/pages/foo/index', '#shared-styles-normal-page')
    const normalProbe = await normalPage.$('#shared-styles-normal-page')
    expect(normalProbe).not.toBeNull()
    const normalColor = provider === 'devtools'
      ? await readStyle(normalProbe, 'color', '/packageA/pages/foo/index')
      : undefined
    const normalBorderColor = provider === 'devtools'
      ? await readStyle(normalProbe, 'border-top-color', '/packageA/pages/foo/index')
      : undefined

    const independentPage = await relaunch('/packageB/pages/bar/index', '#shared-styles-independent-page')
    const independentProbe = await independentPage.$('#shared-styles-independent-page')
    expect(independentProbe).not.toBeNull()
    const independentColor = provider === 'devtools'
      ? await readStyle(independentProbe, 'color', '/packageB/pages/bar/index')
      : undefined

    // DevTools emits one anonymous console error for each Element.getStyles query.
    // The style values are asserted above; clear this protocol noise before checking app errors.
    resetAutomatorRuntimeLogs(miniProgram)

    if (provider === 'devtools') {
      expect(mainColor).toBe('rgb(51, 103, 214)')
      expect(mainBorderColor).toBe('rgb(15, 118, 110)')
      expect(normalColor).toBe('rgb(51, 103, 214)')
      expect(normalBorderColor).toBe('rgb(15, 118, 110)')
      expect(independentColor).not.toBe('rgb(51, 103, 214)')
    }

    const runtimeErrors = miniProgram?.__weappViteRuntimeLogMeta?.entries
      ?.filter((entry: { level?: string }) => entry.level === 'error' || entry.level === 'exception')
      ?? []
    expect(runtimeErrors).toEqual([])
  })
})
