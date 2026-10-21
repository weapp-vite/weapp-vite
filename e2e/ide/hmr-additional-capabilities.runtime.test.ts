import path from 'node:path'
import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/node'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator, reconnectAutomator } from '../utils/automator'
import { runCleanupSteps } from '../utils/cleanupSteps'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { replaceFileByRename, waitForFileContains, waitForFileRemoved, waitForStatefulHmrControl } from '../utils/hmr-helpers'
import { createHmrBoundaryProject } from '../utils/hmrBoundaryProject'
import { createNativeHmrPublication } from '../utils/nativeHmrPublication'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { installStatefulHmrTransport } from './statefulHmrDom/transport'

const ROOT = path.resolve(import.meta.dirname, '../..')
const CLI = path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const ROUTE = '/pages/native/index?source=additional-capability'
const provider = resolveRuntimeProviderName()

for (const reason of ['engine-full-reload', 'patch-shape', 'skyline'] as const) {
  describe(`wv ${reason} real source capability fallback`, { concurrent: false }, () => {
    let fixture: Awaited<ReturnType<typeof createHmrBoundaryProject>> | undefined
    let dev: ReturnType<typeof startDevProcess> | undefined
    let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
    let transport: ReturnType<typeof installStatefulHmrTransport> | undefined
    let publication: ReturnType<typeof createNativeHmrPublication> | undefined
    let runtimeReleased = true
    let devReleased = true
    let controlFile = ''
    let updateFile = ''
    let outputFile = ''
    let profilePath = ''

    function app() {
      if (!miniProgram) {
        throw new Error('Capability boundary runtime is not initialized')
      }
      return miniProgram
    }

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
      return app().evaluate((keys: { client: string, bridge: string }) => {
        const pages = getCurrentPages()
        const page = pages[pages.length - 1] as any
        const snapshot = getApp().globalData?.capabilitySnapshot ?? page?.data
        const client = (globalThis as any)[keys.client]
        const hostClient = (globalThis as any).wx?.[keys.client]
        return {
          marker: String(snapshot?.marker ?? ''),
          count: Number(snapshot?.count),
          input: String(snapshot?.input ?? ''),
          identity: String(page?.__capabilityIdentity ?? ''),
          route: String(page?.route ?? ''),
          renderer: String(getApp().globalData?.renderer ?? ''),
          client: client?.getTransportState?.().phase ?? null,
          pollingStopped: [client, hostClient].every(value => !value || value.getTransportState?.().phase === 'stopped'),
          bridge: Boolean((globalThis as any)[keys.bridge]),
        }
      }, { client: WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, bridge: WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY })
    }

    async function waitState(marker: string, count = 0, input = '', identity = '') {
      await expect.poll(async () => state().catch(() => null), { timeout: 90_000, interval: 250 }).toMatchObject({
        marker,
        count,
        input,
        identity,
        route: 'pages/native/index',
        ...(reason === 'skyline' ? { renderer: 'skyline' } : {}),
      })
    }

    async function assertClassicArtifacts() {
      await waitForFileRemoved(controlFile)
      expect(await fs.pathExists(updateFile)).toBe(false)
      expect(dev!.getBuildErrors()).toEqual([])
      await publication!.assertClassicOutput()
    }

    async function observeClassic(marker: string) {
      if (provider === 'headless') {
        // companion 验证 emit 的 classic 产物；自动刷新只由真实 IDE 分支验收。
        // 先观察旧客户端自行退役，再关闭测试 transport 和 VM；启动即 classic 时没有旧客户端。
        await expect.poll(async () => (await state()).pollingStopped, { timeout: 30_000 }).toBe(true)
        await transport?.close()
        transport = undefined
        await app().close()
        runtimeReleased = true
        miniProgram = await connect(false)
      }
      else {
        // 重连原 owner，不导航、不编译，不创建第二个窗口。
        miniProgram = await reconnectAutomator(app())
      }
      await waitState(marker)
      expect(await state()).toMatchObject({ client: null, bridge: false })
      await publication!.assertClassicRuntime(app())
    }

    beforeAll(async () => {
      fixture = await createHmrBoundaryProject(ROOT, reason)
      const project = fixture.projectRoot
      controlFile = path.join(project, 'dist/__weapp_vite_hmr/control.js')
      updateFile = path.join(project, 'dist/__weapp_vite_hmr/update.js')
      outputFile = path.join(project, 'dist/pages/native/index.js')
      profilePath = path.join(project, '.tmp/hmr-profile.jsonl')
      devReleased = false
      dev = startDevProcess(process.execPath, [CLI, 'dev', project, '--platform', 'weapp', '--skipNpm'], {
        cwd: project,
        all: true,
        env: { ...createDevProcessEnv(), WEAPP_VITE_HMR_PROFILE_JSON: profilePath },
        reject: false,
      })
      publication = createNativeHmrPublication(project, dev, 'stateful-experimental', [reason], profilePath)
      if (reason !== 'skyline') {
        await dev.waitFor(waitForStatefulHmrControl(controlFile), 'initial stateful control')
      }
      else {
        await dev.waitForOutput('[weapp-vite] HMR classic ready ', 'Skyline startup classic handoff')
        expect(dev.getOutput()).toContain('"reason":"skyline"')
        await assertClassicArtifacts()
      }
      await dev.waitFor(waitForFileContains(outputFile, 'STATEFUL-NATIVE-BASE'), 'boundary initial page output')
      for (const extension of ['js', 'json', 'wxml']) {
        expect(await fs.pathExists(path.join(project, `dist/pages/native/index.${extension}`))).toBe(true)
      }
      miniProgram = await connect(reason !== 'skyline')
    }, 600_000)

    afterAll(async () => {
      await runCleanupSteps([
        { label: 'boundary transport', run: async () => { await transport?.close() } },
        { label: 'boundary runtime', run: async () => {
          if (miniProgram) {
            await miniProgram.close()
            runtimeReleased = true
          }
        } },
        { label: 'boundary dev watcher', run: async () => {
          if (dev) {
            await dev.stop(5_000)
            devReleased = true
          }
        } },
        { label: 'boundary isolated fixture', run: async () => {
          if (!runtimeReleased || !devReleased) {
            throw new Error('Preserving boundary fixture because runtime or watcher ownership is not confirmed released')
          }
          await fixture?.cleanup()
        } },
      ])
    })

    it('uses the real source boundary and stays classic through subsequent edits and restoration', async (ctx) => {
      const fallbackMarker = reason === 'engine-full-reload' ? 'STATEFUL-NATIVE-BASE' : 'BOUNDARY-A'
      const checkpoints = [
        ['initial', 'STATEFUL-NATIVE-BASE', 0, ''],
        ['prepared', 'STATEFUL-NATIVE-BASE', 1, 'boundary-input'],
        ['fallback', fallbackMarker, 0, ''],
        ['edited', 'BOUNDARY-A', 0, ''],
        ['interaction', 'BOUNDARY-A', 2, ''],
        ['subsequent', 'BOUNDARY-B', 0, ''],
        ['restored', 'STATEFUL-NATIVE-BASE', 0, ''],
      ] as const
      const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', checkpoints.map(([id, marker, count, input]) => ({
        id,
        route: '/pages/native/index',
        action: `验收 ${reason} 的 ${id} 页面及状态`,
        nodes: [
          { selector: '.marker', text: marker, ...(provider === 'devtools' ? { visible: true } : {}) },
          { selector: '.count', text: String(count), ...(provider === 'devtools' ? { visible: true } : {}) },
          { selector: '.input', attributes: { value: input }, ...(provider === 'devtools' ? { visible: true } : {}) },
        ],
      })))
      await waitState('STATEFUL-NATIVE-BASE')
      await expect.poll(state, { timeout: 30_000 }).toMatchObject(reason !== 'skyline'
        ? { client: 'polling', bridge: true }
        : { client: null, bridge: false })
      let page = await app().currentPage()
      if (!page) {
        throw new Error('Boundary page is unavailable')
      }
      await dom.check('initial', app(), page)
      await app().evaluate(() => {
        const pages = getCurrentPages()
        ;(pages[pages.length - 1] as any).__capabilityIdentity = 'before-boundary'
      })
      await (await page.$('.input', { fallback: false })).input('boundary-input')
      await (await page.$('.increment', { fallback: false })).tap()
      await waitState('STATEFUL-NATIVE-BASE', 1, 'boundary-input', 'before-boundary')
      await dom.check('prepared', app(), page)

      const patched = fixture!.initialSource.replace('STATEFUL-NATIVE-BASE', 'BOUNDARY-A').replace('count + 1', 'count + 2')
      const firstPublication = publication!.capture(reason === 'engine-full-reload' ? fixture!.engineInput : fixture!.source)
      if (reason === 'engine-full-reload') {
        await replaceFileByRename(fixture!.engineInput, `${JSON.stringify({ compilerOptions: { useDefineForClassFields: false } })}\n`)
      }
      else {
        await replaceFileByRename(fixture!.source, patched)
      }
      await firstPublication.wait()
      expect(dev!.getOutput()).toContain(`"reason":"${reason}"`)
      await dev!.waitFor(waitForFileContains(outputFile, fallbackMarker), 'first boundary classic output')
      await observeClassic(fallbackMarker)
      page = await app().currentPage()
      await dom.check('fallback', app(), page!)
      if (reason === 'engine-full-reload') {
        const edited = publication!.capture(fixture!.source)
        await replaceFileByRename(fixture!.source, patched)
        await edited.wait()
        await observeClassic('BOUNDARY-A')
      }
      await dom.check('edited', app(), (await app().currentPage())!)
      page = await app().currentPage()
      await (await page!.$('.increment', { fallback: false })).tap()
      await waitState('BOUNDARY-A', 2)
      await dom.check('interaction', app(), page!)

      const subsequent = publication!.capture(fixture!.source)
      await replaceFileByRename(fixture!.source, patched.replace('BOUNDARY-A', 'BOUNDARY-B'))
      await subsequent.wait()
      await dev!.waitFor(waitForFileContains(outputFile, 'BOUNDARY-B'), 'subsequent boundary classic output')
      await observeClassic('BOUNDARY-B')
      await dom.check('subsequent', app(), (await app().currentPage())!)
      const restored = publication!.capture(fixture!.source)
      await replaceFileByRename(fixture!.source, fixture!.initialSource)
      await restored.wait()
      await dev!.waitFor(waitForFileContains(outputFile, 'STATEFUL-NATIVE-BASE'), 'restored boundary classic output')
      await observeClassic('STATEFUL-NATIVE-BASE')
      await dom.check('restored', app(), (await app().currentPage())!)
      expect(dev!.getOutput().match(/\[weapp-vite\] HMR fallback /g)).toHaveLength(1)
    }, 600_000)
  })
}
