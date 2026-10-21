import path from 'node:path'
import process from 'node:process'
import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/node'
import { expect } from 'vitest'
import { launchAutomator, reconnectAutomator } from '../../utils/automator'
import { runCleanupSteps } from '../../utils/cleanupSteps'
import { startDevProcess } from '../../utils/dev-process'
import { createDevProcessEnv } from '../../utils/dev-process-env'
import { replaceFileByRename, waitForFileContains, waitForStatefulHmrControl } from '../../utils/hmr-helpers'
import { createNativeHmrPublication } from '../../utils/nativeHmrPublication'
import { resolveRuntimeProviderName } from '../../utils/runtimeProvider'
import { WEVU_JSX_CLI_PATH } from '../../utils/wevu-jsx-tsx'
import { createWevuJsxHmrProject } from '../../utils/wevuJsxHmrProject'
import { installStatefulHmrTransport } from './transport'

export const JSX_HMR_ROUTE = '/pages/tsx-basic/index'
const provider = resolveRuntimeProviderName()

/** JSX 脚本先验证状态保持，编译模板变化后在同一开发会话验证 classic 接管。 */
export function createJsxHmrSession() {
  let fixture: Awaited<ReturnType<typeof createWevuJsxHmrProject>> | undefined
  let dev: ReturnType<typeof startDevProcess> | undefined
  let publication: ReturnType<typeof createNativeHmrPublication> | undefined
  let transport: ReturnType<typeof installStatefulHmrTransport> | undefined
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let pageSource = ''
  let sharedSource = ''
  let originalPage = ''
  let originalShared = ''
  let compiledTemplatePaths: string[] = []
  let runtimeReleased = true
  let devReleased = true

  async function connect(stateful: boolean) {
    runtimeReleased = false
    const project = fixture!.project
    return launchAutomator({
      projectPath: project,
      launchMode: 'bridge',
      trustProject: true,
      maxLaunchRetries: 1,
      timeout: 120_000,
      warmupAllowRelaunch: false,
      warmupAnyPage: true,
      warmupRootSelectors: ['#tsx-island-button'],
      warmupRoute: JSX_HMR_ROUTE,
      headlessCompiledTemplatePaths: compiledTemplatePaths,
      ...(stateful
        ? {
            async configureHeadlessSession(session) {
              const control = await waitForStatefulHmrControl(path.join(project, 'dist/__weapp_vite_hmr/control.js'))
              transport = installStatefulHmrTransport(session, control.url, path.join(project, 'dist/__weapp_vite_hmr/update.js'))
            },
          }
        : {}),
      bridgeProjectMode: 'direct',
    })
  }

  async function state() {
    transport?.assertHealthy()
    const runtime = await miniProgram!.evaluate((keys: string[]) => {
      const global = globalThis as any
      const pages = getCurrentPages()
      const page = pages[pages.length - 1] as any
      const client = global[keys[0]!]
      return {
        identity: String(page?.__jsxHmrIdentity ?? ''),
        route: String(page?.route ?? page?.__route__ ?? ''),
        version: typeof client?.getVersion === 'function' ? Number(client.getVersion()) : -1,
        initialReady: client?.getTransportState?.().initialReady === true,
        pollingStopped: [client, global.wx?.[keys[0]!]].every(value => !value || value.getTransportState?.().phase === 'stopped'),
        statefulKeys: keys.map(key => Boolean(global[key] || global.wx?.[key])),
      }
    }, [WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY, WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY])
    const page = await miniProgram!.currentPage()
    return { ...runtime, count: Number(await page!.data('islandCount', { fallback: false })) }
  }

  async function mark() {
    await miniProgram!.evaluate(() => {
      const pages = getCurrentPages()
      ;(pages[pages.length - 1] as any).__jsxHmrIdentity = 'jsx-hmr-instance'
    })
  }

  return {
    get miniProgram() { return miniProgram! },
    get dev() { return dev! },
    get originalPage() { return originalPage },
    get originalShared() { return originalShared },
    state,
    mark,
    async start() {
      fixture = await createWevuJsxHmrProject()
      const project = fixture.project
      pageSource = path.join(project, 'src/pages/tsx-basic/index.tsx')
      sharedSource = path.join(project, 'src/shared.tsx')
      originalPage = await fs.readFile(pageSource, 'utf8')
      originalShared = await fs.readFile(sharedSource, 'utf8')
      const profilePath = path.join(project, '.tmp/hmr-profile.jsonl')
      devReleased = false
      dev = startDevProcess(process.execPath, [WEVU_JSX_CLI_PATH, 'dev', project, '--platform', 'weapp', '--skipNpm'], {
        cwd: project,
        all: true,
        env: { ...createDevProcessEnv(), WEAPP_VITE_HMR_PROFILE_JSON: profilePath },
        reject: false,
      })
      await dev.waitForInitialBuild()
      await dev.waitFor(waitForStatefulHmrControl(path.join(project, 'dist/__weapp_vite_hmr/control.js')), 'JSX initial stateful control')
      publication = createNativeHmrPublication(project, dev, 'stateful-experimental', ['native-registration'], profilePath)
      const app = await fs.readJson(path.join(project, 'src/app.json')) as { pages: string[] }
      compiledTemplatePaths = [...app.pages.map(route => `${route}.wxml`), 'components/info-card/index.wxml']
      for (const route of app.pages) {
        for (const extension of ['js', 'json', 'wxml']) {
          expect(await fs.pathExists(path.join(project, 'dist', `${route}.${extension}`))).toBe(true)
        }
      }
      miniProgram = await connect(true)
    },
    async begin() {
      expect(await fs.readFile(pageSource, 'utf8')).toBe(originalPage)
      expect(await fs.readFile(sharedSource, 'utf8')).toBe(originalShared)
      const page = await miniProgram!.reLaunch(JSX_HMR_ROUTE)
      await expect.poll(async () => (await state()).initialReady, { timeout: 30_000 }).toBe(true)
      return page
    },
    async saveScript(content: string) {
      expect(publication!.stateful).toBe(true)
      const version = (await state()).version
      await replaceFileByRename(pageSource, content)
      await expect.poll(async () => (await state()).version, { timeout: 30_000 }).toBeGreaterThan(version)
      expect(publication!.stateful).toBe(true)
      expect(dev!.getBuildErrors()).toEqual([])
    },
    async saveClassic(kind: 'page' | 'shared', content: string, marker: string) {
      const source = kind === 'page' ? pageSource : sharedSource
      const appFile = path.join(fixture!.project, 'dist/app.js')
      const previousApp = await fs.readFile(appFile, 'utf8')
      const pending = publication!.capture(source)
      await mark()
      await replaceFileByRename(source, content)
      await pending.wait()
      expect(await fs.readFile(appFile, 'utf8')).not.toBe(previousApp)
      const privateConfig = await fs.readJson(path.join(fixture!.project, 'project.private.config.json')) as { setting?: { compileHotReLoad?: unknown } }
      expect(privateConfig.setting?.compileHotReLoad).toBe(true)
      await dev!.waitFor(waitForFileContains(path.join(fixture!.project, 'dist/pages/tsx-basic/index.wxml'), marker), 'JSX classic template output')
      if (provider === 'headless') {
        // 原客户端必须自行消费退役响应；手动重开仅作为自动 IDE 重载的 companion。
        await expect.poll(async () => (await state()).pollingStopped, { timeout: 30_000 }).toBe(true)
        await transport?.close()
        transport = undefined
        await miniProgram!.close()
        runtimeReleased = true
        miniProgram = await connect(false)
      }
      else {
        miniProgram = await reconnectAutomator(miniProgram!)
      }
      await expect.poll(() => state().catch(() => null), { timeout: 90_000 }).toMatchObject({
        identity: '',
        count: 0,
        route: 'pages/tsx-basic/index',
        pollingStopped: true,
        statefulKeys: [false, false, false],
      })
      await publication!.assertClassicRuntime(miniProgram!)
      expect(dev!.getBuildErrors()).toEqual([])
    },
    async tap() {
      const page = await miniProgram!.currentPage()
      await (await page!.$('#tsx-island-button', { fallback: false }))!.tap()
    },
    async close() {
      await runCleanupSteps([
        { label: 'JSX HMR transport', run: async () => { await transport?.close() } },
        { label: 'JSX HMR runtime', run: async () => {
          if (miniProgram) {
            await miniProgram.close()
            runtimeReleased = true
          }
        } },
        { label: 'JSX HMR dev process', run: async () => {
          if (dev) {
            await dev.stop(5_000)
            devReleased = true
          }
        } },
        { label: 'JSX HMR project', run: async () => {
          if (!runtimeReleased || !devReleased) {
            throw new Error('JSX HMR resources are not released; preserving fixture')
          }
          await fixture?.cleanup()
        } },
      ])
    },
  }
}
