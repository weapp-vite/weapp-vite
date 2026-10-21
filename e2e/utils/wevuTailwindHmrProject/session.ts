import type { HeadlessSession } from '../../../mpcore/packages/simulator/src'
import type { createWevuTailwindHmrProject } from './index'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME } from '@weapp-core/constants'
import { expect, vi } from 'vitest'
import { attachRuntimeErrorCollector } from '../../ide/runtimeErrors'
import { installStatefulHmrTransport } from '../../ide/statefulHmrDom/transport'
import { launchAutomator, reconnectAutomator } from '../automator'
import { runCleanupSteps } from '../cleanupSteps'
import { startDevProcess } from '../dev-process'
import { createDevProcessEnv } from '../dev-process-env'
import { readEmittedStylesheet, waitForEmittedStylesheet } from '../emittedStylesheet'
import { waitForFileContains, waitForStatefulHmrControl } from '../hmr-helpers'
import { createNativeHmrPublication } from '../nativeHmrPublication'
import { resolveRuntimeProviderName } from '../runtimeProvider'
import { collectCommonJsExportNames } from '../wevu-vendor-exports'
import { createWevuTailwindHmrFileDiagnostics } from '../wevuTailwindHmrDiagnostics'
import { WEVU_TAILWIND_INITIAL_HEX, WEVU_TAILWIND_PROBE, WEVU_TAILWIND_ROUTE } from './source'

const INSTANCE_MARKER = 'wevu-tailwind-stateful-instance'

