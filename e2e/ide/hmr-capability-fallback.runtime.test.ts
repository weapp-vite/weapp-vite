import type { DomCheckpoint } from '../utils/domAcceptance/types'
import { rename } from 'node:fs/promises'
import path from 'node:path'
import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/node'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolveRuntimeCompilerCli } from '../../packages/weapp-vite/scripts/consumerRuntimeHost.mjs'
import { launchAutomator, reconnectAutomator } from '../utils/automator'
import { runCleanupSteps } from '../utils/cleanupSteps'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDevBuildCompletion } from '../utils/devBuildCompletion'
import { createDomAcceptance } from '../utils/domAcceptance'
import { replaceFileByRename, waitForFileContains, waitForStatefulHmrControl } from '../utils/hmr-helpers'
import { createNativeHmrPublication } from '../utils/nativeHmrPublication'
import { captureNativePublication } from '../utils/nativePublication'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { createStatefulHmrProject } from '../utils/statefulHmrProject'
import { installStatefulHmrTransport } from './statefulHmrDom/transport'

const ROOT = path.resolve(import.meta.dirname, '../..')
const ROUTE = '/pages/native/index?source=capability-fallback'
const hosts = ['wv', 'vite', 'vite-plus'] as const
const provider = resolveRuntimeProviderName()
const scenarios = [
  { requested: 'auto', reason: 'config-json' },
  { requested: 'stateful-experimental', reason: 'native-registration' },
  { requested: 'stateful-experimental', reason: 'entry-topology' },
  { requested: 'auto', reason: 'runtime-contract' },
  { requested: 'stateful-experimental', reason: 'runtime-contract' },
] as const

