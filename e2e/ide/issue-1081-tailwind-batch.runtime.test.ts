import type { HeadlessSession } from '../../mpcore/packages/simulator/src'
import { Buffer } from 'node:buffer'
import { readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { PassThrough } from 'node:stream'
import { pathToFileURL } from 'node:url'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE } from '@weapp-core/constants'
import postcss from 'postcss'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator, reconnectAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDevBuildCompletion } from '../utils/devBuildCompletion'
import { createDomAcceptance } from '../utils/domAcceptance'
import { readEmittedStylesheet } from '../utils/emittedStylesheet'
import { renameAtomicFile } from '../utils/hmrAtomicRename'
import { createHmrRuntimeDiagnostics } from '../utils/hmrRuntimeDiagnostics'
import { createIssue1081Project, ISSUE_1081_CLI } from '../utils/issue1081Project'
import { NATIVE_BATCH_SETTLEMENT_PREFIX } from '../utils/nativeBatchSettlementPlugin'
import { createNativeHmrPublication } from '../utils/nativeHmrPublication'
import { addNativePublicationPlugin } from '../utils/nativePublication/fixture'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { installStatefulHmrTransport } from '../utils/statefulHmrTransport'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'

const route = '/pages/index/index'
const fixture = 'e2e-apps/github-issues/fixtures/issue-1081'

