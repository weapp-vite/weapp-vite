import type { startDevProcess } from '../utils/dev-process'
import path from 'node:path'
import process from 'node:process'
import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/node'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolveRuntimeCompilerCli } from '../../packages/weapp-vite/scripts/consumerRuntimeHost.mjs'
import { launchAutomator } from '../utils/automator'
import { traceCleanupStage } from '../utils/cleanupTrace'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import {
  parseStatefulHmrControlSource,
  replaceFileByRename,
  waitForFileContains,
  waitForStatefulHmrControl,
} from '../utils/hmr-helpers'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { startRuntimeDevProcess } from '../utils/runtimeDevProcess'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { createStatefulHmrProject } from '../utils/statefulHmrProject'
import { relaunchPage } from './github-issues.runtime.shared'
import { statefulHmrCheckpoints } from './statefulHmrDom'
import { assetLifecycleCheckpoints, verifyAssetLifecycle } from './statefulHmrDom/assets'
import { editorFileCheckpoints } from './statefulHmrDom/editorFiles'
import { nativeChildCheckpoints } from './statefulHmrDom/nativeChild'
import { verifyNativeChildHmr } from './statefulHmrDom/nativeChildCase'
import { nativeDefaultCheckpoints } from './statefulHmrDom/nativeDefaults'
import { scriptStateCheckpoints } from './statefulHmrDom/scriptState'
import { templateCycleCheckpoints } from './statefulHmrDom/templates'
import { installStatefulHmrTransport } from './statefulHmrDom/transport'
import { vueChildCheckpoints } from './statefulHmrDom/vueChild'

const ROOT = path.resolve(import.meta.dirname, '../..')
const CONSUMER_PROJECT = process.env.WEAPP_VITE_E2E_STATEFUL_PROJECT
const DEFAULT_APP_ROOT = CONSUMER_PROJECT
  ? path.resolve(CONSUMER_PROJECT)
  : path.join(ROOT, 'e2e-apps/stateful-hmr')
const HOST = process.env.WEAPP_VITE_E2E_COMPILER_HOST ?? 'wv'
if (HOST !== 'wv' && HOST !== 'vite' && HOST !== 'vite-plus') {
  throw new Error(`Unsupported stateful fixture host: ${HOST}`)
}
const COMPILER_CLI = resolveRuntimeCompilerCli(HOST, DEFAULT_APP_ROOT, { repositoryRoot: ROOT, isolated: Boolean(CONSUMER_PROJECT) })

function fixturePaths(projectRoot: string) {
  const distRoot = path.join(projectRoot, 'dist')
  return {
    projectRoot,
    distRoot,
    controlFile: path.join(distRoot, '__weapp_vite_hmr/control.js'),
    updateFile: path.join(distRoot, '__weapp_vite_hmr/update.js'),
    nativeSource: path.join(projectRoot, 'src/pages/native/index.ts'),
    nativeStyle: path.join(projectRoot, 'src/pages/native/index.wxss'),
    componentSource: path.join(projectRoot, 'src/pages/component/index.ts'),
    childSource: path.join(projectRoot, 'src/components/native-counter/index.js'),
    vueChildSource: path.join(projectRoot, 'src/components/vue-counter/index.vue'),
    wevuSource: path.join(projectRoot, 'src/pages/wevu/index.vue'),
  }
}

