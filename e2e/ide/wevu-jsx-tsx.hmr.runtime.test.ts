import type { Page } from '@weapp-vite/miniprogram-automator'
import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { waitForFileContains, waitForStatefulHmrControl } from '../utils/hmr-helpers'
import { createHmrRuntimeDiagnostics } from '../utils/hmrRuntimeDiagnostics'
import { cleanDevtoolsCache, cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import {
  WEVU_JSX_APP_ROOT,
  WEVU_JSX_CLI_PATH,
  WEVU_JSX_DIST_ROOT,
} from '../utils/wevu-jsx-tsx'

const ROUTE = '/pages/tsx-basic/index'
const PAGE_SOURCE = path.join(WEVU_JSX_APP_ROOT, 'src/pages/tsx-basic/index.tsx')
const SHARED_SOURCE = path.join(WEVU_JSX_APP_ROOT, 'src/shared.tsx')
const APP_SOURCE = path.join(WEVU_JSX_APP_ROOT, 'src/app.ts')
const PAGE_OUTPUT = path.join(WEVU_JSX_DIST_ROOT, 'pages/tsx-basic/index.wxml')
const CONTROL_OUTPUT = path.join(WEVU_JSX_DIST_ROOT, '__weapp_vite_hmr/control.js')

let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
let devProcess: ReturnType<typeof startDevProcess> | undefined
let originalPageSource = ''
let originalSharedSource = ''
let originalAppSource = ''
let diagnostics: ReturnType<typeof createHmrRuntimeDiagnostics> | undefined

async function readClientVersion() {
  return await miniProgram!.evaluate(() => {
    const client = (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__
    return typeof client?.getVersion === 'function' ? Number(client.getVersion()) : -1
  })
}

async function readRuntimeState(page: Page) {
  const identity = await miniProgram!.evaluate(() => {
    const pages = getCurrentPages()
    const page = pages[pages.length - 1] as any
    return {
      identity: String(page?.__jsxHmrIdentity ?? ''),
      route: String(page?.route ?? page?.__route__ ?? ''),
    }
  }) as { identity: string, route: string }
  return { ...identity, count: Number(await page.data('islandCount', { fallback: false })) }
}

describe('wevu JSX/TSX stateful HMR in real WeChat DevTools', { concurrent: false }, () => {
  beforeAll(async () => {
    await cleanupResidualDevProcesses()
    await cleanupResidualIdeProcesses()
    await cleanDevtoolsCache('all', { cwd: WEVU_JSX_APP_ROOT })
    originalPageSource = await fs.readFile(PAGE_SOURCE, 'utf8')
    originalSharedSource = await fs.readFile(SHARED_SOURCE, 'utf8')
    originalAppSource = await fs.readFile(APP_SOURCE, 'utf8')
    expect(originalAppSource.startsWith('App({')).toBe(true)
    await fs.writeFile(APP_SOURCE, originalAppSource.replace('App({', `App({
  onLaunch() {
    this.__e2eHmrLaunch = Date.now()
    console.info('[hmr-diagnostics:app-launch]', this.__e2eHmrLaunch)
  },`), 'utf8')
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
    await diagnostics?.capture('finally')
    try {
      await miniProgram?.disconnect?.()
    }
    catch {}
    miniProgram = undefined
    await devProcess?.stop(5_000)
    devProcess = undefined
    await fs.writeFile(PAGE_SOURCE, originalPageSource, 'utf8')
    await fs.writeFile(SHARED_SOURCE, originalSharedSource, 'utf8')
    if (originalAppSource) {
      await fs.writeFile(APP_SOURCE, originalAppSource, 'utf8')
    }
    await cleanupResidualDevProcesses()
    await cleanupResidualIdeProcesses()
  }, 60_000)

  it('preserves instance state while replacing shared TSX and island handlers', async (context) => {
    const sharedMarker = 'HMR-SHARED-FRAGMENT-UPDATED'
    const dom = createDomAcceptance(context, 'apps/wevu-jsx-tsx-demo', [
      { id: 'tsx:initial', route: ROUTE, action: '检查初始模板和动态岛计数', nodes: [
        { selector: '.title', text: '纯 TSX（.tsx）' },
        { selector: '#tsx-island-button', text: 'dynamic island: 0' },
      ] },
      { id: 'tsx:interacted', route: ROUTE, action: '动态岛交互后记录计数', nodes: [{ selector: '#tsx-island-button', text: 'dynamic island: 1' }] },
      { id: 'tsx:shared-updated', route: ROUTE, action: '共享片段更新且交互计数保留', nodes: [
        { selector: '//text[text()="HMR-SHARED-FRAGMENT-UPDATED"]', query: 'xpath', text: sharedMarker },
        { selector: '#tsx-island-button', text: 'dynamic island: 1' },
      ] },
      { id: 'tsx:page-updated', route: ROUTE, action: '页面模板更新且共享片段和计数保留', nodes: [
        { selector: '.title', text: 'HMR-TSX-PAGE-UPDATED' },
        { selector: '//text[text()="HMR-SHARED-FRAGMENT-UPDATED"]', query: 'xpath', text: sharedMarker },
        { selector: '#tsx-island-button', text: 'dynamic island: 1' },
      ] },
      { id: 'tsx:handler-updated', route: ROUTE, action: '更新后的动态岛事件按新步长累加并保留页面状态', nodes: [
        { selector: '#tsx-island-button', text: 'dynamic island: 3' },
        { selector: '.title', text: 'HMR-TSX-PAGE-UPDATED' },
      ] },
    ])
    const page = await miniProgram!.reLaunch(ROUTE)
    if (!page) {
      throw new Error(`Failed to launch ${ROUTE}`)
    }
    await page.waitForRendered({ selector: '#tsx-island-button', timeout: 30_000 })
    await dom.check('tsx:initial', miniProgram!, page)
    await miniProgram!.evaluate(() => {
      const pages = getCurrentPages()
      const current = pages[pages.length - 1] as any
      current.__jsxHmrIdentity = 'jsx-hmr-instance'
    })

    const initial = await page.callMethodWithOptions('runE2E', { routeOnly: true, timeout: 30_000 })
    expect(initial).toMatchObject({ initial: 0, next: 1 })
    await dom.check('tsx:interacted', miniProgram!, page)
    diagnostics = createHmrRuntimeDiagnostics(miniProgram!, 'apps/wevu-jsx-tsx-demo')
    const expectedIdentity = {
      errors: [],
      pageId: page.pageId,
      runtime: { appMarkerRetained: true, pageMarkerRetained: true },
    }
    expect(await diagnostics.initialize()).toMatchObject(expectedIdentity)

    const initialVersion = await readClientVersion()
    const updatedShared = originalSharedSource.replace('跨文件静态 JSX fragment', sharedMarker)
    expect(updatedShared).not.toBe(originalSharedSource)
    await fs.writeFile(SHARED_SOURCE, updatedShared, 'utf8')
    await devProcess!.waitFor(waitForFileContains(PAGE_OUTPUT, sharedMarker), 'shared TSX HMR output')
    await expect.poll(readClientVersion, { timeout: 30_000 }).toBeGreaterThan(initialVersion)
    await diagnostics.capture('tsx:shared-output')
    await dom.check('tsx:shared-updated', miniProgram!, page)
    expect(await diagnostics.capture('tsx:shared-rendered')).toMatchObject(expectedIdentity)
    expect(await readRuntimeState(page)).toEqual({
      count: 1,
      identity: 'jsx-hmr-instance',
      route: 'pages/tsx-basic/index',
    })

    expect(originalPageSource).toContain('this.islandCount += 1')
    const sharedVersion = await readClientVersion()
    const updatedPage = originalPageSource.replace('纯 TSX（.tsx）', 'HMR-TSX-PAGE-UPDATED').replace('this.islandCount += 1', 'this.islandCount += 2')
    expect(updatedPage).not.toBe(originalPageSource)
    await diagnostics.capture('tsx:page-before')
    await fs.writeFile(PAGE_SOURCE, updatedPage, 'utf8')
    await devProcess!.waitFor(
      waitForFileContains(PAGE_OUTPUT, 'HMR-TSX-PAGE-UPDATED'),
      'TSX page HMR output',
    )
    await expect.poll(readClientVersion, { timeout: 30_000 }).toBeGreaterThan(sharedVersion)
    await dom.check('tsx:page-updated', miniProgram!, page)
    expect(await diagnostics.capture('tsx:page-rendered')).toMatchObject(expectedIdentity)
    expect(await readRuntimeState(page)).toEqual({
      count: 1,
      identity: 'jsx-hmr-instance',
      route: 'pages/tsx-basic/index',
    })
    const updatedButton = await page.$('#tsx-island-button')
    expect(updatedButton).toBeTruthy()
    await updatedButton!.tap()
    await dom.check('tsx:handler-updated', miniProgram!, page)
    expect(await diagnostics.capture('tsx:handler-rendered')).toMatchObject(expectedIdentity)
    expect(await readRuntimeState(page)).toEqual({
      count: 3,
      identity: 'jsx-hmr-instance',
      route: 'pages/tsx-basic/index',
    })
  }, 180_000)
})
