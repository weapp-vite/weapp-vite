import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { waitForFileContains } from '../utils/hmr-helpers'
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

async function waitForClientVersion(previousVersion: number, timeoutMs = 45_000) {
  const startedAt = Date.now()
  let latest = previousVersion
  while (Date.now() - startedAt <= timeoutMs) {
    latest = await readClientVersion().catch(() => previousVersion)
    if (latest > previousVersion) {
      return latest
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error(`Timed out waiting JSX stateful HMR version after ${previousVersion}; latest=${latest}; output=${devProcess?.getOutput().slice(-6_000)}`)
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

describe.sequential('wevu JSX/TSX stateful HMR in real WeChat DevTools', () => {
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
      waitForFileContains(CONTROL_OUTPUT, 'http://127.0.0.1:'),
      'JSX stateful HMR control ready',
    )

    miniProgram = await launchAutomator({
      launchMode: 'bridge',
      projectPath: WEVU_JSX_APP_ROOT,
      retryWarmupTimeout: true,
      timeout: 120_000,
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
    await fs.writeFile(PAGE_SOURCE, originalPageSource, 'utf8')
    await fs.writeFile(SHARED_SOURCE, originalSharedSource, 'utf8')
    await devProcess?.stop(5_000)
    devProcess = undefined
    await cleanupResidualDevProcesses()
    await cleanupResidualIdeProcesses()
  })

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

    const sharedMarker = 'HMR-SHARED-FACTORY-UPDATED'
    const updatedShared = originalSharedSource.replace('跨文件参数化 JSX factory', sharedMarker)
    expect(updatedShared).not.toBe(originalSharedSource)
    await fs.writeFile(SHARED_SOURCE, updatedShared, 'utf8')
    await devProcess!.waitFor(waitForFileContains(PAGE_OUTPUT, sharedMarker), 'shared TSX HMR output')
    const sharedVersion = await waitForClientVersion(initialVersion)
    expect(await readRuntimeState()).toEqual({
      count: 1,
      identity: 'jsx-hmr-instance',
      route: 'pages/tsx-basic/index',
    })

    const updatedPage = originalPageSource.replace('this.islandCount += 1', 'this.islandCount += 2')
    expect(updatedPage).not.toBe(originalPageSource)
    await fs.writeFile(PAGE_SOURCE, updatedPage, 'utf8')
    await devProcess!.waitFor(
      waitForFileContains(path.join(WEVU_JSX_DIST_ROOT, 'pages/tsx-basic/index.js'), 'islandCount += 2'),
      'dynamic island handler HMR output',
    )
    await waitForClientVersion(sharedVersion)

    const patched = await page.callMethodWithOptions('runE2E', { routeOnly: true, timeout: 30_000 })
    expect(patched).toMatchObject({ initial: 1, next: 3 })
    expect(await readRuntimeState()).toEqual({
      count: 3,
      identity: 'jsx-hmr-instance',
      route: 'pages/tsx-basic/index',
    })
  }, 180_000)
})
