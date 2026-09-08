import path from 'node:path'
import process from 'node:process'
import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/node'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import {
  replaceFileByRename,
  waitForFileContains,
  waitForStatefulHmrControl,
} from '../utils/hmr-helpers'
import { cleanDevtoolsCache, cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { statefulHmrCheckpoints } from './statefulHmrDom'
import { nativeChildCheckpoints } from './statefulHmrDom/nativeChild'
import { verifyNativeChildHmr } from './statefulHmrDom/nativeChildCase'
import { vueChildCheckpoints } from './statefulHmrDom/vueChild'

const ROOT = path.resolve(import.meta.dirname, '../..')
const APP_ROOT = path.join(ROOT, 'e2e-apps/stateful-hmr')
const CLI_PATH = path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const CONTROL_FILE = path.join(DIST_ROOT, '__weapp_vite_hmr/control.js')
const UPDATE_FILE = path.join(DIST_ROOT, '__weapp_vite_hmr/update.js')
const NATIVE_SOURCE = path.join(APP_ROOT, 'src/pages/native/index.ts')
const NATIVE_STYLE = path.join(APP_ROOT, 'src/pages/native/index.wxss')
const COMPONENT_SOURCE = path.join(APP_ROOT, 'src/pages/component/index.ts')
const CHILD_SOURCE = path.join(APP_ROOT, 'src/components/native-counter/index.js')
const VUE_CHILD_SOURCE = path.join(APP_ROOT, 'src/components/vue-counter/index.vue')
const WEVU_SOURCE = path.join(APP_ROOT, 'src/pages/wevu/index.vue')
const NATIVE_ROUTE = '/pages/native/index?source=e2e'
const COMPONENT_ROUTE = '/pages/component/index?source=e2e'
const WEVU_ROUTE = '/pages/wevu/index?source=e2e'
const POST_CONNECT_REFRESH_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_POST_CONNECT_REFRESH'

interface RuntimeState {
  count: number
  identity: string
  input: string
  route: string
  source: string
}

let miniProgram: any
let devProcess: ReturnType<typeof startDevProcess> | undefined
let originalComponentSource = ''
let originalChildSource = ''
let originalVueChildSource = ''
let originalNativeSource = ''
let originalNativeStyle = ''
let originalWevuSource = ''
let previousPostConnectRefresh: string | undefined
let sharedInfraUnavailableMessage = ''

class StatefulHmrDevtoolsTransportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StatefulHmrDevtoolsTransportError'
  }
}

function normalizeFixtureSource(source: string, runtime: 'component' | 'native' | 'wevu'): string {
  if (runtime === 'wevu') {
    return source
      .replace('STATEFUL-WEVU-PATCHED', 'STATEFUL-WEVU-BASE')
      .replace(/<view class="sfc-template">SFC-(?:TEMPLATE-B|MIXED-TEMPLATE)<\/view>\n {4}/, '')
      .replace('\n  background-color: #dbeafe;', '')
      .replace(/count\.value \+= [23]/, 'count.value += 1')
      .replace(/store\.increment\([23]\)/, 'store.increment(1)')
      .replace('  added: \'new default\',\n', '')
  }
  const prefix = runtime === 'native' ? 'NATIVE' : 'COMPONENT'
  return source
    .replace(`STATEFUL-${prefix}-PATCHED`, `STATEFUL-${prefix}-BASE`)
    .replace('this.data.count + 2', 'this.data.count + 1')
}

async function readRuntimeState(page?: any): Promise<RuntimeState> {
  const metadata = await miniProgram.evaluate(() => {
    const pages = getCurrentPages()
    const currentPage = pages[pages.length - 1] as any
    return {
      identity: String(currentPage.__statefulHmrIdentity ?? ''),
      route: String(currentPage.route ?? currentPage.__route__ ?? ''),
      source: String(currentPage.options?.source ?? ''),
    }
  })
  const current = await miniProgram.currentPage()
  expect(current.path).toBe(page?.path ?? current.path)
  const data = await current.data(undefined, { fallback: false })
  return {
    count: Number(data?.count),
    identity: metadata.identity,
    input: String(data?.input ?? ''),
    route: metadata.route,
    source: metadata.source,
  }
}