describe('issue #1081: Tailwind batch delivery', { concurrent: false }, () => {
  let disposeTransport: (() => void) | undefined
  let project: string
  let dev: ReturnType<typeof startDevProcess> | undefined
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let headlessRuntime: HeadlessSession | undefined
  let publication: ReturnType<typeof createNativeHmrPublication>
  const settlementInput = new PassThrough()

  function openRuntime(stateful = true) {
    return launchAutomator({
      configureHeadlessSession(session) {
        headlessRuntime = session
        if (stateful) {
          disposeTransport = installStatefulHmrTransport(session, path.join(project, 'dist'))
        }
      },
      projectPath: project,
      bridgeProjectMode: 'direct',
      warmupRoute: route,
      warmupRootSelectors: ['#issue-1081-utility'],
    })
  }

  async function observeClassicRuntime() {
    if (resolveRuntimeProviderName() !== 'headless') {
      // 只重连原 owner；任何导航前观察 IDE 自动重载后的页面。
      miniProgram = await reconnectAutomator(miniProgram!)
      return miniProgram
    }
    const previous = miniProgram!
    const previousRuntime = headlessRuntime!
    await expect.poll(() => previous.evaluate((key: string) => {
      const globals = globalThis as any
      return [globals[key], globals.wx?.[key]].every(client => !client || client.getTransportState?.().phase === 'stopped')
    }, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY), { timeout: 30_000 }).toBe(true)
    disposeTransport?.()
    disposeTransport = undefined
    await previous.close()
    expect(previousRuntime.isClosed).toBe(true)
    await expect(previous.currentPage()).rejects.toThrow(/closed/i)
    // 新 VM 仅作 classic 产物 companion，不替代真实 IDE 自动重载证据。
    miniProgram = await openRuntime(false)
    return miniProgram
  }

  function capturePublication(file: string) {
    return createDevBuildCompletion(dev!, {
      snapshot: {
        files: [file],
        profilePath: path.join(project, '.weapp-vite/hmr-profile.jsonl'),
        requestSettlement: (id) => {
          settlementInput.write(`${NATIVE_BATCH_SETTLEMENT_PREFIX}${JSON.stringify({ id })}\n`)
        },
      },
    })
  }

  beforeAll(async () => {
    project = await createIssue1081Project()
    const config = path.join(project, 'weapp-vite.config.mjs')
    const plugin = pathToFileURL(path.resolve(import.meta.dirname, '../utils/nativeBatchSettlementPlugin.ts')).href
    await writeFile(config, `import { nativeBatchSettlementPlugin } from ${JSON.stringify(plugin)}\n${(await readFile(config, 'utf8')).replace('export default {', 'export default {\n  plugins: [nativeBatchSettlementPlugin()],')}`)
    await addNativePublicationPlugin(config)
    dev = startDevProcess(process.execPath, [ISSUE_1081_CLI, 'dev', '--non-interactive'], {
      cwd: project,
      env: { ...createDevProcessEnv(), WEAPP_VITE_HMR_PROFILE_JSON: path.join(project, '.weapp-vite/hmr-profile.jsonl') },
      input: settlementInput,
      reject: false,
      stderr: 'inherit',
    })
    publication = createNativeHmrPublication(project, dev, 'stateful-experimental', ['stylesheet-output'], path.join(project, '.weapp-vite/hmr-profile.jsonl'))
    await dev.waitForInitialBuild()
    for (const extension of ['js', 'json', 'wxml', 'wxss']) {
      expect(await readFile(path.join(project, `dist/pages/index/index.${extension}`), 'utf8')).not.toBe('')
    }
    miniProgram = await openRuntime()
  }, 180_000)

  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      project,
      disposeTransport,
      closeSession: async () => { await miniProgram?.close() },
      stopDev: async () => {
        try {
          await dev?.stop()
        }
        finally {
          settlementInput.end()
        }
      },
    })
  }, 60_000)

  it('retains script state before stylesheet changes and keeps subsequent utilities on classic', async (context) => {
    context.onTestFailed(() => {
      process.stdout.write(dev?.getOutput().slice(-12000) ?? '')
    })
    let host = miniProgram!
    const page = await host.reLaunch(route)
    let diagnostics = createHmrRuntimeDiagnostics(host as any, fixture)
    await expect.poll(() => host.evaluate(() => (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__.getTransportState().initialReady), { timeout: 30_000 }).toBe(true)
    let identity = await diagnostics.initialize()
    await (await page.$('#increment'))!.tap()
    const source = path.join(project, 'src/pages/index/index.vue')
    const pending = path.join(path.dirname(source), `.${path.basename(source)}.tmp`)
    let code = await readFile(source, 'utf8')
    const colors = ['#fce7f3', '#dbeafe', '#dcfce7']
    const computed = ['rgb(252, 231, 243)', 'rgb(219, 234, 254)', 'rgb(220, 252, 231)']
    const checkpoints = [
      { id: colors[0]!, background: computed[0]!, count: '1' },
      { id: 'script-only', background: computed[0]!, count: '3' },
      ...colors.slice(1).map((color, index) => ({ id: color, background: computed[index + 1]!, count: '2' })),
      ...['utility-removed', 'theme-updated', 'source-removed', 'source-added'].map(id => ({ id, background: computed[2]!, count: '2' })),
    ]
    const acceptance = createDomAcceptance(context, fixture, checkpoints.map(checkpoint => ({
      id: checkpoint.id,
      route,
      action: '确认脚本状态保持或 classic 重载后的批次样式与新交互',
      nodes: [
        { selector: '#issue-1081-utility', text: 'batch utility', ...(resolveRuntimeProviderName() === 'devtools' ? { styles: { 'background-color': checkpoint.background } } : {}) },
        { selector: '#increment', text: checkpoint.count },
      ],
    })))
    await acceptance.check('#fce7f3', host, await host.currentPage())

    // 首个样式变化前固定 stateful 的纯脚本、sourcemap 和未改写样式契约。
    const stylesheet = path.join(project, 'dist/weapp-vite-global.wxss')
    expect(await readFile(stylesheet, 'utf8')).toContain('19px')
    const stableStyle = await stat(stylesheet)
    const version = await host.evaluate(() => (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__.getVersion())
    const scriptPublication = capturePublication(source)
    code = code.replace('count.value += 1', 'count.value += 2')
    await writeFile(pending, code)
    await renameAtomicFile(pending, source)
    await scriptPublication.wait()
    await expect.poll(() => host.evaluate(() => (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__.getVersion()), { timeout: 30_000 }).toBeGreaterThan(version)
    expect((await stat(stylesheet)).mtimeMs).toBe(stableStyle.mtimeMs)
    await (await (await host.currentPage()).$('#increment'))!.tap()
    await acceptance.check('script-only', host, await host.currentPage())
    const retained = await diagnostics.capture('script-only')
    expect(retained.pageId).toBe(identity.pageId)
    expect(retained.runtime).toMatchObject({ pageMarkerRetained: true, appMarkerRetained: true })
    expect(retained.errors).toEqual([])
    const update = await readFile(path.join(project, 'dist', WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE), 'utf8')
    const encodedMap = /sourceMappingURL=data:application\/json;charset=utf-8;base64,(\S+)/.exec(update)?.[1]
    expect(encodedMap).toBeTruthy()
    const map = JSON.parse(Buffer.from(encodedMap!, 'base64').toString('utf8')) as { sources: string[], sourcesContent: Array<string | null>, mappings: string }
    expect(map.sources.length).toBeGreaterThan(0)
    expect(map.sourcesContent.some(source => source?.includes('count'))).toBe(true)
    expect(map.mappings).not.toBe('')

    async function observeReload(label: string) {
      const previousId = identity.pageId
      host = await observeClassicRuntime()
      diagnostics = createHmrRuntimeDiagnostics(host as any, fixture)
      await expect.poll(async () => {
        const observed = await diagnostics.capture(label)
        const markers = await host.evaluate(() => {
          const pages = getCurrentPages()
          return { app: (getApp() as any)?.__e2eHmrInstanceMarker ?? null, page: (pages[pages.length - 1] as any)?.__e2eHmrInstanceMarker ?? null }
        })
        return { ...markers, replaced: observed.pageId !== previousId, errors: observed.errors, runtime: observed.runtime }
      }, { timeout: 45_000 }).toMatchObject({
        app: null,
        page: null,
        replaced: true,
        errors: [],
        runtime: { route: route.slice(1), clientPresent: false, bridgeReady: false, controlPresent: false, transportPhase: null },
      })
      await expect.poll(async () => (await (await host.currentPage()).$('#increment'))!.text()).toBe('0')
      await publication.assertClassicRuntime(host)
      identity = await diagnostics.initialize()
      await (await (await host.currentPage()).$('#increment'))!.tap()
      await expect.poll(async () => (await (await host.currentPage()).$('#increment'))!.text()).toBe('2')
    }

    let previous = '#fce7f3'
    for (const color of colors.slice(1)) {
      const published = publication.capture(source)
      code = code.replaceAll(previous, color)
      await writeFile(pending, code)
      await renameAtomicFile(pending, source)
      await published.wait()
      await expect.poll(() => readEmittedStylesheet(path.join(project, 'dist/app.wxss')), { timeout: 45_000 }).toContain(color)
      await observeReload(color)
      await expect.poll(async () => {
        const node = (await (await host.currentPage()).$('#issue-1081-utility'))!
        return (node.attribute ?? node.attr).call(node, 'class')
      }, { timeout: 30_000 }).toContain(color.slice(1))
      const emittedCss = await readEmittedStylesheet(path.join(project, 'dist/app.wxss'))
      const selectors: string[] = []
      postcss.parse(emittedCss).walkDecls('background-color', (declaration) => {
        if (declaration.value === color && declaration.parent?.type === 'rule') {
          selectors.push(declaration.parent.selector.slice(1))
        }
      })
      const utilityNode = (await (await host.currentPage()).$('#issue-1081-utility'))!
      const runtimeClasses = await (utilityNode.attribute ?? utilityNode.attr).call(utilityNode, 'class')
      expect(selectors.some(selector => runtimeClasses.split(/\s+/).includes(selector)), runtimeClasses).toBe(true)
      await acceptance.check(color, host, await host.currentPage())
      previous = color
    }
    const removedUtility = publication.capture(source)
    code = code.replace('py-5.5 ', '')
    await writeFile(pending, code)
    await renameAtomicFile(pending, source)
    await removedUtility.wait()
    await expect.poll(() => readEmittedStylesheet(path.join(project, 'dist/app.wxss')), { timeout: 45_000 }).not.toMatch(/\.py-5/)
    await observeReload('utility-removed')
    await acceptance.check('utility-removed', host, await host.currentPage())
    const theme = path.join(project, 'src/app.css')
    const themePublication = publication.capture(theme)
    await writeFile(theme, (await readFile(theme, 'utf8')).replace('#112234', '#445567'))
    await themePublication.wait()
    await expect.poll(() => readFile(stylesheet, 'utf8'), { timeout: 45_000 }).toContain('#445567')
    await observeReload('theme-updated')
    await acceptance.check('theme-updated', host, await host.currentPage())
    const sharedSource = path.join(project, 'src/shared.ts')
    const removedSource = publication.capture(sharedSource)
    await rm(sharedSource)
    await removedSource.wait()
    await expect.poll(() => readFile(stylesheet, 'utf8'), { timeout: 45_000 }).not.toContain('19px')
    await observeReload('source-removed')
    await acceptance.check('source-removed', host, await host.currentPage())
    const newSource = path.join(project, 'src/new-source.ts')
    const stylePublication = publication.capture(newSource)
    await writeFile(newSource, 'export const utility = \'h-[23px]\'\n')
    await expect.poll(() => readFile(stylesheet, 'utf8'), { timeout: 45_000 }).toContain('23px')
    await stylePublication.wait()
    await observeReload('source-added')
    await acceptance.check('source-added', host, await host.currentPage())
    await publication.assertClassicOutput()
    expect(dev!.getOutput()).not.toMatch(/delivery failed|patch transform failed/)
  }, 180_000)
})