/** 单个模板 fixture 只启动一次 IDE；classic 仅重连原 owner，headless 明确重建独立 companion。 */
export function createWevuTailwindHmrSession(repositoryRoot: string, fixture: Awaited<ReturnType<typeof createWevuTailwindHmrProject>>) {
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let dev: ReturnType<typeof startDevProcess> | undefined
  let transport: ReturnType<typeof installStatefulHmrTransport> | undefined
  let publication: ReturnType<typeof createNativeHmrPublication> | undefined
  let runtimeReleased = true
  let devReleased = true
  const collectors: ReturnType<typeof attachRuntimeErrorCollector>[] = []
  const headless = resolveRuntimeProviderName() === 'headless'
  const dist = path.join(fixture.project, 'dist')
  const profilePath = path.join(fixture.project, '.tmp/hmr-profile.jsonl')
  const control = path.join(dist, '__weapp_vite_hmr/control.js')
  const update = path.join(dist, '__weapp_vite_hmr/update.js')
  const app = () => {
    if (!miniProgram) {
      throw new Error('Wevu Tailwind runtime has not started')
    }
    return miniProgram
  }
  const watcher = () => {
    if (!dev) {
      throw new Error('Wevu Tailwind dev watcher has not started')
    }
    return dev
  }

  async function connect(stateful: boolean) {
    runtimeReleased = false
    const session = await launchAutomator({
      projectPath: fixture.project,
      launchMode: 'bridge',
      trustProject: true,
      warmupAllowRelaunch: false,
      warmupRoute: WEVU_TAILWIND_ROUTE,
      warmupRootSelectors: [`#${WEVU_TAILWIND_PROBE}`],
      maxLaunchRetries: 1,
      ...(stateful
        ? {
            async configureHeadlessSession(session: HeadlessSession) {
              const endpoint = await waitForStatefulHmrControl(control)
              transport = installStatefulHmrTransport(session, endpoint.url, update)
            },
          }
        : {}),
      bridgeProjectMode: 'direct',
    })
    collectors.push(attachRuntimeErrorCollector(session))
    return session
  }

  async function state() {
    return app().evaluate((clientKey: string) => {
      const runtime = globalThis as any
      const pages = getCurrentPages()
      const page = pages[pages.length - 1] as any
      const app = getApp() as any
      const client = runtime[clientKey]
      const hostClient = runtime.wx?.[clientKey]
      return {
        route: String(page?.route ?? ''),
        pageMarker: page?.__e2eTailwindMarker ?? null,
        appMarker: app?.__e2eTailwindMarker ?? null,
        client: client?.getTransportState?.().phase ?? null,
        version: client?.getVersion?.() ?? null,
        pollingStopped: [client, hostClient].every(value => !value || value.getTransportState?.().phase === 'stopped'),
      }
    }, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)
  }

  async function page() {
    await vi.waitFor(async () => {
      expect((await app().currentPage({ retries: 1, timeout: 6_000 }))?.path).toBe(WEVU_TAILWIND_ROUTE.slice(1))
    }, { timeout: 45_000 })
    const current = await app().currentPage({ retries: 1, timeout: 6_000 })
    if (!current) {
      throw new Error('Wevu Tailwind current page is unavailable')
    }
    return current
  }

  async function waitRuntime(hex: string) {
    await vi.waitFor(async () => {
      const current = await page()
      const node = await current.$(`#${WEVU_TAILWIND_PROBE}`, { fallback: false })
      const readAttribute = node.attribute ?? node.attr
      if (!readAttribute) {
        throw new Error('DOM provider cannot read rendered attributes')
      }
      expect(await readAttribute.call(node, 'data-e2e-bg')).toBe(hex)
    }, { timeout: 45_000 })
  }

  async function assertStateful() {
    await vi.waitFor(async () => {
      expect(await state()).toMatchObject({
        route: WEVU_TAILWIND_ROUTE.slice(1),
        pageMarker: INSTANCE_MARKER,
        appMarker: INSTANCE_MARKER,
        client: 'polling',
      })
    }, { timeout: 30_000 })
    expect(watcher().getOutput()).not.toContain('[weapp-vite] HMR fallback ')
    transport?.assertHealthy()
  }

  async function markInstances() {
    await app().evaluate((marker: string) => {
      const pages = getCurrentPages()
      ;(pages[pages.length - 1] as any).__e2eTailwindMarker = marker
      ;(getApp() as any).__e2eTailwindMarker = marker
    }, INSTANCE_MARKER)
  }

  return {
    get released() { return runtimeReleased && devReleased },
    get app() { return app() },
    get dev() { return watcher() },
    get publication() { return publication! },
    profilePath,
    state,
    page,
    waitRuntime,
    assertStateful,
    markInstances,
    captureFiles: (label: string) => createWevuTailwindHmrFileDiagnostics(app(), fixture.project, WEVU_TAILWIND_ROUTE).capture(label),
    async start() {
      devReleased = false
      dev = startDevProcess(process.execPath, [path.join(repositoryRoot, 'packages/weapp-vite/bin/weapp-vite.js'), 'dev', '--non-interactive'], {
        cwd: fixture.project,
        env: { ...createDevProcessEnv(), WEAPP_VITE_HMR_PROFILE_JSON: profilePath },
        reject: false,
      })
      publication = createNativeHmrPublication(fixture.project, dev, 'stateful-experimental', ['native-registration'], profilePath)
      await dev.waitForInitialBuild()
      await dev.waitFor(waitForStatefulHmrControl(control), 'template initial stateful control')
      await waitForFileContains(path.join(dist, 'app.wxss'), `@import "./${WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME}.wxss";`)
      await waitForEmittedStylesheet(path.join(dist, 'pages/index/index.wxss'), 'background-color: #f6f7fb')
      const [appSource, pageSource, runtime, appJson] = await Promise.all([
        readFile(path.join(dist, 'app.js'), 'utf8'),
        readFile(path.join(dist, 'pages/index/index.js'), 'utf8'),
        readFile(path.join(dist, 'weapp-vendors/wevu-runtime.js'), 'utf8'),
        readFile(path.join(dist, 'app.json'), 'utf8'),
      ])
      expect(appSource).toContain('require("./weapp-vendors/wevu-runtime.js")')
      expect(appSource).toContain('setWevuDefaults')
      expect(appSource).not.toContain('from "wevu/internal-runtime"')
      expect(pageSource).toContain('require("../../weapp-vendors/wevu-runtime.js")')
      expect(pageSource).toContain('createWevuComponent')
      expect(collectCommonJsExportNames(pageSource).has('default') || /\bmodule\.exports\s*=/.test(pageSource)).toBe(true)
      expect(collectCommonJsExportNames(runtime).has('createApp')).toBe(true)
      expect(collectCommonJsExportNames(runtime).has('setWevuDefaults')).toBe(true)
      expect(JSON.parse(appJson) as { pages: string[] }).toMatchObject({ pages: ['pages/index/index'] })
      for (const extension of ['js', 'json', 'wxml', 'wxss']) {
        expect(await readFile(path.join(dist, `pages/index/index.${extension}`), 'utf8')).not.toBe('')
      }
      expect(await readEmittedStylesheet(path.join(dist, 'app.wxss'))).toContain('background-color: #f6f7fb')
      miniProgram = await connect(true)
      await waitRuntime(WEVU_TAILWIND_INITIAL_HEX)
      await markInstances()
      await assertStateful()
    },
    async observeClassic(hex: string) {
      if (headless) {
        // 旧客户端必须先收到真实退役响应；测试 close 不得制造停止证据。
        await expect.poll(async () => (await state()).pollingStopped, { timeout: 30_000 }).toBe(true)
        await transport?.close()
        transport = undefined
        await app().close()
        runtimeReleased = true
        miniProgram = await connect(false)
      }
      else {
        // 原 IDE owner 自动刷新；观察默认状态前不导航、不编译、不另开窗口。
        miniProgram = await reconnectAutomator(app())
        collectors.push(attachRuntimeErrorCollector(miniProgram))
      }
      await waitRuntime(hex)
      await expect.poll(() => state(), { timeout: 45_000 }).toMatchObject({
        route: WEVU_TAILWIND_ROUTE.slice(1),
        pageMarker: null,
        appMarker: null,
        client: null,
        pollingStopped: true,
      })
      await publication!.assertClassicRuntime(app())
    },
    assertNoRuntimeErrors() {
      expect(collectors.flatMap(collector => collector.getAll())).toEqual([])
      const logs = collectors.flatMap(collector => collector.getAllLogs()).join('\n')
      for (const forbidden of ['unexpected current frame status timedout', 'appLaunch with non-empty page stack', 'Page route 错误']) {
        expect(logs).not.toContain(forbidden)
      }
    },
    async close() {
      await runCleanupSteps([
        { label: 'template Tailwind collectors', run: () => { collectors.forEach(collector => collector.dispose()) } },
        { label: 'template Tailwind transport', run: async () => { await transport?.close() } },
        { label: 'template Tailwind owned runtime', run: async () => {
          if (miniProgram) {
            await miniProgram.close()
            runtimeReleased = true
          }
        } },
        { label: 'template Tailwind owned watcher', run: async () => {
          if (dev) {
            await dev.stop(5_000)
            devReleased = true
          }
        } },
      ])
    },
  }
}