for (const host of hosts) {
  for (const scenario of scenarios) {
    const { requested, reason } = scenario
    describe(`${host} ${requested} ${reason} capability fallback`, { concurrent: false }, () => {
      let fixture: Awaited<ReturnType<typeof createStatefulHmrProject>> | undefined
      let dev: ReturnType<typeof startDevProcess> | undefined
      let publication: ReturnType<typeof createNativeHmrPublication> | undefined
      let miniProgram: any
      let transport: ReturnType<typeof installStatefulHmrTransport> | undefined
      let initialSource = ''
      let configSource = ''
      let source = ''
      let jsonFile = ''
      let configFile = ''
      let controlFile = ''
      let outputFile = ''
      let updateFile = ''
      let profilePath = ''
      let runtimeReleased = true
      let devReleased = true

      async function connect(stateful: boolean) {
        runtimeReleased = false
        return launchAutomator({
          projectPath: fixture!.projectRoot,
          launchMode: 'bridge',
          trustProject: true,
          timeout: 120_000,
          warmupRoute: ROUTE,
          warmupRootSelectors: ['.page'],
          projectConfig: { setting: { urlCheck: false, useIsolateContext: false, useMultiFrameRuntime: false } },
          ...(stateful
            ? {
                async configureHeadlessSession(session) {
                  const control = await waitForStatefulHmrControl(controlFile)
                  transport = installStatefulHmrTransport(session, control.url, updateFile)
                },
              }
            : {}),
          bridgeProjectMode: 'direct',
        })
      }

      async function state() {
        return miniProgram.evaluate((keys: { client: string, bridge: string, control: string }) => {
          const pages = getCurrentPages()
          const page = pages[pages.length - 1] as any
          const runtime = globalThis as any
          const client = runtime[keys.client]
          const hostClient = runtime.wx?.[keys.client]
          const present = (host: any) => ({
            client: Boolean(host?.[keys.client]),
            bridge: Boolean(host?.[keys.bridge]),
            control: Boolean(host?.[keys.control]),
          })
          return {
            marker: String(page?.data?.marker ?? ''),
            count: Number(page?.data?.count),
            input: String(page?.data?.input ?? ''),
            identity: String(page?.__capabilityIdentity ?? ''),
            route: String(page?.route ?? ''),
            client: client?.getTransportState?.().phase ?? null,
            hostClient: hostClient?.getTransportState?.().phase ?? null,
            global: present(runtime),
            host: present(runtime.wx),
            pollingStopped: [client, hostClient].every(value => !value || value.getTransportState?.().phase === 'stopped'),
          }
        }, { client: WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, bridge: WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY, control: WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY })
      }

      async function waitState(marker: string, count = 0) {
        await expect.poll(async () => state().catch(() => null), { timeout: 90_000, interval: 250 }).toMatchObject({
          marker,
          count,
          input: '',
          identity: '',
          route: 'pages/native/index',
          client: null,
          hostClient: null,
          global: { client: false, bridge: false, control: false },
          host: { client: false, bridge: false, control: false },
          pollingStopped: true,
        })
      }

      async function observeClassic(marker: string) {
        if (provider === 'headless') {
          // companion 只证明新 classic 产物可运行；真实 IDE 分支独立验证自动重载。
          // 先确认旧客户端收到退役响应并停止，再释放测试端 transport，不能用 close 制造停止证据。
          await expect.poll(async () => (await state()).pollingStopped, { timeout: 30_000 }).toBe(true)
          await transport?.close()
          transport = undefined
          await miniProgram.close()
          runtimeReleased = true
          miniProgram = await connect(false)
        }
        else {
          // 只重连既有受管窗口；在观察新状态前不能导航、编译或另开 IDE。
          miniProgram = await reconnectAutomator(miniProgram)
        }
        await waitState(marker)
        await publication!.assertClassicRuntime(miniProgram)
      }

      async function saveClassic(content: string, marker: string) {
        const completed = createDevBuildCompletion(dev!, { source: { file: source, profilePath } })
        const nativeWrite = captureNativePublication(dev!, fixture!.projectRoot)
        await replaceFileByRename(source, content)
        const receipt = await nativeWrite.wait(90_000)
        if (!receipt.profileCursor) {
          throw new Error('Classic source success requires the native write profile cursor')
        }
        await completed.wait(90_000, receipt.profileCursor)
        await dev!.waitFor(waitForFileContains(outputFile, marker), `${marker} in complete classic output`)
        await observeClassic(marker)
      }

      async function assertAddedRoute(stage: string) {
        if (reason !== 'entry-topology') {
          return
        }
        const app = await fs.readJson(path.join(fixture!.projectRoot, 'dist/app.json')) as { pages: string[] }
        expect(app.pages, `${stage}: classic app.json must include the added route`).toContain('pages/capability-added/index')
        for (const extension of ['js', 'json', 'wxml']) {
          expect(await fs.pathExists(path.join(fixture!.projectRoot, `dist/pages/capability-added/index.${extension}`)), `${stage}: added route .${extension}`).toBe(true)
        }
      }

      beforeAll(async () => {
        fixture = await createStatefulHmrProject(ROOT, { compilerHost: host })
        const app = fixture.projectRoot
        source = path.join(app, 'src/pages/native/index.ts')
        jsonFile = path.join(app, 'src/pages/native/index.json')
        configFile = path.join(app, 'weapp-vite.config.ts')
        controlFile = path.join(app, 'dist/__weapp_vite_hmr/control.js')
        updateFile = path.join(app, 'dist/__weapp_vite_hmr/update.js')
        outputFile = path.join(app, 'dist/pages/native/index.js')
        profilePath = path.join(app, '.tmp/hmr-profile.jsonl')
        initialSource = await fs.readFile(source, 'utf8')
        const observerImport = path.relative(app, path.join(ROOT, 'e2e/utils/nativePublication/plugin.ts')).replaceAll('\\', '/')
        configSource = `import { nativePublicationPlugin } from ${JSON.stringify(observerImport)}\n${await fs.readFile(configFile, 'utf8')}`
          .replace('export default defineConfig({', 'export default defineConfig({\n  plugins: [nativePublicationPlugin({ profilePath: process.env.WEAPP_VITE_HMR_PROFILE_JSON })],\n  define: { __HMR_CAPABILITY_CONFIG_MARKER__: JSON.stringify(\'CONFIG-A\') },')
          .replace('logLevel: \'verbose\',', `runtime: '${requested}', logLevel: 'verbose',`)
        if (reason === 'entry-topology') {
          configSource = configSource.replace('srcRoot: \'src\',', 'srcRoot: \'src\',\n    autoRoutes: true,')
        }
        await fs.writeFile(configFile, configSource, 'utf8')
        const viteFile = path.join(app, 'vite.stateful.config.mts')
        await fs.writeFile(viteFile, (await fs.readFile(viteFile, 'utf8'))
          .replace('plugins: [weapp()],', 'plugins: [...(config.plugins ?? []), weapp()],')
          .replace('hmr: { runtime: \'stateful-experimental\', logLevel: \'verbose\' },', 'hmr: config.weapp.hmr,'), 'utf8')
        if (reason === 'entry-topology') {
          const appFile = path.join(app, 'src/app.json')
          const appConfig = await fs.readJson(appFile) as Record<string, unknown>
          // 自动路由排序可以改变 pages 首项；固定 fixture 的冷启动目标以观察同一页面的回退。
          appConfig.entryPagePath = 'pages/native/index'
          await fs.writeJson(appFile, appConfig, { spaces: 2 })
          const privateFile = path.join(app, 'project.private.config.json')
          const privateConfig = await fs.readJson(privateFile) as Record<string, any>
          privateConfig.condition ??= {}
          privateConfig.condition.miniprogram ??= { list: [] }
          privateConfig.condition.miniprogram.list ??= []
          privateConfig.condition.miniprogram.list.push({ name: 'capability topology page', pathName: 'pages/capability-added/index', query: '' })
          await fs.writeJson(privateFile, privateConfig, { spaces: 2 })
        }
        const cli = resolveRuntimeCompilerCli(host!, app, { repositoryRoot: ROOT })
        devReleased = false
        dev = startDevProcess(process.execPath, host === 'wv'
          ? [cli, 'dev', app, '--platform', 'weapp', '--skipNpm']
          : [cli, 'dev', '--config', 'vite.stateful.config.mts', '--host', '127.0.0.1', '--port', '0'], {
          cwd: app,
          all: true,
          env: { ...createDevProcessEnv(), WEAPP_VITE_HMR_PROFILE_JSON: profilePath },
          reject: false,
        })
        // auto 的有效初始模式已由真实 control 文件确认，回退理由按当前场景精确验收。
        publication = createNativeHmrPublication(app, dev, 'stateful-experimental', [reason])
        await dev.waitFor(waitForStatefulHmrControl(controlFile), 'initial stateful control')
        for (const extension of ['js', 'json', 'wxml']) {
          expect(await fs.pathExists(path.join(app, `dist/pages/native/index.${extension}`))).toBe(true)
        }
        miniProgram = await connect(true)
      }, 600_000)

      afterAll(async () => {
        await runCleanupSteps([
          { label: 'fallback transport', run: async () => { await transport?.close() } },
          { label: 'fallback runtime', run: async () => {
            if (miniProgram) {
              await miniProgram.close()
              runtimeReleased = true
            }
          } },
          { label: 'fallback dev process', run: async () => {
            if (dev) {
              await dev.stop(5_000)
              devReleased = true
            }
          } },
          { label: 'fallback isolated fixture', run: async () => {
            if (!runtimeReleased || !devReleased) {
              throw new Error('Preserving fallback fixture because its runtime or watcher ownership is not confirmed released')
            }
            await fixture?.cleanup()
          } },
        ])
      })

      it('hands unsupported updates and rapid saves to classic, then keeps classic across restore and config reload', async (ctx) => {
        const stages = [
          ['prepared', 'STATEFUL-NATIVE-BASE', 1, 'held-fallback-input'],
          ['fallback', 'FALLBACK-A', 0, ''],
          ['interaction', 'FALLBACK-A', 2, ''],
          ['subsequent', 'FALLBACK-B', 0, ''],
          ['restored', 'STATEFUL-NATIVE-BASE', 0, ''],
          ['config-before', 'CONFIG-A', 0, ''],
          ['config-after', 'CONFIG-B', 0, ''],
        ] as const
        const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', stages.map<DomCheckpoint>(([id, marker, count, input]) => ({
          id,
          route: '/pages/native/index',
          action: `验收 classic 回退 ${id} 阶段的真实页面`,
          nodes: [
            { selector: '.marker', text: marker },
            { selector: '.count', text: String(count) },
            { selector: '.input', attributes: { value: input } },
          ],
        })))
        await expect.poll(state, { timeout: 30_000 }).toMatchObject({
          client: 'polling',
          global: { client: true, bridge: true, control: true },
          host: { bridge: true },
          pollingStopped: false,
        })
        let page = await miniProgram.reLaunch(ROUTE)
        await miniProgram.evaluate(() => {
          const pages = getCurrentPages()
          ;(pages[pages.length - 1] as any).__capabilityIdentity = 'before-fallback'
        })
        await (await page.$('.input', { fallback: false })).input('held-fallback-input')
        await (await page.$('.increment', { fallback: false })).tap()
        await dom.check('prepared', miniProgram, page)

        const patched = reason !== 'native-registration'
          ? initialSource.replace('STATEFUL-NATIVE-BASE', 'FALLBACK-A').replace('this.data.count + 1', 'this.data.count + 2')
          : initialSource.replace('STATEFUL-NATIVE-BASE', 'FALLBACK-A')
              .replace('  increment() {', '  nextStep() { this.setData({ count: this.data.count + 2 }) },\n  increment() {')
              .replace('this.setData({ count: this.data.count + 1 })', 'this.nextStep()')
        const handoff = async () => {
          const completed = publication!.capture()
          const nativeWrite = captureNativePublication(dev!, fixture!.projectRoot)
          if (reason === 'config-json') {
            const json = JSON.parse(await fs.readFile(jsonFile, 'utf8')) as Record<string, unknown>
            await replaceFileByRename(jsonFile, `${JSON.stringify({ ...json, navigationBarTitleText: 'Classic fallback' })}\n`)
          }
          else if (reason === 'native-registration') {
            await replaceFileByRename(source, patched.replace('FALLBACK-A', 'FALLBACK-TRIGGER'))
          }
          else if (reason === 'entry-topology') {
            const route = 'pages/capability-added/index'
            const directory = path.join(fixture!.projectRoot, '.tmp/capability-added')
            await fs.ensureDir(directory)
            await fs.writeFile(path.join(directory, 'index.wxml'), '<view>Capability topology page</view>\n')
            await fs.writeJson(path.join(directory, 'index.json'), {})
            await fs.writeFile(path.join(directory, 'index.ts'), 'Page({ data: { marker: "CAPABILITY-ADDED" } })\n')
            await rename(directory, path.join(fixture!.projectRoot, 'src', path.dirname(route)))
          }
          else {
            expect(await state()).toMatchObject({ client: 'polling', global: { bridge: true }, identity: 'before-fallback' })
            // 让下一次真实补丁交付发现 bridge 缺失，不合成请求或抛出业务异常。
            const removed = await miniProgram.evaluate((key: string) => {
              const runtime = globalThis as Record<string, unknown>
              const bridge = runtime[key] as { ready?: boolean } | undefined
              return { ready: Boolean(bridge?.ready), deleted: Reflect.deleteProperty(runtime, key), present: key in runtime }
            }, WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)
            expect(removed).toEqual({ ready: true, deleted: true, present: false })
          }
          await replaceFileByRename(source, patched)
          await dev!.waitForOutput('[weapp-vite] HMR fallback ', 'capability fallback decision')
          expect(dev!.getOutput()).toContain(`"reason":"${reason}"`)
          await dev!.waitForOutput('[weapp-vite] HMR classic ready ', 'classic handoff completion')
          await completed.wait()
          await nativeWrite.wait(90_000)
          await dev!.waitFor(waitForFileContains(outputFile, 'FALLBACK-A'), 'pending edit in native classic output')
          await publication!.assertClassicOutput()
          expect(dev!.getBuildErrors()).toEqual([])
          await assertAddedRoute('first classic publication')
          if (reason === 'runtime-contract') {
            expect(dev!.getOutput()).not.toContain('[weapp-vite] stateful HMR client patch-failed:')
          }
          await observeClassic('FALLBACK-A')
        }
        await handoff()
        page = await miniProgram.currentPage()
        await dom.check('fallback', miniProgram, page)
        await (await page.$('.increment', { fallback: false })).tap()
        await expect.poll(async () => (await state()).count).toBe(2)
        await dom.check('interaction', miniProgram, page)

        await saveClassic(patched.replace('FALLBACK-A', 'FALLBACK-B'), 'FALLBACK-B')
        await dom.check('subsequent', miniProgram, await miniProgram.currentPage())
        await saveClassic(initialSource, 'STATEFUL-NATIVE-BASE')
        await dom.check('restored', miniProgram, await miniProgram.currentPage())

        await saveClassic(initialSource.replace('\'STATEFUL-NATIVE-BASE\'', '__HMR_CAPABILITY_CONFIG_MARKER__'), 'CONFIG-A')
        await dom.check('config-before', miniProgram, await miniProgram.currentPage())
        const configWrite = captureNativePublication(dev!, fixture!.projectRoot)
        await replaceFileByRename(configFile, configSource.replace('CONFIG-A', 'CONFIG-B'))
        await configWrite.wait(90_000)
        await dev!.waitFor(waitForFileContains(outputFile, 'CONFIG-B'), 'classic output after config reload')
        await observeClassic('CONFIG-B')
        await dom.check('config-after', miniProgram, await miniProgram.currentPage())
        expect(await fs.pathExists(controlFile)).toBe(false)
        expect(dev!.getOutput().match(/\[weapp-vite\] HMR fallback /g)).toHaveLength(1)
        expect(dev!.getOutput()).toContain(`"reason":"${reason}"`)
        await assertAddedRoute('config reload publication')
      }, 600_000)
    })
  }
}