async function prepareRuntimeState(identity: string) {
  await miniProgram.evaluate((payload: { identity: string }) => {
    const pages = getCurrentPages()
    const page = pages[pages.length - 1] as any
    page.__statefulHmrIdentity = payload.identity
  }, { identity })
  const page = await miniProgram.currentPage()
  const inputs = await page.$$('.input', { fallback: false })
  expect(inputs).toHaveLength(1)
  await inputs[0].input('held-input')
}

async function triggerIncrement() {
  const page = await miniProgram.currentPage()
  const buttons = await page.$$('.increment', { fallback: false })
  expect(buttons).toHaveLength(1)
  await buttons[0].tap()
}

async function waitForPatchedBehavior(expectedCount: number, page?: any, timeoutMs = 30_000): Promise<RuntimeState> {
  const start = Date.now()
  let latest: RuntimeState | undefined
  let latestError = ''
  while (Date.now() - start < timeoutMs) {
    latest = await readRuntimeState(page).catch((error: unknown) => {
      latestError = error instanceof Error ? error.message : String(error)
      return undefined
    })
    if (latest?.count === expectedCount) {
      return latest
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  const runtimeLogs = miniProgram.__weappViteRuntimeLogMeta?.entries ?? []
  const lastApply = await miniProgram.evaluate(() => {
    const client = (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__
    return typeof client?.getLastApply === 'function' ? client.getLastApply() : null
  }).catch(() => null)
  const devOutput = devProcess?.getOutput().slice(-8_000) ?? ''
  throw new Error(`Timed out waiting for patched runtime count ${expectedCount}; latest=${JSON.stringify(latest)}; error=${latestError}; lastApply=${JSON.stringify(lastApply)}; logs=${JSON.stringify(runtimeLogs)}; devOutput=${devOutput}`)
}

async function waitForClientVersion(expectedVersion: number, timeoutMs = 30_000): Promise<void> {
  const start = Date.now()
  let latest = -1
  while (Date.now() - start < timeoutMs) {
    latest = await miniProgram.evaluate(() => {
      const client = (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__
      return typeof client?.getVersion === 'function' ? Number(client.getVersion()) : -1
    }).catch(() => -1)
    if (latest === expectedVersion) {
      return
    }
    if (latest > expectedVersion) {
      break
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  const devOutput = devProcess?.getOutput().slice(-8_000) ?? ''
  throw new Error(`Timed out waiting for stateful HMR client version ${expectedVersion}; latest=${latest}; devOutput=${devOutput}`)
}

async function readClientVersion(): Promise<number> {
  return await miniProgram.evaluate(() => {
    const client = (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__
    return typeof client?.getVersion === 'function' ? Number(client.getVersion()) : -1
  })
}

async function waitForClientReady(timeoutMs = 30_000): Promise<void> {
  const start = Date.now()
  let latest: unknown
  while (Date.now() - start < timeoutMs) {
    latest = await miniProgram.evaluate(() => {
      const client = (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__
      return typeof client?.getTransportState === 'function' ? client.getTransportState() : null
    }).catch(() => null)
    if ((latest as { phase?: unknown } | null)?.phase === 'polling') {
      return
    }
    const requestError = (latest as { lastRequestError?: { errMsg?: unknown } } | null)?.lastRequestError
    if (typeof requestError?.errMsg === 'string' && requestError.errMsg.includes('url not in domain list')) {
      throw new StatefulHmrDevtoolsTransportError(
        'WeChat DevTools 拒绝 stateful HMR 本地 wx.request（request:fail url not in domain list），即使项目 urlCheck=false；跳过真实 IDE transport 用例。',
      )
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for stateful HMR transport; latest=${JSON.stringify(latest)}`)
}

function skipIfStatefulHmrTransportUnavailable(ctx: { skip: (message?: string) => void }): boolean {
  if (!sharedInfraUnavailableMessage) {
    return false
  }
  ctx.skip(sharedInfraUnavailableMessage)
  return true
}

describe('stateful HMR in real WeChat DevTools', { concurrent: false }, () => {
  beforeAll(async () => {
    previousPostConnectRefresh = process.env[POST_CONNECT_REFRESH_ENV]
    delete process.env[POST_CONNECT_REFRESH_ENV]
    await cleanupResidualDevProcesses()
    await cleanupResidualIdeProcesses()
    await cleanDevtoolsCache('all', { cwd: APP_ROOT })
    originalComponentSource = normalizeFixtureSource(await fs.readFile(COMPONENT_SOURCE, 'utf8'), 'component')
    originalChildSource = (await fs.readFile(CHILD_SOURCE, 'utf8')).replace('this.data.count + 2', 'this.data.count + 1').replace('step:2', 'step:1')
    originalVueChildSource = (await fs.readFile(VUE_CHILD_SOURCE, 'utf8')).replace('count.value += 2', 'count.value += 1').replace('step:2', 'step:1')
    originalNativeSource = normalizeFixtureSource(await fs.readFile(NATIVE_SOURCE, 'utf8'), 'native')
    originalNativeStyle = (await fs.readFile(NATIVE_STYLE, 'utf8')).replace('background-color: #dbeafe', 'background-color: #fff')
    originalWevuSource = normalizeFixtureSource(await fs.readFile(WEVU_SOURCE, 'utf8'), 'wevu')
    await Promise.all([
      fs.writeFile(COMPONENT_SOURCE, originalComponentSource, 'utf8'),
      fs.writeFile(CHILD_SOURCE, originalChildSource, 'utf8'),
      fs.writeFile(VUE_CHILD_SOURCE, originalVueChildSource, 'utf8'),
      fs.writeFile(NATIVE_SOURCE, originalNativeSource, 'utf8'),
      fs.writeFile(NATIVE_STYLE, originalNativeStyle, 'utf8'),
      fs.writeFile(WEVU_SOURCE, originalWevuSource, 'utf8'),
    ])
    await fs.remove(DIST_ROOT)

    devProcess = startDevProcess(process.execPath, [
      CLI_PATH,
      'dev',
      APP_ROOT,
      '--platform',
      'weapp',
      '--skipNpm',
    ], {
      all: true,
      cwd: APP_ROOT,
      env: createDevProcessEnv(),
      reject: false,
    })
    await devProcess.waitFor(waitForStatefulHmrControl(CONTROL_FILE), 'stateful HMR control ready')

    miniProgram = await launchAutomator({
      bridgeProjectMode: 'direct',
      launchMode: 'bridge',
      projectPath: APP_ROOT,
      projectConfig: {
        setting: {
          urlCheck: false,
          useIsolateContext: false,
          useMultiFrameRuntime: false,
        },
      },
      retryWarmupTimeout: true,
      trustProject: true,
      timeout: 120_000,
      warmupRootSelectors: ['.page'],
      warmupRoute: NATIVE_ROUTE,
    })
    try {
      await waitForClientReady()
    }
    catch (error) {
      if (error instanceof StatefulHmrDevtoolsTransportError) {
        sharedInfraUnavailableMessage = error.message
        return
      }
      throw error
    }
  }, 600_000)

  afterAll(async () => {
    try {
      await miniProgram?.disconnect?.()
    }
    catch {}
    miniProgram = undefined
    try {
      await devProcess?.stop(5_000)
    }
    catch {}
    devProcess = undefined
    if (originalNativeSource) {
      await fs.writeFile(NATIVE_SOURCE, originalNativeSource, 'utf8')
    }
    if (originalNativeStyle) {
      await fs.writeFile(NATIVE_STYLE, originalNativeStyle, 'utf8')
    }
    if (originalComponentSource) {
      await fs.writeFile(COMPONENT_SOURCE, originalComponentSource, 'utf8')
    }
    if (originalChildSource) {
      await fs.writeFile(CHILD_SOURCE, originalChildSource, 'utf8')
    }
    if (originalVueChildSource) {
      await fs.writeFile(VUE_CHILD_SOURCE, originalVueChildSource, 'utf8')
    }
    if (originalWevuSource) {
      await fs.writeFile(WEVU_SOURCE, originalWevuSource, 'utf8')
    }
    if (previousPostConnectRefresh === undefined) {
      delete process.env[POST_CONNECT_REFRESH_ENV]
    }
    else {
      process.env[POST_CONNECT_REFRESH_ENV] = previousPostConnectRefresh
    }
    await cleanupResidualDevProcesses()
    await cleanupResidualIdeProcesses()
  })

  it('preserves native Page identity, data, input, route, and query across style updates and JavaScript patches', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', statefulHmrCheckpoints('native'))
    if (skipIfStatefulHmrTransportUnavailable(ctx)) {
      return
    }
    const page = await miniProgram.reLaunch(NATIVE_ROUTE)
    await waitForPatchedBehavior(0, page)
    await dom.check('initial', miniProgram, page)
    await prepareRuntimeState('native-instance')
    await triggerIncrement()
    await dom.check('prepared', miniProgram, page)
    expect(await readRuntimeState(page)).toEqual({
      count: 1,
      identity: 'native-instance',
      input: 'held-input',
      route: 'pages/native/index',
      source: 'e2e',
    })

    // 样式 sidecar 先通过真实 watcher 更新，再更新同名脚本，覆盖构建文件身份隔离。
    const updatedStyle = originalNativeStyle.replace('background-color: #fff', 'background-color: #dbeafe')
    expect(updatedStyle).not.toBe(originalNativeStyle)
    await replaceFileByRename(NATIVE_STYLE, updatedStyle)
    await dom.check('style-updated', miniProgram, await miniProgram.currentPage())
    expect(await readRuntimeState(page)).toMatchObject({ count: 1, input: 'held-input', identity: 'native-instance' })

    const updatedSource = originalNativeSource
      .replace('STATEFUL-NATIVE-BASE', 'STATEFUL-NATIVE-PATCHED')
      .replace('this.data.count + 1', 'this.data.count + 2')
    const clientVersion = await readClientVersion()
    await replaceFileByRename(NATIVE_SOURCE, updatedSource)
    await devProcess!.waitFor(waitForFileContains(UPDATE_FILE, 'this.data.count + 2'), 'native literal patch published')
    await waitForClientVersion(clientVersion + 1)
    await dom.check('patched', miniProgram, await miniProgram.currentPage())
    expect(await readRuntimeState(page)).toMatchObject({ count: 1, input: 'held-input', identity: 'native-instance' })

    await triggerIncrement()
    const state = await waitForPatchedBehavior(3, page)
    await dom.check('updated', miniProgram, await miniProgram.currentPage())
    expect(state).toEqual({
      count: 3,
      identity: 'native-instance',
      input: 'held-input',
      route: 'pages/native/index',
      source: 'e2e',
    })

    const restoreVersion = await readClientVersion()
    await replaceFileByRename(NATIVE_SOURCE, originalNativeSource)
    await devProcess!.waitFor(waitForFileContains(UPDATE_FILE, 'this.data.count + 1'), 'native original script restored')
    await waitForClientVersion(restoreVersion + 1)
    await replaceFileByRename(NATIVE_STYLE, originalNativeStyle)
    await dom.check('restored', miniProgram, await miniProgram.currentPage())
    expect(await readRuntimeState(page)).toMatchObject({ count: 3, input: 'held-input', identity: 'native-instance' })
    await triggerIncrement()
    await waitForPatchedBehavior(4, page)
    await dom.check('restored-updated', miniProgram, await miniProgram.currentPage())
    expect(await readRuntimeState(page)).toMatchObject({ count: 4, input: 'held-input', identity: 'native-instance' })
  })

  it('rehydrates wevu local and store refs while preserving the native page instance', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', statefulHmrCheckpoints('wevu'))
    if (skipIfStatefulHmrTransportUnavailable(ctx)) {
      return
    }
    const page = await miniProgram.reLaunch(WEVU_ROUTE)
    await waitForPatchedBehavior(0, page)
    await dom.check('initial', miniProgram, page)
    await prepareRuntimeState('wevu-instance')
    await triggerIncrement()
    await triggerIncrement()
    await dom.check('prepared', miniProgram, page)
    expect(await waitForPatchedBehavior(2, page)).toEqual({
      count: 2,
      identity: 'wevu-instance',
      input: 'held-input',
      route: 'pages/wevu/index',
      source: 'e2e',
    })

    const templateSource = originalWevuSource.replace('<input v-model="input"', '<view class="sfc-template">SFC-TEMPLATE-B</view>\n    <input v-model="input"')
    await replaceFileByRename(WEVU_SOURCE, templateSource)
    await devProcess!.waitFor(waitForFileContains(path.join(DIST_ROOT, 'pages/wevu/index.wxml'), 'SFC-TEMPLATE-B'), 'SFC template B emitted')
    await dom.check('template-b', miniProgram, await miniProgram.currentPage())
    expect(await readRuntimeState(page)).toMatchObject({ count: 2, input: 'held-input', identity: 'wevu-instance', route: 'pages/wevu/index' })

    await replaceFileByRename(WEVU_SOURCE, originalWevuSource)
    await dom.check('template-a', miniProgram, await miniProgram.currentPage())
    expect(await readRuntimeState(page)).toMatchObject({ count: 2, input: 'held-input', identity: 'wevu-instance', route: 'pages/wevu/index' })

    const updatedSource = originalWevuSource
      .replace('<input v-model="input"', '<view class="sfc-template">SFC-MIXED-TEMPLATE</view>\n    <input v-model="input"')
      .replace('STATEFUL-WEVU-BASE', 'STATEFUL-WEVU-PATCHED')
      .replace('count.value += 1', 'count.value += 2')
      .replace('store.increment(1)', 'store.increment(2)')
      .replace('  removed: \'initial\',', '  removed: \'initial\',\n  added: \'new default\',')
    const clientVersion = await readClientVersion()
    await replaceFileByRename(WEVU_SOURCE, updatedSource)
    await devProcess!.waitFor(waitForFileContains(UPDATE_FILE, 'count.value += 2'), 'wevu literal patch published')
    await waitForClientVersion(clientVersion + 1)
    try {
      await dom.check('patched', miniProgram, await miniProgram.currentPage())
    }
    catch (error) {
      const state = await miniProgram.evaluate((key: string) => (globalThis as any)[key]?.getDebugSnapshot(true), WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)
      throw new Error(`Wevu HMR rendered state mismatch; bridge=${JSON.stringify(state)}`, { cause: error })
    }
    expect(await readRuntimeState(page)).toMatchObject({ count: 2, input: 'held-input', identity: 'wevu-instance' })

    await triggerIncrement()
    const state = await waitForPatchedBehavior(4, page)
    await dom.check('updated', miniProgram, await miniProgram.currentPage())
    expect(state).toEqual({
      count: 4,
      identity: 'wevu-instance',
      input: 'held-input',
      route: 'pages/wevu/index',
      source: 'e2e',
    })

    const styleSource = updatedSource
      .replace('count.value += 2', 'count.value += 3')
      .replace('store.increment(2)', 'store.increment(3)')
      .replace('.page {', '.page {\n  background-color: #dbeafe;')
    const styleClientVersion = await readClientVersion()
    await replaceFileByRename(WEVU_SOURCE, styleSource)
    await devProcess!.waitFor(waitForFileContains(UPDATE_FILE, 'count.value += 3'), 'mixed SFC script and style patch published')
    await waitForClientVersion(styleClientVersion + 1)
    await dom.check('mixed-style', miniProgram, await miniProgram.currentPage())
    expect(await readRuntimeState(page)).toMatchObject({ count: 4, input: 'held-input', identity: 'wevu-instance', route: 'pages/wevu/index', source: 'e2e' })
    await triggerIncrement()
    await waitForPatchedBehavior(7, page)
    await dom.check('mixed-style-updated', miniProgram, await miniProgram.currentPage())
    expect(await readRuntimeState(page)).toMatchObject({ count: 7, input: 'held-input', identity: 'wevu-instance', route: 'pages/wevu/index', source: 'e2e' })
  })

  it('preserves native Component identity, data, input, route, and query across a JavaScript patch', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', statefulHmrCheckpoints('component'))
    if (skipIfStatefulHmrTransportUnavailable(ctx)) {
      return
    }
    const page = await miniProgram.reLaunch(COMPONENT_ROUTE)
    await waitForPatchedBehavior(0, page)
    await dom.check('initial', miniProgram, page)
    await prepareRuntimeState('component-instance')
    await triggerIncrement()
    await dom.check('prepared', miniProgram, page)
    expect(await waitForPatchedBehavior(1, page)).toEqual({
      count: 1,
      identity: 'component-instance',
      input: 'held-input',
      route: 'pages/component/index',
      source: 'e2e',
    })

    const updatedSource = originalComponentSource
      .replace('STATEFUL-COMPONENT-BASE', 'STATEFUL-COMPONENT-PATCHED')
      .replace('this.data.count + 1', 'this.data.count + 2')
    const clientVersion = await readClientVersion()
    await replaceFileByRename(COMPONENT_SOURCE, updatedSource)
    await devProcess!.waitFor(waitForFileContains(UPDATE_FILE, 'this.data.count + 2'), 'component literal patch published')
    await waitForClientVersion(clientVersion + 1)

    await dom.check('patched', miniProgram, await miniProgram.currentPage())

    await triggerIncrement()
    await dom.check('updated', miniProgram, await miniProgram.currentPage())
    expect(await waitForPatchedBehavior(3, page)).toEqual({
      count: 3,
      identity: 'component-instance',
      input: 'held-input',
      route: 'pages/component/index',
      source: 'e2e',
    })
  })

  it('preserves parent and native child DOM state across a child script patch and restoration', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', nativeChildCheckpoints)
    if (skipIfStatefulHmrTransportUnavailable(ctx)) {
      return
    }
    const control = await fs.readFile(CONTROL_FILE, 'utf8')
    await verifyNativeChildHmr({
      dom,
      miniProgram,
      async patch(updated) {
        const version = await readClientVersion()
        const source = updated
          ? originalChildSource.replace('this.data.count + 1', 'this.data.count + 2').replace('step:1', 'step:2')
          : originalChildSource
        await replaceFileByRename(CHILD_SOURCE, source)
        await devProcess!.waitFor(waitForFileContains(UPDATE_FILE, updated ? 'step:2' : 'step:1'), 'native child patch published')
        await waitForClientVersion(version + 1)
        expect(await fs.readFile(CONTROL_FILE, 'utf8')).toBe(control)
      },
    })
  })

  it('preserves parent and Vue child DOM state across a child script patch and restoration', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', vueChildCheckpoints)
    if (skipIfStatefulHmrTransportUnavailable(ctx)) {
      return
    }
    const control = await fs.readFile(CONTROL_FILE, 'utf8')
    await verifyNativeChildHmr({
      dom,
      miniProgram,
      childSelector: '#vue-counter',
      async patch(updated) {
        const version = await readClientVersion()
        const source = updated
          ? originalVueChildSource.replace('count.value += 1', 'count.value += 2').replace('step:1', 'step:2')
          : originalVueChildSource
        await replaceFileByRename(VUE_CHILD_SOURCE, source)
        await devProcess!.waitFor(waitForFileContains(UPDATE_FILE, updated ? 'step:2' : 'step:1'), 'Vue child patch published')
        await waitForClientVersion(version + 1)
        expect(await fs.readFile(CONTROL_FILE, 'utf8')).toBe(control)
      },
    })
  })
})
