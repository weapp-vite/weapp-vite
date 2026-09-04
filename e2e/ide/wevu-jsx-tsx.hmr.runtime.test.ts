import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { waitForFileContains, waitForStatefulHmrControl } from '../utils/hmr-helpers'
import { cleanDevtoolsCache, cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import {
  WEVU_JSX_APP_ROOT,
  WEVU_JSX_CLI_PATH,
  WEVU_JSX_DIST_ROOT,
} from '../utils/wevu-jsx-tsx'

const ROUTE = '/pages/tsx-basic/index'
const PAGE_SOURCE = path.join(WEVU_JSX_APP_ROOT, 'src/pages/tsx-basic/index.tsx')
const SHARED_SOURCE = path.join(WEVU_JSX_APP_ROOT, 'src/shared.tsx')
const PAGE_OUTPUT = path.join(WEVU_JSX_DIST_ROOT, 'pages/tsx-basic/index.wxml')
const CONTROL_OUTPUT = path.join(WEVU_JSX_DIST_ROOT, '__weapp_vite_hmr/control.js')

let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
let devProcess: ReturnType<typeof startDevProcess> | undefined
let originalPageSource = ''
let originalSharedSource = ''

async function readClientVersion() {
  return await miniProgram!.evaluate(() => {
    const client = (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__
    return typeof client?.getVersion === 'function' ? Number(client.getVersion()) : -1
  })
}

async function readRuntimeState() {
  return await miniProgram!.evaluate(() => {
    const pages = getCurrentPages()
    const page = pages[pages.length - 1] as any
    return {
      count: Number(page?.data?.islandCount),
      identity: String(page?.__jsxHmrIdentity ?? ''),
      route: String(page?.route ?? page?.__route__ ?? ''),
    }
  }) as { count: number, identity: string, route: string }
}

describe('wevu JSX/TSX stateful HMR in real WeChat DevTools', { concurrent: false }, () => {
  beforeAll(async () => {
    await cleanupResidualDevProcesses()
    await cleanupResidualIdeProcesses()
    await cleanDevtoolsCache('all', { cwd: WEVU_JSX_APP_ROOT })
    originalPageSource = await fs.readFile(PAGE_SOURCE, 'utf8')
    originalSharedSource = await fs.readFile(SHARED_SOURCE, 'utf8')
    await fs.remove(WEVU_JSX_DIST_ROOT)

    devProcess = startDevProcess(process.execPath, [
      WEVU_JSX_CLI_PATH,
      'dev',
      WEVU_JSX_APP_ROOT,
      '--platform',
      'weapp',
      '--skipNpm',
    ], {
      all: true,
      cwd: WEVU_JSX_APP_ROOT,
      env: createDevProcessEnv(),
      reject: false,
    })
    await devProcess.waitFor(
      waitForStatefulHmrControl(CONTROL_OUTPUT),
      'JSX stateful HMR control ready',
    )

    miniProgram = await launchAutomator({
      deferBridgeWrapperSyncUntilConnected: true,
      launchMode: 'bridge',
      maxLaunchRetries: 1,
      projectPath: WEVU_JSX_APP_ROOT,
      retryWarmupTimeout: true,
      timeout: 120_000,
      warmupAllowRelaunch: false,
      warmupAnyPage: true,
      warmupRootSelectors: ['#tsx-island-button'],
      warmupRoute: ROUTE,
    })
  }, 600_000)

  afterAll(async () => {
    try {
      await miniProgram?.disconnect?.()
    }
    catch {}
    miniProgram = undefined
    await devProcess?.stop(5_000)
    devProcess = undefined
    await fs.writeFile(PAGE_SOURCE, originalPageSource, 'utf8')
    await fs.writeFile(SHARED_SOURCE, originalSharedSource, 'utf8')
    await cleanupResidualDevProcesses()
    await cleanupResidualIdeProcesses()
  }, 60_000)

  it('preserves instance state while replacing shared TSX and island handlers', async () => {
    const page = await miniProgram!.reLaunch(ROUTE)
    if (!page) {
      throw new Error(`Failed to launch ${ROUTE}`)
    }
    await page.waitForRendered({ selector: '#tsx-island-button', timeout: 30_000 })
    await miniProgram!.evaluate(() => {
      const pages = getCurrentPages()
      const current = pages[pages.length - 1] as any
      current.__jsxHmrIdentity = 'jsx-hmr-instance'
    })

    const initial = await page.callMethodWithOptions('runE2E', { routeOnly: true, timeout: 30_000 })
    expect(initial).toMatchObject({ initial: 0, next: 1 })
    const initialVersion = await readClientVersion()

    const sharedMarker = 'HMR-SHARED-FRAGMENT-UPDATED'
    const updatedShared = originalSharedSource.replace('跨文件静态 JSX fragment', sharedMarker)
    expect(updatedShared).not.toBe(originalSharedSource)
    await fs.writeFile(SHARED_SOURCE, updatedShared, 'utf8')
    await devProcess!.waitFor(waitForFileContains(PAGE_OUTPUT, sharedMarker), 'shared TSX HMR output')
    expect(await readClientVersion()).toBe(initialVersion)
    expect(await readRuntimeState()).toEqual({
      count: 1,
      identity: 'jsx-hmr-instance',
      route: 'pages/tsx-basic/index',
    })

    const updatedPage = originalPageSource.replace('纯 TSX（.tsx）', 'HMR-TSX-PAGE-UPDATED')
    expect(updatedPage).not.toBe(originalPageSource)
    await fs.writeFile(PAGE_SOURCE, updatedPage, 'utf8')
    await devProcess!.waitFor(
      waitForFileContains(PAGE_OUTPUT, 'HMR-TSX-PAGE-UPDATED'),
      'TSX page HMR output',
    )
    expect(await readRuntimeState()).toEqual({
      count: 1,
      identity: 'jsx-hmr-instance',
      route: 'pages/tsx-basic/index',
    })
  }, 180_000)
})
