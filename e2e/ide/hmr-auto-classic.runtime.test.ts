import path from 'node:path'
import { fs } from '@weapp-core/shared/node'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolveRuntimeCompilerCli, selectClassicRuntimeHost } from '../../packages/weapp-vite/scripts/consumerRuntimeHost.mjs'
import { launchAutomator, reconnectAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'

const ROOT = path.resolve(import.meta.dirname, '../..')
const externalProject = process.env.WEAPP_VITE_E2E_CLASSIC_PROJECT
const APP_ROOT = externalProject ? path.resolve(externalProject) : path.join(ROOT, 'e2e-apps/stateful-hmr')
const CONTROL_FILE = path.join(APP_ROOT, 'dist/__weapp_vite_hmr/control.js')
const DIST_NATIVE_JS = path.join(APP_ROOT, 'dist/pages/native/index.js')
const NATIVE_SOURCE = path.join(APP_ROOT, 'src/pages/native/index.ts')
const PRIVATE_CONFIG = path.join(APP_ROOT, 'project.private.config.json')
const NATIVE_ROUTE = '/pages/native/index?source=classic-auto-e2e'

interface ClassicRuntimeState {
  count: number
  identity: string
  input: string
  marker: string
  source: string
}

interface ClassicRuntimeObservation extends ClassicRuntimeState {
  observedAt: string
  pageId: string | number | null
  route: string
  options: Record<string, unknown>
}

let miniProgram: any
let devProcess: ReturnType<typeof startDevProcess> | undefined
let originalNativeSource = ''
let originalPrivateConfig = ''
let observeRuntime: ((observation: ClassicRuntimeObservation) => void) | undefined

function normalizeNativeSource(source: string) {
  return source
    .replace('STATEFUL-NATIVE-PATCHED', 'STATEFUL-NATIVE-BASE')
    .replace('this.data.count + 2', 'this.data.count + 1')
}

async function readRuntimeObservation(): Promise<ClassicRuntimeObservation> {
  const observation = await miniProgram.evaluate(() => {
    const pages = getCurrentPages()
    const page = pages[pages.length - 1] as any
    return {
      observedAt: new Date().toISOString(),
      pageId: page.__wxWebviewId__ ?? page.__webviewId__ ?? page.data?.__webviewId__ ?? null,
      route: String(page.route ?? ''),
      options: page.options ?? {},
      count: Number(page.data?.count),
      identity: String(page.__statefulHmrIdentity ?? ''),
      input: String(page.data?.input ?? ''),
      marker: String(page.data?.marker ?? ''),
      source: String(page.options?.source ?? ''),
    }
  })
  observeRuntime?.(observation)
  return observation
}

async function readRuntimeState(): Promise<ClassicRuntimeState> {
  const { count, identity, input, marker, source } = await readRuntimeObservation()
  return { count, identity, input, marker, source }
}

function logClassicReload(host: string, stage: string, at: string, observation: ClassicRuntimeObservation | { error: string }) {
  process.stdout.write(`[classic-hmr-diagnostic] ${JSON.stringify({ host, stage, at, observation })}\n`)
}

async function captureClassicReload(host: string, stage: string) {
  const at = new Date().toISOString()
  const observation = await readRuntimeObservation().catch((error: unknown) => ({
    error: error instanceof Error ? error.message : String(error),
  }))
  logClassicReload(host, stage, at, observation)
  return observation
}

async function waitForRuntimeState(
  predicate: (state: ClassicRuntimeState) => boolean,
  timeoutMs = 30_000,
): Promise<ClassicRuntimeState> {
  const startedAt = Date.now()
  let latest: ClassicRuntimeState | undefined
  while (Date.now() - startedAt < timeoutMs) {
    latest = await readRuntimeState().catch(() => undefined)
    if (latest && predicate(latest)) {
      return latest
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for classic runtime state: ${JSON.stringify(latest)}`)
}

async function connectAutomatorSession() {
  return await launchAutomator({
    bridgeProjectMode: 'direct',
    launchMode: 'bridge',
    projectPath: APP_ROOT,
    retryWarmupTimeout: true,
    timeout: 120_000,
    warmupRootSelectors: ['.page'],
    warmupRoute: NATIVE_ROUTE,
  })
}

async function disconnectAutomatorSession() {
  const session = miniProgram
  miniProgram = undefined
  if (resolveRuntimeProviderName() === 'headless') {
    // headless 没有可分离的 IDE 连接；关闭旧 runtime，再从真实 CLI 的新产物启动。
    await session?.close()
  }
  else {
    await session?.disconnect()
  }
}

const hosts = ['wv', 'vite', 'vite-watch']
if (externalProject || process.env.WEAPP_VITE_E2E_COMPILER_HOST) {
  hosts.splice(0, hosts.length, selectClassicRuntimeHost(process.env.WEAPP_VITE_E2E_COMPILER_HOST ?? 'wv', process.env.WEAPP_VITE_E2E_CLASSIC_MODE))
}

for (const host of hosts) {
  describe(`${host} automatic classic HMR in real WeChat DevTools`, { concurrent: false }, () => {
    beforeAll(async () => {
      await cleanupResidualDevProcesses()
      await cleanupResidualIdeProcesses()

      originalNativeSource = await fs.readFile(NATIVE_SOURCE, 'utf8')
      originalPrivateConfig = await fs.readFile(PRIVATE_CONFIG, 'utf8')
      const privateConfig = JSON.parse(originalPrivateConfig) as {
        setting?: Record<string, unknown>
      }
      privateConfig.setting = {
        ...(privateConfig.setting ?? {}),
        compileHotReLoad: false,
      }
      await fs.writeFile(PRIVATE_CONFIG, `${JSON.stringify(privateConfig, null, 2)}\n`, 'utf8')
      await fs.writeFile(NATIVE_SOURCE, normalizeNativeSource(originalNativeSource), 'utf8')
      await fs.remove(path.join(APP_ROOT, 'dist'))

      const compilerHost = host === 'wv' ? 'wv' : host.startsWith('vite-plus') ? 'vite-plus' : 'vite'
      const cli = resolveRuntimeCompilerCli(compilerHost, APP_ROOT, { repositoryRoot: ROOT, isolated: Boolean(externalProject) })
      const args = host === 'wv'
        ? [cli, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm']
        : host.endsWith('-watch')
          ? [cli, 'build', '--watch', '--config', 'vite.plugin.config.mts']
          : [cli, 'dev', '--config', 'vite.plugin.config.mts', '--host', '127.0.0.1', '--port', '0']
      devProcess = startDevProcess(process.execPath, args, {
        all: true,
        cwd: APP_ROOT,
        env: createDevProcessEnv(),
        reject: false,
      })
      await devProcess.waitFor(
        waitForFileContains(DIST_NATIVE_JS, 'STATEFUL-NATIVE-BASE'),
        'classic HMR initial page output',
      )
      expect(await fs.pathExists(CONTROL_FILE)).toBe(false)

      miniProgram = await connectAutomatorSession()
    }, 600_000)

    afterAll(async () => {
      observeRuntime = undefined
      try {
        await disconnectAutomatorSession()
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
      if (originalPrivateConfig) {
        await fs.writeFile(PRIVATE_CONFIG, originalPrivateConfig, 'utf8')
      }
      await cleanupResidualDevProcesses()
      await cleanupResidualIdeProcesses()
    })

    it('uses direct output and reloads the page instead of preserving its state', async (ctx) => {
      let patchedObserved = false
      observeRuntime = (observation) => {
        if (!patchedObserved && observation.marker === 'STATEFUL-NATIVE-PATCHED') {
          patchedObserved = true
          logClassicReload(host, 'first-patched-marker', new Date().toISOString(), observation)
        }
      }
      const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', [
        ['initial', 'STATEFUL-NATIVE-BASE', 0, ''],
        ['prepared', 'STATEFUL-NATIVE-BASE', 1, 'classic-held-input'],
        ['reloaded', 'STATEFUL-NATIVE-PATCHED', 0, ''],
        ['updated', 'STATEFUL-NATIVE-PATCHED', 2, ''],
      ].map(([id, marker, count, input]) => ({
        id: String(id),
        route: '/pages/native/index',
        action: `检查 classic HMR ${id} 阶段的标题、计数和输入`,
        nodes: [
          { selector: '.marker', text: String(marker) },
          { selector: '.count', text: String(count) },
          { selector: '.input', attributes: { value: String(input) } },
        ],
      })))
      let page = await miniProgram.reLaunch(NATIVE_ROUTE)
      await waitForRuntimeState(state => state.marker === 'STATEFUL-NATIVE-BASE')
      await dom.check('initial', miniProgram, page)
      await miniProgram.evaluate(() => {
        const pages = getCurrentPages()
        const page = pages[pages.length - 1] as any
        page.__statefulHmrIdentity = 'classic-instance'
        page.setData({ input: 'classic-held-input' })
        page.increment()
      })
      expect(await waitForRuntimeState(state => state.count === 1)).toEqual({
        count: 1,
        identity: 'classic-instance',
        input: 'classic-held-input',
        marker: 'STATEFUL-NATIVE-BASE',
        source: 'classic-auto-e2e',
      })
      await dom.check('prepared', miniProgram, page)

      const updatedSource = normalizeNativeSource(originalNativeSource)
        .replace('STATEFUL-NATIVE-BASE', 'STATEFUL-NATIVE-PATCHED')
        .replace('this.data.count + 1', 'this.data.count + 2')
      await replaceFileByRename(NATIVE_SOURCE, updatedSource)
      await devProcess!.waitFor(
        waitForFileContains(DIST_NATIVE_JS, 'this.data.count + 2'),
        'classic HMR direct page output update',
      )

      if (resolveRuntimeProviderName() === 'headless') {
        await disconnectAutomatorSession()
        miniProgram = await connectAutomatorSession()
      }
      else {
        miniProgram = await reconnectAutomator(miniProgram)
      }
      await captureClassicReload(host, 'reconnect-returned')
      // 文件写出和协议重连均可能早于 IDE 自动重载；先验证新代码已重置真实页面状态。
      // 否则带参数的导航会被随后按原 path 执行的宿主重载覆盖。
      await waitForRuntimeState(state => (
        state.marker === 'STATEFUL-NATIVE-PATCHED'
        && state.count === 0
        && state.identity === ''
        && state.input === ''
      ))
      const beforeRelaunch = await captureClassicReload(host, 'automatic-reload-ready')
      // 重连 bridge 后宿主可能只恢复 path 而丢失 query，显式重放完整 route 保持断言身份稳定。
      // 两个阶段共用一次只读快照，保留导航次数；事件时间与宿主快照时间分别记录。
      logClassicReload(host, 'relaunch-before', new Date().toISOString(), beforeRelaunch)
      page = await miniProgram.reLaunch(NATIVE_ROUTE)
      await captureClassicReload(host, 'relaunch-after')
      const reloaded = await waitForRuntimeState(state => (
        state.marker === 'STATEFUL-NATIVE-PATCHED'
        && state.source === 'classic-auto-e2e'
      ))
      expect(reloaded).toEqual({
        count: 0,
        identity: '',
        input: '',
        marker: 'STATEFUL-NATIVE-PATCHED',
        source: 'classic-auto-e2e',
      })
      await dom.check('reloaded', miniProgram, page)

      await miniProgram.evaluate(() => {
        const pages = getCurrentPages()
        const page = pages[pages.length - 1] as any
        page.increment()
      })
      expect((await waitForRuntimeState(state => state.count === 2)).count).toBe(2)
      await dom.check('updated', miniProgram, page)
    })
  })
}