let fixture = fixturePaths(DEFAULT_APP_ROOT)
let isolatedFixture: Awaited<ReturnType<typeof createStatefulHmrProject>> | undefined
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
let headlessTransport: ReturnType<typeof installStatefulHmrTransport> | undefined

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
    headlessTransport?.assertHealthy()
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
  const diagnostics = await miniProgram.evaluate(() => {
    const client = (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__
    return {
      transport: client?.getTransportState?.(),
      lastApply: client?.getLastApply?.(),
    }
  }).catch(() => null)
  const runtimeLogs = miniProgram.__weappViteRuntimeLogMeta?.entries?.slice(-40) ?? []
  throw new Error(`Timed out waiting for stateful HMR client version ${expectedVersion}; latest=${latest}; diagnostics=${JSON.stringify(diagnostics)}; logs=${JSON.stringify(runtimeLogs)}; devOutput=${devOutput}`)
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
    if ((latest as { phase?: unknown, lastResponse?: { type?: unknown } } | null)?.phase === 'polling'
      && (latest as { lastResponse?: { type?: unknown } } | null)?.lastResponse?.type !== 'rebuilding') {
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
  const publishedControl = await fs.readFile(fixture.controlFile, 'utf8').then(parseStatefulHmrControlSource).catch(() => undefined)
  throw new Error(`Timed out waiting for stateful HMR transport; expectedEndpoint=${headlessTransport?.endpoint}; publishedEndpoint=${publishedControl?.url}; latest=${JSON.stringify(latest)}; devOutput=${devProcess?.getOutput().slice(-8_000) ?? ''}`)
}

async function relaunchStatefulRoute(route: string, timeoutMs = 30_000): Promise<any> {
  const page = await relaunchPage(miniProgram, route, undefined, timeoutMs, {
    forceRelaunch: true,
    readiness: 'route',
  })
  if (!page) {
    throw new Error(`Timed out waiting stateful HMR route ${route}`)
  }
  // 上一个完整快照可能已经写盘但仍在提交 transport；下一场景必须等宿主离开 rebuilding，
  // 否则首个脚本事件会被旧批次拒绝并永久停留在旧 revision。
  await waitForClientReady(timeoutMs)
  return page
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
    if (resolveRuntimeProviderName() === 'devtools') {
      await cleanupResidualIdeProcesses()
    }
    if (!CONSUMER_PROJECT && resolveRuntimeProviderName() === 'headless') {
      isolatedFixture = await createStatefulHmrProject()
      fixture = fixturePaths(isolatedFixture.projectRoot)
    }
    originalComponentSource = normalizeFixtureSource(await fs.readFile(fixture.componentSource, 'utf8'), 'component')
    originalChildSource = (await fs.readFile(fixture.childSource, 'utf8')).replace('this.data.count + 2', 'this.data.count + 1').replace('step:2', 'step:1')
    originalVueChildSource = (await fs.readFile(fixture.vueChildSource, 'utf8')).replace('count.value += 2', 'count.value += 1').replace('step:2', 'step:1')
    originalNativeSource = normalizeFixtureSource(await fs.readFile(fixture.nativeSource, 'utf8'), 'native')
    originalNativeStyle = (await fs.readFile(fixture.nativeStyle, 'utf8')).replace('background-color: #dbeafe', 'background-color: #fff')
    originalWevuSource = normalizeFixtureSource(await fs.readFile(fixture.wevuSource, 'utf8'), 'wevu')
    await Promise.all([
      fs.writeFile(fixture.componentSource, originalComponentSource, 'utf8'),
      fs.writeFile(fixture.childSource, originalChildSource, 'utf8'),
      fs.writeFile(fixture.vueChildSource, originalVueChildSource, 'utf8'),
      fs.writeFile(fixture.nativeSource, originalNativeSource, 'utf8'),
      fs.writeFile(fixture.nativeStyle, originalNativeStyle, 'utf8'),
      fs.writeFile(fixture.wevuSource, originalWevuSource, 'utf8'),
    ])
    await fs.remove(fixture.distRoot)

    devProcess = await startRuntimeDevProcess(HOST, HOST === 'wv'
      ? [COMPILER_CLI, 'dev', fixture.projectRoot, '--platform', 'weapp', '--skipNpm']
      : [COMPILER_CLI, 'dev', '--config', 'vite.stateful.config.mts', '--host', '127.0.0.1', '--port', '0'], {
      all: true,
      cwd: fixture.projectRoot,
      env: createDevProcessEnv(),
      reject: false,
    })
    await devProcess.waitFor(waitForStatefulHmrControl(fixture.controlFile), 'stateful HMR control ready')
    expect(await fs.pathExists(path.join(fixture.distRoot, 'hmr-tabbar.png'))).toBe(true)

    miniProgram = await launchAutomator({
      async configureHeadlessSession(session) {
        const control = parseStatefulHmrControlSource(await fs.readFile(fixture.controlFile, 'utf8'))
        if (!control?.url) {
          throw new Error('Missing current CLI HMR endpoint')
        }
        headlessTransport = installStatefulHmrTransport(session, control.url, fixture.updateFile)
      },
      bridgeProjectMode: 'direct',
      launchMode: 'bridge',
      projectPath: fixture.projectRoot,
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
    const errors: unknown[] = []
    try {
      await headlessTransport?.close()
    }
    catch (error) {
      errors.push(error)
    }
    finally {
      headlessTransport = undefined
    }
    try {
      // 受管 IDE 会话必须 close 以确认窗口销毁；disconnect 只释放 WebSocket，不能终结窗口所有权。
      await miniProgram?.close?.()
    }
    catch (error) {
      errors.push(error)
    }
    finally {
      miniProgram = undefined
    }
    try {
      await traceCleanupStage('stateful-dev-stop', async () => await devProcess?.stop(5_000), { defaultOnWindows: true })
    }
    catch (error) {
      errors.push(error)
    }
    finally {
      // 即使 watcher 停止失败，也继续恢复源码和精确登记的其它资源。
      devProcess = undefined
    }
    try {
      await traceCleanupStage('stateful-restore-source', async () => {
        if (originalNativeSource) {
          await fs.writeFile(fixture.nativeSource, originalNativeSource, 'utf8')
        }
        if (originalNativeStyle) {
          await fs.writeFile(fixture.nativeStyle, originalNativeStyle, 'utf8')
        }
        if (originalComponentSource) {
          await fs.writeFile(fixture.componentSource, originalComponentSource, 'utf8')
        }
        if (originalChildSource) {
          await fs.writeFile(fixture.childSource, originalChildSource, 'utf8')
        }
        if (originalVueChildSource) {
          await fs.writeFile(fixture.vueChildSource, originalVueChildSource, 'utf8')
        }
        if (originalWevuSource) {
          await fs.writeFile(fixture.wevuSource, originalWevuSource, 'utf8')
        }
      }, { defaultOnWindows: true })
      await traceCleanupStage('stateful-residual-dev', cleanupResidualDevProcesses, { defaultOnWindows: true })
      if (resolveRuntimeProviderName() === 'devtools') {
        await traceCleanupStage('stateful-residual-ide', cleanupResidualIdeProcesses, { defaultOnWindows: true })
      }
    }
    catch (error) {
      errors.push(error)
    }
    try {
      await traceCleanupStage('stateful-fixture-remove', async () => await isolatedFixture?.cleanup(), { defaultOnWindows: true })
    }
    catch (error) {
      errors.push(error)
    }
    finally {
      isolatedFixture = undefined
    }
    if (previousPostConnectRefresh === undefined) {
      delete process.env[POST_CONNECT_REFRESH_ENV]
    }
    else {
      process.env[POST_CONNECT_REFRESH_ENV] = previousPostConnectRefresh
    }
    if (errors.length) {
      throw new AggregateError(errors, 'Stateful HMR teardown failed')
    }
  }, 240_000)

  it('preserves native Page identity, data, input, route, and query across JavaScript patches and restoration', async (ctx) => {
    const provider = resolveRuntimeProviderName()
    const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', statefulHmrCheckpoints('native', provider))
    if (skipIfStatefulHmrTransportUnavailable(ctx)) {
      return
    }
    const page = await relaunchStatefulRoute(NATIVE_ROUTE)
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

    const updatedSource = originalNativeSource
      .replace('STATEFUL-NATIVE-BASE', 'STATEFUL-NATIVE-PATCHED')
      .replace('this.data.count + 1', 'this.data.count + 2')
    const clientVersion = await readClientVersion()
    await replaceFileByRename(fixture.nativeSource, updatedSource)
    await devProcess!.waitFor(waitForFileContains(fixture.updateFile, 'this.data.count + 2'), 'native literal patch published')
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
    await replaceFileByRename(fixture.nativeSource, originalNativeSource)
    await devProcess!.waitFor(waitForFileContains(fixture.updateFile, 'this.data.count + 1'), 'native original script restored')
    await waitForClientVersion(restoreVersion + 1)
    await dom.check('restored', miniProgram, await miniProgram.currentPage())
    expect(await readRuntimeState(page)).toMatchObject({ count: 3, input: 'held-input', identity: 'native-instance' })
    await triggerIncrement()
    await waitForPatchedBehavior(4, page)
    await dom.check('restored-updated', miniProgram, await miniProgram.currentPage())
    expect(await readRuntimeState(page)).toMatchObject({ count: 4, input: 'held-input', identity: 'native-instance' })
  })

  it('preserves native page state during copied and public asset lifecycle updates', async (ctx) => {
    if (skipIfStatefulHmrTransportUnavailable(ctx)) {
      return
    }
    const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', assetLifecycleCheckpoints())
    const page = await relaunchStatefulRoute(NATIVE_ROUTE)
    await prepareRuntimeState('asset-lifecycle')
    await triggerIncrement()
    await triggerIncrement()
    await waitForPatchedBehavior(2, page)
    await verifyAssetLifecycle({
      readAsset: file => miniProgram.evaluate((filePath: string) => {
        try {
          return wx.getFileSystemManager().readFileSync(filePath, 'utf8')
        }
        catch {
          return undefined
        }
      }, file),
      appRoot: fixture.projectRoot,
      check: async (id) => {
        const current = await miniProgram.currentPage()
        expect(current.pageId).toBe(page.pageId)
        await dom.check(id, miniProgram, current)
        expect(await readRuntimeState(page)).toEqual({
          count: id === 'incremented' ? 3 : 2,
          identity: 'asset-lifecycle',
          input: 'held-input',
          route: 'pages/native/index',
          source: 'e2e',
        })
      },
      increment: async () => {
        await triggerIncrement()
        await waitForPatchedBehavior(3, page)
      },
    })
  })

  it('ignores unowned editor files while publishing consecutive native script edits and restorations', async (ctx) => {
    if (skipIfStatefulHmrTransportUnavailable(ctx)) {
      return
    }
    const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', editorFileCheckpoints())
    const page = await relaunchStatefulRoute(NATIVE_ROUTE)
    await waitForPatchedBehavior(0, page)
    await dom.check('initial', miniProgram, page)
    await prepareRuntimeState('editor-file-ownership')
    const scratch = path.join(path.dirname(fixture.nativeSource), 'editor-buffer.note')
    const hiddenScratch = path.join(path.dirname(fixture.nativeSource), '.editor-buffer')
    const initialVersion = await readClientVersion()
    let expectedCount = 0
    try {
      // 无关文件既覆盖普通文件名，也覆盖隐藏文件；不允许实现依赖临时文件名黑名单。
      await fs.writeFile(scratch, 'unowned')
      await fs.writeFile(hiddenScratch, 'unowned')
      await new Promise(resolve => setTimeout(resolve, 500))
      expect(await readClientVersion()).toBe(initialVersion)
      expect(await readRuntimeState(page)).toMatchObject({ identity: 'editor-file-ownership', count: 0, input: 'held-input' })
      await dom.check('ignored', miniProgram, page)
      const updatedSource = originalNativeSource
        .replace('STATEFUL-NATIVE-BASE', 'STATEFUL-NATIVE-PATCHED')
        .replace('this.data.count + 1', 'this.data.count + 2')
      for (let cycle = 0; cycle < 2; cycle += 1) {
        for (const step of [2, 1]) {
          const version = await readClientVersion()
          await fs.writeFile(scratch, `cycle ${cycle}, step ${step}`)
          await replaceFileByRename(fixture.nativeSource, step === 2 ? updatedSource : originalNativeSource)
          await fs.remove(hiddenScratch)
          await devProcess!.waitFor(waitForFileContains(fixture.updateFile, `this.data.count + ${step}`), 'native editor-save patch published')
          await waitForClientVersion(version + 1)
          await triggerIncrement()
          expectedCount += step
          await waitForPatchedBehavior(expectedCount, page)
          await dom.check(`cycle-${cycle}-step-${step}`, miniProgram, await miniProgram.currentPage())
          expect(await readRuntimeState(page)).toEqual({
            count: expectedCount,
            identity: 'editor-file-ownership',
            input: 'held-input',
            route: 'pages/native/index',
            source: 'e2e',
          })
          await fs.writeFile(hiddenScratch, `cycle ${cycle}, step ${step}`)
        }
      }
    }
    finally {
      await fs.remove(scratch)
      await fs.remove(hiddenScratch)
      await replaceFileByRename(fixture.nativeSource, originalNativeSource)
    }
  })

  it('preserves native Component identity, data, input, route, and query across a JavaScript patch', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', statefulHmrCheckpoints('component', resolveRuntimeProviderName()))
    if (skipIfStatefulHmrTransportUnavailable(ctx)) {
      return
    }
    const page = await relaunchStatefulRoute(COMPONENT_ROUTE)
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
    await replaceFileByRename(fixture.componentSource, updatedSource)
    await devProcess!.waitFor(waitForFileContains(fixture.updateFile, 'this.data.count + 2'), 'component literal patch published')
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
    // 后续场景会重新进入同一组件页，必须先恢复注册定义并消费恢复补丁。
    const restoreVersion = await readClientVersion()
    await replaceFileByRename(fixture.componentSource, originalComponentSource)
    await waitForClientVersion(restoreVersion + 1)
  })

  it('preserves parent and native child DOM state across a child script patch and restoration', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', nativeChildCheckpoints)
    if (skipIfStatefulHmrTransportUnavailable(ctx)) {
      return
    }
    const control = await fs.readFile(fixture.controlFile, 'utf8')
    await verifyNativeChildHmr({
      dom,
      miniProgram,
      async patch(updated) {
        const version = await readClientVersion()
        const source = updated
          ? originalChildSource.replace('this.data.count + 1', 'this.data.count + 2').replace('step:1', 'step:2')
          : originalChildSource
        await replaceFileByRename(fixture.childSource, source)
        await devProcess!.waitFor(waitForFileContains(fixture.updateFile, updated ? 'step:2' : 'step:1'), 'native child patch published')
        await waitForClientVersion(version + 1)
        expect(await fs.readFile(fixture.controlFile, 'utf8')).toBe(control)
      },
    })
  })

  it('preserves parent and Vue child DOM state across a child script patch and restoration', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', vueChildCheckpoints)
    if (skipIfStatefulHmrTransportUnavailable(ctx)) {
      return
    }
    const control = await fs.readFile(fixture.controlFile, 'utf8')
    await verifyNativeChildHmr({
      dom,
      miniProgram,
      childSelector: '#vue-counter',
      async patch(updated) {
        const version = await readClientVersion()
        const source = updated
          ? originalVueChildSource.replace('count.value += 1', 'count.value += 2').replace('step:1', 'step:2')
          : originalVueChildSource
        await replaceFileByRename(fixture.vueChildSource, source)
        await devProcess!.waitFor(waitForFileContains(fixture.updateFile, updated ? 'step:2' : 'step:1'), 'Vue child patch published')
        await waitForClientVersion(version + 1)
        expect(await fs.readFile(fixture.controlFile, 'utf8')).toBe(control)
      },
    })
  })

  for (const runtime of ['native', 'component'] as const) {
    it(`preserves ${runtime} page state across two template edit and restore cycles`, async (ctx) => {
      const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', templateCycleCheckpoints(runtime))
      const source = path.join(fixture.projectRoot, `src/pages/${runtime}/index.wxml`)
      const output = path.join(fixture.distRoot, `pages/${runtime}/index.wxml`)
      const original = await fs.readFile(source, 'utf8')
      const route = `/pages/${runtime}/index?source=e2e`
      const page = await relaunchStatefulRoute(route)
      try {
        await dom.check('initial', miniProgram, page)
        await prepareRuntimeState(`template-${runtime}`)
        await triggerIncrement()
        await triggerIncrement()
        const expected = await waitForPatchedBehavior(2, page)
        await dom.check('prepared', miniProgram, page)
        expect(original).toContain('<input')
        for (const cycle of [0, 1]) {
          const marker = `TEMPLATE-CYCLE-${cycle}`
          const updated = original.replace('<input', `<view class="template-cycle">${marker}</view>\n    <input`)
          await replaceFileByRename(source, updated)
          await devProcess!.waitFor(waitForFileContains(output, marker), 'template edit emitted')
          for (const extension of ['js', 'json', 'wxml']) {
            expect(await fs.pathExists(path.join(fixture.distRoot, `components/native-counter/index.${extension}`)), `native component ${extension} after template edit`).toBe(true)
          }
          await dom.check(`edit-${cycle}`, miniProgram, await miniProgram.currentPage())
          expect(await readRuntimeState(page)).toEqual(expected)
          await replaceFileByRename(source, original)
          await devProcess!.waitFor(expect.poll(async () => (await fs.readFile(output, 'utf8')).includes(marker), { timeout: 90_000 }).toBe(false), 'template restore emitted')
          await dom.check(`restore-${cycle}`, miniProgram, await miniProgram.currentPage())
          expect(await readRuntimeState(page)).toEqual(expected)
        }
      }
      finally {
        // 成功路径已恢复并验收；再次原子替换会把无变化的 WXML 带入下一场景的补丁批次。
        if (await fs.readFile(source, 'utf8') !== original) {
          await replaceFileByRename(source, original)
          await devProcess!.waitFor(expect.poll(async () => await fs.readFile(output, 'utf8'), { timeout: 90_000 }).not.toContain('TEMPLATE-CYCLE-'), 'failed template case source restored')
        }
      }
    })
  }

  // 放在首次模板用例之后；单选执行也不依赖任何模板预热。
  it('preserves Wevu local and store state across isolated script updates and restoration', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', scriptStateCheckpoints())
    const page = await relaunchStatefulRoute(WEVU_ROUTE)
    const storeCount = async () => Number(await (await (await miniProgram.currentPage()).$('.store-count', { fallback: false })).text())
    const initialStoreCount = await storeCount()
    const check = async (id: string, count: number) => {
      await dom.check(id, miniProgram, await miniProgram.currentPage())
      await expect.poll(storeCount).toBe(initialStoreCount + count)
      expect(await readRuntimeState(page)).toMatchObject({
        count,
        input: 'held-input',
        identity: 'isolated-script',
        route: 'pages/wevu/index',
        source: 'e2e',
      })
    }
    try {
      await dom.check('initial', miniProgram, page)
      await prepareRuntimeState('isolated-script')
      await triggerIncrement()
      await triggerIncrement()
      await waitForPatchedBehavior(2, page)
      await check('prepared', 2)
      const version = await readClientVersion()
      const patched = originalWevuSource
        .replace('STATEFUL-WEVU-BASE', 'STATEFUL-WEVU-PATCHED')
        .replace('count.value += 1', 'count.value += 2')
        .replace('store.increment(1)', 'store.increment(2)')
      await replaceFileByRename(fixture.wevuSource, patched)
      await waitForClientVersion(version + 1)
      await check('patched', 2)
      await triggerIncrement()
      await waitForPatchedBehavior(4, page)
      await check('clicked', 4)
      const restoreVersion = await readClientVersion()
      await replaceFileByRename(fixture.wevuSource, originalWevuSource)
      await waitForClientVersion(restoreVersion + 1)
      await check('restored', 4)
      await triggerIncrement()
      await waitForPatchedBehavior(5, page)
      await check('restored-clicked', 5)

      const storedBeforeNavigation = await storeCount()
      const navigationVersion = await readClientVersion()
      // 同一轮事件循环发起导航；宿主应异步提交，不能重入 HMR 的状态恢复窗口。
      await miniProgram.evaluate((payload: { key: string, route: string }) => {
        const bridge = (globalThis as any)[payload.key]
        bridge.__navigationEndUpdate = bridge.endUpdate
        bridge.endUpdate = () => {
          const endUpdate = bridge.__navigationEndUpdate
          bridge.endUpdate = endUpdate
          delete bridge.__navigationEndUpdate
          endUpdate.call(bridge)
          let returned = false
          wx.reLaunch({
            url: payload.route,
            success: () => { bridge.__navigationAfterReturn = returned },
          })
          returned = true
        }
      }, { key: WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY, route: WEVU_ROUTE })
      await replaceFileByRename(fixture.wevuSource, patched)
      await waitForClientVersion(navigationVersion + 1)
      await dom.check('navigated', miniProgram, await miniProgram.currentPage())
      await expect.poll(() => miniProgram.evaluate((key: string) => {
        return (globalThis as any)[key].__navigationAfterReturn
      }, WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)).toBe(true)
      expect(await readRuntimeState()).toEqual({
        count: 0,
        input: '',
        identity: '',
        route: 'pages/wevu/index',
        source: 'e2e',
      })
      await expect.poll(storeCount).toBe(storedBeforeNavigation)
      await triggerIncrement()
      await waitForPatchedBehavior(2)
      await dom.check('navigated-clicked', miniProgram, await miniProgram.currentPage())
      await expect.poll(storeCount).toBe(storedBeforeNavigation + 2)
      const navigationRestoreVersion = await readClientVersion()
      await replaceFileByRename(fixture.wevuSource, originalWevuSource)
      await waitForClientVersion(navigationRestoreVersion + 1)
      await dom.check('navigated-restored', miniProgram, await miniProgram.currentPage())
    }
    finally {
      try {
        await miniProgram.evaluate((key: string) => {
          const bridge = (globalThis as any)[key]
          if (bridge.__navigationEndUpdate) {
            bridge.endUpdate = bridge.__navigationEndUpdate
            delete bridge.__navigationEndUpdate
          }
          delete bridge.__navigationAfterReturn
        }, WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)
      }
      finally {
        if (await fs.readFile(fixture.wevuSource, 'utf8') !== originalWevuSource) {
          await replaceFileByRename(fixture.wevuSource, originalWevuSource)
        }
      }
    }
  })

  it('initializes updated native defaults after cross-page template HMR', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', nativeDefaultCheckpoints())
    const patch = async (updated: boolean) => {
      const version = await readClientVersion()
      await replaceFileByRename(fixture.nativeSource, updated ? originalNativeSource.replace('count: 0', 'count: 7') : originalNativeSource)
      await waitForClientVersion(version + 1)
    }
    try {
      for (const runtime of ['native', 'component'] as const) {
        const source = path.join(fixture.projectRoot, `src/pages/${runtime}/index.wxml`)
        const original = await fs.readFile(source, 'utf8')
        await relaunchStatefulRoute(`/pages/${runtime}/index?source=e2e`)
        try {
          await replaceFileByRename(source, original.replace('<input', '<view class="default-template">changed</view><input'))
          await dom.check(`${runtime}-edited`, miniProgram, await miniProgram.currentPage())
          await replaceFileByRename(source, original)
          await dom.check(`${runtime}-restored`, miniProgram, await miniProgram.currentPage())
        }
        finally {
          if (await fs.readFile(source, 'utf8') !== original) {
            await replaceFileByRename(source, original)
          }
        }
      }
      await patch(true)
      await relaunchStatefulRoute(NATIVE_ROUTE)
      await dom.check('new-defaults', miniProgram, await miniProgram.currentPage())
      await triggerIncrement()
      await dom.check('incremented', miniProgram, await miniProgram.currentPage())
      await patch(false)
      await dom.check('active-restored', miniProgram, await miniProgram.currentPage())
      await relaunchStatefulRoute(NATIVE_ROUTE)
      await dom.check('restored-defaults', miniProgram, await miniProgram.currentPage())
    }
    finally {
      if (await fs.readFile(fixture.nativeSource, 'utf8') !== originalNativeSource) {
        await patch(false)
      }
    }
  })

  for (const hook of ['load', 'show', 'ready']) {
    it(`commits navigation requested in ${hook} after current page readiness`, async (ctx) => {
      const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', [{
        id: 'redirected',
        route: '/pages/component/index',
        action: `从 ${hook} 发起导航后检查目标页与生命周期顺序`,
        nodes: [
          { selector: '.count', text: '0' },
          { selector: '.input', attributes: { value: '' } },
        ],
      }])
      await miniProgram.evaluate((mode: string) => {
        wx.reLaunch({ url: `/pages/native/index?source=e2e&redirectAt=${mode}` })
      }, hook)
      const events = ['load', 'show', 'ready', 'routeDone', 'unload']
      events.splice(events.indexOf(hook) + 1, 0, 'returned')
      events.push('success', 'complete')
      await expect.poll(() => miniProgram.evaluate(() => {
        return getApp().globalData.navigationTrace?.events
      }), { timeout: 30_000, interval: 100 }).toEqual(events)
      await dom.check('redirected', miniProgram, await miniProgram.currentPage())
    })
  }
})
