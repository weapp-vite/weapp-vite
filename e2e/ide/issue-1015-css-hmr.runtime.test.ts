import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY } from '@weapp-core/constants'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { captureAppReloadMarker, waitForAppReload } from '../utils/appReload'
import { launchAutomator, reconnectAutomator } from '../utils/automator'
import { createClassicAssetScriptContract } from '../utils/classicAssetScriptContract'
import { runCleanupSteps } from '../utils/cleanupSteps'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { createHmrOutputDiagnostics } from '../utils/hmrOutputDiagnostics'
import { createHmrRuntimeDiagnostics } from '../utils/hmrRuntimeDiagnostics'
import { createIssue1015HmrPublication, issue1015ExpectedMarkerMatches } from '../utils/issue1015HmrContract'
import { createIssue1015HmrDiagnostics } from '../utils/issue1015HmrDiagnostics'
import { createIssue1015Project, ISSUE_1015_CLI } from '../utils/issue1015Project'
import { checkIssue1015SharedStyleHmr, issue1015SharedStyleCheckpoints } from '../utils/issue1015SharedStyle'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { installStatefulHmrTransport } from '../utils/statefulHmrTransport'

const ROUTE = '/pages/issue-1015/index'

for (const runtime of ['classic', 'stateful-experimental'] as const) {
  describe(`issue #1015 external CSS HMR: ${runtime}`, () => {
    let project: string
    let dev: ReturnType<typeof startDevProcess> | undefined
    let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
    let disposeTransport: (() => void) | undefined
    let publication: ReturnType<typeof createIssue1015HmrPublication>
    let runtimeReleased = true
    let devReleased = true
    const runtimeErrors: unknown[] = []

    function observeRuntime(session: Awaited<ReturnType<typeof launchAutomator>>) {
      session.on('exception', (event: { message?: unknown }) => {
        runtimeErrors.push(event.message)
        process.stdout.write(`[issue-1015-exception] ${JSON.stringify(event)}\n`)
      })
      session.on('console', (event: { level?: unknown }) => {
        if (event.level === 'error') {
          process.stdout.write(`[issue-1015-console] ${JSON.stringify(event)}\n`)
        }
      })
      miniProgram = session
      return session
    }

    async function connect() {
      runtimeReleased = false
      return observeRuntime(await launchAutomator({
        ...(publication.stateful
          ? { configureHeadlessSession: (session: Parameters<typeof installStatefulHmrTransport>[0]) => {
              disposeTransport = installStatefulHmrTransport(session, path.join(project, 'dist'))
            } }
          : {}),
        projectPath: project,
        bridgeProjectMode: 'direct',
        warmupRoute: ROUTE,
        warmupRootSelectors: ['#issue-1015-page'],
      }))
    }

    beforeAll(async () => {
      project = await createIssue1015Project({ nativePublication: true })
      const profilePath = path.join(project, '.tmp/hmr-profile.jsonl')
      devReleased = false
      dev = startDevProcess(process.execPath, [ISSUE_1015_CLI, 'dev', '--non-interactive'], {
        cwd: project,
        env: { ...createDevProcessEnv(), WEAPP_GITHUB_ISSUE_1015_HMR_RUNTIME: runtime, WEAPP_VITE_HMR_PROFILE_JSON: profilePath },
        reject: false,
      })
      publication = createIssue1015HmrPublication(project, dev, runtime, profilePath)
      await dev.waitForInitialBuild()
      if (runtime === 'stateful-experimental') {
        // 微信启动时先完成能力交接；CSS 编辑继续验收实际 classic 发布和宿主自动重载。
        await dev.waitForOutput('[weapp-vite] HMR classic ready ', 'startup classic fallback completion')
      }
      expect(publication.stateful).toBe(false)
      await publication.assertClassicOutput()
      for (const extension of ['js', 'json', 'wxml', 'wxss']) {
        expect(await readFile(path.join(project, `dist/pages/issue-1015/index.${extension}`), 'utf8')).not.toBe('')
      }
      await connect()
    }, 180_000)

    afterAll(async () => {
      await runCleanupSteps([
        { label: 'CSS transport', run: () => { disposeTransport?.() } },
        { label: 'CSS runtime', run: async () => {
          if (miniProgram) {
            await miniProgram.close()
            runtimeReleased = true
          }
        } },
        { label: 'CSS dev watcher', run: async () => {
          if (dev) {
            await dev.stop()
            devReleased = true
          }
        } },
        { label: 'CSS isolated fixture', run: async () => {
          if (!runtimeReleased || !devReleased) {
            throw new Error('Preserving CSS fixture because runtime or watcher ownership is not confirmed released')
          }
          if (project) {
            await rm(project, { recursive: true, force: true })
          }
        } },
      ])
    }, 60_000)

    it('renders all seven updates including removing and restoring every CSS variable', async (context) => {
      // 两种 provider 共用完整编辑序列；真实宿主额外验收计算样式。
      const computedStyles = resolveRuntimeProviderName() === 'devtools'
      const checkpoints = [
        { id: 'initial', color: 'rgb(255, 0, 0)', background: undefined },
        { id: 'style-only', color: 'rgb(255, 0, 0)', background: 'rgb(255, 255, 0)' },
        { id: 'source-switch', color: 'rgb(255, 0, 0)', background: 'rgb(255, 192, 203)' },
        { id: 'replace-variable', color: 'rgb(255, 165, 0)', background: undefined },
        { id: 'remove-variable', color: 'rgb(0, 0, 0)', background: undefined },
        { id: 'restore-variable', color: 'rgb(255, 0, 0)', background: undefined },
        { id: 'reactive', color: 'rgb(0, 0, 255)', background: undefined },
      ]
      const dom = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-1015', [...checkpoints.map(checkpoint => ({
        id: checkpoint.id,
        route: ROUTE,
        action: `检查 ${checkpoint.id} 外部 CSS 变量更新`,
        nodes: [
          {
            selector: '#issue-1015-page',
            attributes: { 'data-theme-color': checkpoint.id === 'reactive' ? 'blue' : 'red' },
            ...(computedStyles ? { styles: { color: checkpoint.color, ...(checkpoint.background ? { 'background-color': checkpoint.background } : {}) } } : {}),
          },
          { selector: '#issue-1015-state', text: `external css vars ${checkpoint.id === 'reactive' ? 'updated' : 'initial'}` },
        ],
      })), ...(runtime === 'classic' ? issue1015SharedStyleCheckpoints(computedStyles) : [])])
      let host = miniProgram!
      let diagnostics = createHmrRuntimeDiagnostics(host as any, 'e2e-apps/github-issues/fixtures/issue-1015')
      const sourceDir = path.join(project, 'src/pages/issue-1015')
      const sourcePath = path.join(sourceDir, 'index.vue')
      const cssPath = path.join(sourceDir, 'index.css')
      const alternatePath = path.join(sourceDir, 'alternate.css')
      const source = await readFile(sourcePath, 'utf8')
      const css = await readFile(cssPath, 'utf8')
      const emittedCss = path.join(project, 'dist/pages/issue-1015/index.wxss')
      const emittedScript = path.join(project, 'dist/pages/issue-1015/index.js')
      const emittedAppScript = path.join(project, 'dist/app.js')
      const initialAppScript = await readFile(emittedAppScript, 'utf8')
      let loadedAppScript = initialAppScript
      let loadedScript = await readFile(emittedScript, 'utf8')
      const classicScripts = runtime === 'classic' ? await createClassicAssetScriptContract(path.join(project, 'dist'), 'weapp') : undefined
      const outputDiagnostics = createHmrOutputDiagnostics(path.join(project, 'dist'), 'e2e-apps/github-issues/fixtures/issue-1015')
      const failureDiagnostics = createIssue1015HmrDiagnostics({
        stylesheetPath: emittedCss,
        projectPath: project,
        captureOutput: label => outputDiagnostics.capture(label, loadedScript),
        captureRuntime: label => diagnostics.capture(label),
        getDevOutput: () => dev!.getOutput(),
      })
      await host.reLaunch(ROUTE)
      await diagnostics.initialize()
      const originalMarkers = await host.evaluate(() => {
        const pages = getCurrentPages()
        return { app: (getApp() as any).__e2eHmrInstanceMarker, page: (pages[pages.length - 1] as any).__e2eHmrInstanceMarker }
      })
      expect(originalMarkers).toEqual({ app: expect.any(String), page: expect.any(String) })

      async function syncHeadlessFullBuild() {
        if (computedStyles || publication.stateful) {
          return
        }
        const [script, appScript] = await Promise.all([readFile(emittedScript, 'utf8'), readFile(emittedAppScript, 'utf8')])
        if (script !== loadedScript || appScript !== loadedAppScript) {
          await outputDiagnostics.capture('before-headless-reload', loadedScript)
          // headless 没有 IDE 的磁盘重编译监听；根入口 generation 或页面完整脚本变化时换 VM。
          // 这是 classic 的 companion；真实 IDE 分支必须由宿主自动重载，不能手动换页。
          // update.js 的增量交付继续复用当前 VM，不能靠重连掩盖 patch 失败。
          await expect.poll(() => host.evaluate((key: string) => {
            const globals = globalThis as any
            return [globals[key], globals.wx?.[key]].every(client => !client || client.getTransportState?.().phase === 'stopped')
          }, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY), { timeout: 30_000 }).toBe(true)
          disposeTransport?.()
          disposeTransport = undefined
          await host.close()
          runtimeReleased = true
          host = await connect()
          loadedAppScript = appScript
          loadedScript = script
          diagnostics = createHmrRuntimeDiagnostics(host as any, 'e2e-apps/github-issues/fixtures/issue-1015')
          await diagnostics.initialize()
          await outputDiagnostics.capture('after-headless-reload', loadedScript)
        }
      }

      async function check(id: string) {
        const expected = checkpoints.find(checkpoint => checkpoint.id === id)!
        await outputDiagnostics.capture(`${id}-before-runtime`, loadedScript)
        if (id === 'style-only') {
          if (classicScripts) {
            await classicScripts.assertUpdated()
          }
          else {
            expect(publication.stateful).toBe(false)
            expect(await readFile(emittedAppScript, 'utf8')).not.toBe(initialAppScript)
          }
        }
        if (publication.stateful) {
          await expect.poll(async () => {
            await syncHeadlessFullBuild()
            const control = await readFile(path.join(project, 'dist', WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE), 'utf8')
            const state = await host.evaluate((clientKey: string, controlKey: string) => {
              const globals = globalThis as any
              const transport = globals[clientKey]?.getTransportState?.()
              return { buildId: globals[controlKey]?.buildId, response: transport?.lastResponse?.type, phase: transport?.phase }
            }, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY)
            return state.phase === 'polling' && state.response !== 'rebuilding' && typeof state.buildId === 'string' && control.includes(state.buildId)
          }, { timeout: 45_000 }).toBe(true)
        }
        // 宿主重编译会替换页面对象；每次轮询重新取当前页，避免把旧 pageId 当成白屏。
        await expect.poll(async () => {
          await syncHeadlessFullBuild()
          const page = await host.currentPage()
          const element = await page?.$('#issue-1015-page')
          if (!element) {
            return null
          }
          const style = await (element.attribute ?? element.attr).call(element, 'style') || ''
          return {
            ...(computedStyles
              ? {
                  color: await element.style('color'),
                  ...(expected.background ? { background: await element.style('background-color') } : {}),
                }
              : {}),
            variable: id === 'remove-variable' ? !style.includes('--') : style.includes(id === 'replace-variable' ? 'orange' : id === 'reactive' ? 'blue' : 'red'),
          }
        }, { timeout: 45_000 }).toEqual({
          ...(computedStyles ? { color: expected.color, ...(expected.background ? { background: expected.background } : {}) } : {}),
          variable: true,
        }).catch(async (error) => {
          try {
            await failureDiagnostics.captureFailure(`${id}-failed`, host)
          }
          catch {
            // 诊断自身的意外异常不能替换原验收失败。
          }
          throw error
        })
        await dom.check(id, host, await host.currentPage())
        const runtimeState = await diagnostics.capture(id)
        expect(runtimeState.errors).toEqual([])
        if (!publication.stateful) {
          await publication.assertClassicRuntime(host)
          const expectedMarkerMatches = issue1015ExpectedMarkerMatches(runtime, id)
          if (expectedMarkerMatches) {
            await expect.poll(() => host.evaluate((markers: { app: string, page: string }) => {
              const pages = getCurrentPages()
              return { app: (getApp() as any).__e2eHmrInstanceMarker === markers.app, page: (pages[pages.length - 1] as any).__e2eHmrInstanceMarker === markers.page }
            }, originalMarkers), { timeout: 45_000 }).toEqual(expectedMarkerMatches)
          }
        }
        await outputDiagnostics.capture(`${id}-passed`, loadedScript)
        process.stdout.write(`[issue-1015] ${runtime} ${id} passed\n`)
      }

      async function updateCss(file: string, content: string, id: string) {
        const reloadMarker = computedStyles ? await captureAppReloadMarker(host) : undefined
        const published = publication.capture(file)
        await writeFile(file, `${content}\n.issue1015-page { --issue-1015-step: ${id}; }\n`)
        await published.wait()
        await expect.poll(() => readFile(emittedCss, 'utf8'), { timeout: 45_000 }).toContain(id).catch((error) => {
          process.stdout.write(`[issue-1015-build] ${dev!.getOutput()}\n`)
          throw error
        })
        if (id === 'style-only') {
          await failureDiagnostics.captureFirstStyleOnly()
          expect(publication.stateful).toBe(false)
        }
        if (reloadMarker) {
          // 只重连原窗口；先验收自动刷新后的节点与样式，不能用导航制造新页面。
          host = observeRuntime(await reconnectAutomator(host))
          diagnostics = createHmrRuntimeDiagnostics(host as any, 'e2e-apps/github-issues/fixtures/issue-1015')
          const reloaded = await waitForAppReload(host, reloadMarker, '#issue-1015-page')
          expect(reloaded.route).toBe(ROUTE.slice(1))
        }
        await check(id)
      }

      await check('initial')
      await updateCss(cssPath, `${css}\n.issue1015-page { background-color: yellow; }`, 'style-only')
      const switchedReloadMarker = computedStyles ? await captureAppReloadMarker(host) : undefined
      const switched = publication.capture(sourcePath)
      await writeFile(alternatePath, `${css}\n.issue1015-page { background-color: pink; --issue-1015-step: source-switch; }`)
      await writeFile(sourcePath, source.replace('./index.css', './alternate.css'))
      await switched.wait()
      if (switchedReloadMarker) {
        host = observeRuntime(await reconnectAutomator(host))
        diagnostics = createHmrRuntimeDiagnostics(host as any, 'e2e-apps/github-issues/fixtures/issue-1015')
        const reloaded = await waitForAppReload(host, switchedReloadMarker, '#issue-1015-page')
        expect(reloaded.route).toBe(ROUTE.slice(1))
      }
      await expect.poll(() => readFile(emittedCss, 'utf8'), { timeout: 45_000 }).toContain('source-switch')
      await check('source-switch')
      expect(publication.stateful).toBe(false)
      await updateCss(alternatePath, '.issue1015-page { color: v-bind(accentColor); }', 'replace-variable')
      await updateCss(alternatePath, '.issue1015-page { color: black; }', 'remove-variable')
      await updateCss(alternatePath, '.issue1015-page { color: v-bind(themeColor); }', 'restore-variable')
      // HMR 后 AppService 的路由对象可能仍绑定旧 setup 闭包；响应式验收必须调用
      // 当前原生页面并关闭 fallback，避免把旧实例的结果误判为运行时未更新。
      const nativePage = await host.currentPage({ appFunctionFallback: false })
      await nativePage!.callMethodWithOptions('_runE2E', { fallback: false }, 'mutate')
      await check('reactive')
      if (runtime === 'classic') {
        await checkIssue1015SharedStyleHmr({
          project,
          computedStyles,
          dom,
          publication,
          getHost: () => host,
          replaceHost: (next) => {
            host = observeRuntime(next)
            diagnostics = createHmrRuntimeDiagnostics(host as any, 'e2e-apps/github-issues/fixtures/issue-1015')
          },
          syncHeadlessFullBuild,
          captureRuntime: id => diagnostics.capture(id),
          captureOutput: id => outputDiagnostics.capture(id, loadedScript),
        })
      }
      if (runtimeErrors.length) {
        process.stdout.write(`[issue-1015-build] ${dev!.getOutput()}\n`)
      }
      expect(runtimeErrors).toEqual([])
      await publication.assertClassicOutput()
      expect(dev!.getBuildErrors()).toEqual([])
    }, 300_000)
  })
}
