import type { HeadlessSession } from '../../mpcore/packages/simulator/src'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE } from '@weapp-core/constants'
import postcss from 'postcss'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator, reconnectAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDevBuildCompletion } from '../utils/devBuildCompletion'
import { createDomAcceptance } from '../utils/domAcceptance'
import { readEmittedStylesheet } from '../utils/emittedStylesheet'
import { waitForFileRemoved } from '../utils/hmr-helpers'
import { renameAtomicFile } from '../utils/hmrAtomicRename'
import { createHmrRuntimeDiagnostics } from '../utils/hmrRuntimeDiagnostics'
import { createIssue1081Project, ISSUE_1081_CLI } from '../utils/issue1081Project'
import { readIssue1081SnapshotRuntime } from '../utils/issue1081SnapshotRuntime'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { installStatefulHmrTransport } from '../utils/statefulHmrTransport'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'

const route = '/pages/index/index'
const fixture = 'e2e-apps/github-issues/fixtures/issue-1081-snapshot'

describe('issue #1081: Tailwind snapshot generation', { concurrent: false }, () => {
  let project: string | undefined
  let profilePath: string
  let dev: ReturnType<typeof startDevProcess> | undefined
  let host: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let headlessRuntime: HeadlessSession | undefined
  let disposeTransport: (() => void) | undefined

  const output = (file: string) => path.join(project!, 'dist', file)
  const source = (file: string) => path.join(project!, 'src', file)
  function openRuntime(stateful = true) {
    return launchAutomator({
      projectPath: project!,
      bridgeProjectMode: 'direct',
      warmupRoute: route,
      warmupRootSelectors: ['#script-utility'],
      configureHeadlessSession(session) {
        headlessRuntime = session
        if (stateful) {
          disposeTransport = installStatefulHmrTransport(session, path.join(project!, 'dist'))
        }
      },
    })
  }

  async function observeClassicRuntime() {
    if (resolveRuntimeProviderName() !== 'headless') {
      // 只重连既有受管窗口；自动重载证据必须先于任何导航和后续交互。
      host = await reconnectAutomator(host!)
      return
    }
    const previous = host!
    const previousRuntime = headlessRuntime!
    // companion 仅验证新 classic 产物；旧容器与 transport 必须终结，不替代真实 IDE 自动重载证据。
    disposeTransport?.()
    disposeTransport = undefined
    await previous.close()
    expect(previousRuntime.isClosed).toBe(true)
    await expect(previous.currentPage()).rejects.toThrow(/closed/i)
    host = undefined
    headlessRuntime = undefined
    host = await openRuntime(false)
  }

  async function save(file: string, code: string) {
    await writeFile(`${file}.tmp`, code)
    await renameAtomicFile(`${file}.tmp`, file)
  }

  async function backgroundClasses(color: string) {
    const classes: string[] = []
    postcss.parse(await readEmittedStylesheet(output('app.wxss'))).walkDecls('background-color', (declaration) => {
      if (declaration.value === color && declaration.parent?.type === 'rule') {
        classes.push(...postcss.list.comma(declaration.parent.selector).filter(selector => selector.startsWith('.')).map(selector => selector.slice(1)))
      }
    })
    return classes
  }

  beforeAll(async () => {
    project = await createIssue1081Project('issue-1081-snapshot')
    profilePath = path.join(project, 'hmr-profile.jsonl')
    dev = startDevProcess(process.execPath, [ISSUE_1081_CLI, 'dev', '--non-interactive'], {
      cwd: project,
      env: { ...createDevProcessEnv(), WEAPP_VITE_HMR_PROFILE_JSON: profilePath },
      all: true,
    })
    await dev.waitForInitialBuild()
    for (const file of ['app.js', 'app.json', 'app.wxss', 'pages/index/index.js', 'pages/index/index.json', 'pages/index/index.wxml', 'pages/index/index.wxss']) {
      expect(await readFile(output(file), 'utf8')).not.toBe('')
    }
    host = await openRuntime()
  }, 180_000)

  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      project,
      disposeTransport,
      closeSession: async () => { await host?.close() },
      stopDev: async () => { await dev?.stop() },
    })
  }, 60_000)

  it('falls back on config changes and keeps later script utilities functional in sticky classic', async (context) => {
    context.onTestFailed(() => {
      process.stdout.write(dev?.getOutput().slice(-16_000) ?? '')
    })
    const page = await host!.reLaunch(route)
    await expect.poll(() => host!.evaluate((key: string) => (globalThis as any)[key].getTransportState().initialReady, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY), { timeout: 30_000 }).toBe(true)
    let diagnostics = createHmrRuntimeDiagnostics(host! as any, fixture)
    let identity = await diagnostics.initialize()
    expect(identity.errors).toEqual([])
    expect(identity.pageId).not.toBeNull()
    const configFile = source('app.json')
    const scriptFile = source('pages/index/index.js')
    const config = await readFile(configFile, 'utf8')
    const script = await readFile(scriptFile, 'utf8')
    const control = await readFile(output(WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE), 'utf8')
    const checkpoints = [
      { id: 'initial', marker: 'SNAPSHOT_BASE', count: '1', color: '#fce7f3', computed: 'rgb(252, 231, 243)' },
      { id: 'config-edited', marker: 'SNAPSHOT_BASE', count: '0', color: '#fce7f3', computed: 'rgb(252, 231, 243)' },
      { id: 'config-restored', marker: 'SNAPSHOT_BASE', count: '0', color: '#fce7f3', computed: 'rgb(252, 231, 243)' },
      { id: 'patch-baseline', marker: 'SNAPSHOT_BASE', count: '1', color: '#fce7f3', computed: 'rgb(252, 231, 243)' },
      { id: 'utility-patched', marker: 'SNAPSHOT_UPDATED', count: '2', color: '#dbeafe', computed: 'rgb(219, 234, 254)' },
      { id: 'utility-restored', marker: 'SNAPSHOT_BASE', count: '1', color: '#fce7f3', computed: 'rgb(252, 231, 243)' },
    ]
    const acceptance = createDomAcceptance(context, fixture, checkpoints.map(checkpoint => ({
      id: checkpoint.id,
      route,
      action: '检查配置回退边界、同批产物、计算样式与 classic 重载后的交互',
      nodes: [
        { selector: '#template-utility', text: 'fixed utility', ...(resolveRuntimeProviderName() === 'devtools' ? { styles: { 'background-color': 'rgb(252, 231, 243)' } } : {}) },
        { selector: '#script-utility', text: checkpoint.marker, ...(resolveRuntimeProviderName() === 'devtools' ? { styles: { 'background-color': checkpoint.computed } } : {}) },
        { selector: '#increment', text: checkpoint.count },
      ],
    })))

    async function checkIdentity(label: string, stateful = false) {
      const observed = await diagnostics.capture(label)
      expect(observed.errors).toEqual([])
      expect(observed.pageId).toBe(identity.pageId)
      expect(observed.runtime).toMatchObject({ pageMarkerRetained: true, appMarkerRetained: true })
      if (stateful) {
        expect(await readFile(output(WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE), 'utf8')).toBe(control)
      }
      else {
        expect(observed.runtime).toMatchObject({ clientPresent: false, bridgeReady: false, controlPresent: false, transportPhase: null })
        for (const file of [WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE]) {
          await waitForFileRemoved(output(file))
        }
      }
    }

    async function checkSnapshot() {
      const [classes, template, javascript] = await Promise.all([
        backgroundClasses('#fce7f3'),
        readFile(output('pages/index/index.wxml'), 'utf8'),
        readFile(output('pages/index/index.js'), 'utf8'),
      ])
      expect(classes.length).toBeGreaterThan(0)
      expect(classes.some(name => template.includes(name) && javascript.includes(name))).toBe(true)
      expect(javascript).toContain('SNAPSHOT_BASE')
      expect(template).toContain('fixed utility')
      const node = (await (await host!.currentPage()).$('#script-utility'))!
      const renderedClasses = await (node.attribute ?? node.attr).call(node, 'class')
      expect(classes.some(name => renderedClasses.split(/\s+/).includes(name))).toBe(true)
    }

    try {
      await (await page.$('#increment'))!.tap()
      await acceptance.check('initial', host!, await host!.currentPage())
      await checkSnapshot()
      await checkIdentity('initial', true)
      expect(await readIssue1081SnapshotRuntime(host!, headlessRuntime)).toMatchObject({
        appPresent: true,
        pageId: identity.pageId,
        path: route.slice(1),
        pageStable: true,
        title: 'SNAPSHOT_BASE',
        titleStable: true,
        count: 1,
        transportReady: true,
        clientPresent: true,
        bridgePresent: true,
        controlPresent: true,
        transportPhase: 'polling',
      })
      // JSON 首次回退后保持 classic；新 App/Page 和实际标题必须在任何后续交互前就绪。
      for (const [id, title, code] of [
        ['config-edited', 'SNAPSHOT_CONFIG', config.replace('SNAPSHOT_BASE', 'SNAPSHOT_CONFIG')],
        ['config-restored', 'SNAPSHOT_BASE', config],
      ] as const) {
        let configIdentity: Awaited<ReturnType<typeof readIssue1081SnapshotRuntime>> | undefined
        await acceptance.act(id, async () => {
          const publication = createDevBuildCompletion(dev!, id === 'config-edited'
            ? { completed: '[weapp-vite] HMR classic ready ' }
            : { source: { file: configFile, profilePath } })
          await save(configFile, code)
          await publication.wait()
          await expect.poll(async () => JSON.parse(await readFile(output('app.json'), 'utf8')) as unknown, { timeout: 30_000 }).toMatchObject({
            pages: ['pages/index/index'],
            window: { navigationBarTitleText: title },
          })
          await observeClassicRuntime()
          await expect.poll(async () => {
            configIdentity = await readIssue1081SnapshotRuntime(host!, headlessRuntime)
            return { ...configIdentity, pageReplaced: configIdentity.pageId !== identity.pageId }
          }, { timeout: 30_000 }).toMatchObject({
            appPresent: true,
            appMarker: null,
            pageMarker: null,
            pageCount: 1,
            route: route.slice(1),
            path: route.slice(1),
            count: 0,
            marker: 'SNAPSHOT_BASE',
            pageReplaced: true,
            pageStable: true,
            title,
            titleStable: true,
            transportReady: false,
            clientPresent: false,
            bridgePresent: false,
            controlPresent: false,
            transportPhase: null,
          })
          await checkSnapshot()
          for (const file of [WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE]) {
            await waitForFileRemoved(output(file))
          }
        })
        await acceptance.check(id, host!, await host!.currentPage())
        diagnostics = createHmrRuntimeDiagnostics(host! as any, fixture)
        identity = await diagnostics.initialize()
        expect(identity.errors).toEqual([])
        expect(identity.pageId).toBe(configIdentity!.pageId)
      }
      await acceptance.act('patch-baseline', async () => {
        await (await (await host!.currentPage()).$('#increment'))!.tap()
        await checkIdentity('patch-baseline')
      })
      await acceptance.check('patch-baseline', host!, await host!.currentPage())
      // classic 每次保存先重置页面，再用真实点击验证新 utility 闭包和事件步长。
      for (const [id, code, color, marker] of [
        ['utility-patched', script.replace('#fce7f3', '#dbeafe').replace('SNAPSHOT_BASE', 'SNAPSHOT_UPDATED').replace('this.data.count + 1', 'this.data.count + 2'), '#dbeafe', 'SNAPSHOT_UPDATED'],
        ['utility-restored', script, '#fce7f3', 'SNAPSHOT_BASE'],
      ] as const) {
        await acceptance.act(id, async () => {
          const publication = createDevBuildCompletion(dev!, { source: { file: scriptFile, profilePath } })
          await save(scriptFile, code)
          await publication.wait()
          await observeClassicRuntime()
          await expect.poll(async () => {
            const current = await readIssue1081SnapshotRuntime(host!, headlessRuntime)
            return { ...current, pageReplaced: current.pageId !== identity.pageId }
          }, { timeout: 30_000 }).toMatchObject({
            appPresent: true,
            appMarker: null,
            pageMarker: null,
            pageCount: 1,
            route: route.slice(1),
            path: route.slice(1),
            pageStable: true,
            pageReplaced: true,
            title: 'SNAPSHOT_BASE',
            titleStable: true,
            marker,
            count: 0,
            clientPresent: false,
            bridgePresent: false,
            controlPresent: false,
            transportPhase: null,
          })
          diagnostics = createHmrRuntimeDiagnostics(host! as any, fixture)
          identity = await diagnostics.initialize()
          expect(identity.errors).toEqual([])
          await (await (await host!.currentPage()).$('#increment'))!.tap()
          const classes = await backgroundClasses(color)
          expect(classes.length).toBeGreaterThan(0)
          const javascript = await readFile(output('pages/index/index.js'), 'utf8')
          expect(javascript).toContain(marker)
          const node = (await (await host!.currentPage()).$('#script-utility'))!
          const renderedClasses = await (node.attribute ?? node.attr).call(node, 'class')
          expect(classes.some(name => renderedClasses.split(/\s+/).includes(name) && javascript.includes(name))).toBe(true)
          const template = await readFile(output('pages/index/index.wxml'), 'utf8')
          expect((await backgroundClasses('#fce7f3')).some(name => template.includes(name))).toBe(true)
          if (id === 'utility-restored') {
            expect(await backgroundClasses('#dbeafe')).toEqual([])
          }
          await checkIdentity(id)
        })
        await acceptance.check(id, host!, await host!.currentPage())
      }
      expect(dev!.getOutput().match(/\[weapp-vite\] HMR fallback /g)).toHaveLength(1)
      expect(dev!.getOutput()).toContain('"reason":"config-json"')
      expect(dev!.getOutput()).not.toMatch(/Build failed|delivery failed|patch transform failed/)
    }
    finally {
      // 仅恢复本轮临时 fixture；失败后不重新导航、重连或追加保存重试。
      for (const [file, code] of [[configFile, config], [scriptFile, script]] as const) {
        if (await readFile(file, 'utf8') !== code) {
          await save(file, code)
        }
      }
    }
  }, 180_000)
})
