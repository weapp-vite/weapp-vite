import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE } from '@weapp-core/constants'
import postcss from 'postcss'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { readEmittedStylesheet } from '../utils/emittedStylesheet'
import { renameAtomicFile } from '../utils/hmrAtomicRename'
import { createHmrRuntimeDiagnostics } from '../utils/hmrRuntimeDiagnostics'
import { createIssue1081Project, ISSUE_1081_CLI } from '../utils/issue1081Project'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { installStatefulHmrTransport } from '../utils/statefulHmrTransport'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'

const route = '/pages/index/index'
const fixture = 'e2e-apps/github-issues/fixtures/issue-1081-snapshot'

describe('issue #1081: Tailwind snapshot generation', { concurrent: false }, () => {
  let project: string | undefined
  let dev: ReturnType<typeof startDevProcess> | undefined
  let host: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let disposeTransport: (() => void) | undefined

  const output = (file: string) => path.join(project!, 'dist', file)
  const source = (file: string) => path.join(project!, 'src', file)
  const version = () => host!.evaluate((key: string) => (globalThis as any)[key].getVersion(), WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)

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
    dev = startDevProcess(process.execPath, [ISSUE_1081_CLI, 'dev', '--non-interactive'], {
      cwd: project,
      env: createDevProcessEnv(),
      all: true,
    })
    await dev.waitForInitialBuild()
    for (const file of ['app.js', 'app.json', 'app.wxss', 'pages/index/index.js', 'pages/index/index.json', 'pages/index/index.wxml', 'pages/index/index.wxss']) {
      expect(await readFile(output(file), 'utf8')).not.toBe('')
    }
    host = await launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      warmupRoute: route,
      warmupRootSelectors: ['#script-utility'],
      configureHeadlessSession(session) {
        disposeTransport = installStatefulHmrTransport(session, path.join(project!, 'dist'))
      },
    })
  }, 180_000)

  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      project,
      disposeTransport,
      closeSession: async () => { await host?.close() },
      stopDev: async () => { await dev?.stop() },
    })
  }, 60_000)

  it('keeps assets and page state consistent across config edit and restoration before later script utility patches', async (context) => {
    context.onTestFailed(() => {
      process.stdout.write(dev?.getOutput().slice(-16_000) ?? '')
    })
    const session = host!
    const page = await session.reLaunch(route)
    await expect.poll(() => session.evaluate((key: string) => (globalThis as any)[key].getTransportState().initialReady, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY), { timeout: 30_000 }).toBe(true)
    const diagnostics = createHmrRuntimeDiagnostics(session as any, fixture)
    const identity = await diagnostics.initialize()
    expect(identity.errors).toEqual([])
    expect(identity.pageId).not.toBeNull()
    const configFile = source('app.json')
    const scriptFile = source('pages/index/index.js')
    const config = await readFile(configFile, 'utf8')
    const script = await readFile(scriptFile, 'utf8')
    const control = await readFile(output(WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE), 'utf8')
    const checkpoints = [
      { id: 'initial', marker: 'SNAPSHOT_BASE', count: '1', color: '#fce7f3', computed: 'rgb(252, 231, 243)' },
      { id: 'config-edited', marker: 'SNAPSHOT_BASE', count: '1', color: '#fce7f3', computed: 'rgb(252, 231, 243)' },
      { id: 'config-restored', marker: 'SNAPSHOT_BASE', count: '1', color: '#fce7f3', computed: 'rgb(252, 231, 243)' },
      { id: 'utility-patched', marker: 'SNAPSHOT_UPDATED', count: '3', color: '#dbeafe', computed: 'rgb(219, 234, 254)' },
      { id: 'utility-restored', marker: 'SNAPSHOT_BASE', count: '4', color: '#fce7f3', computed: 'rgb(252, 231, 243)' },
    ]
    const acceptance = createDomAcceptance(context, fixture, checkpoints.map(checkpoint => ({
      id: checkpoint.id,
      route,
      action: '检查同批产物、模板绑定、计算样式和保留的页面交互状态',
      nodes: [
        { selector: '#template-utility', text: 'fixed utility', ...(resolveRuntimeProviderName() === 'devtools' ? { styles: { 'background-color': 'rgb(252, 231, 243)' } } : {}) },
        { selector: '#script-utility', text: checkpoint.marker, ...(resolveRuntimeProviderName() === 'devtools' ? { styles: { 'background-color': checkpoint.computed } } : {}) },
        { selector: '#increment', text: checkpoint.count },
      ],
    })))

    async function checkIdentity(label: string) {
      const observed = await diagnostics.capture(label)
      expect(observed.errors).toEqual([])
      expect(observed.pageId).toBe(identity.pageId)
      expect(observed.runtime).toMatchObject({ pageMarkerRetained: true, appMarkerRetained: true })
      expect(await readFile(output(WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE), 'utf8')).toBe(control)
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
      const node = (await (await session.currentPage()).$('#script-utility'))!
      const renderedClasses = await (node.attribute ?? node.attr).call(node, 'class')
      expect(classes.some(name => renderedClasses.split(/\s+/).includes(name))).toBe(true)
    }

    try {
      await (await page.$('#increment'))!.tap()
      await acceptance.check('initial', session, await session.currentPage())
      await checkSnapshot()
      await checkIdentity('initial')
      // 先完成无脚本欠账的配置快照；它不发布 delta，不能用版本增长当作就绪条件。
      for (const [id, title, code] of [
        ['config-edited', 'SNAPSHOT_CONFIG', config.replace('SNAPSHOT_BASE', 'SNAPSHOT_CONFIG')],
        ['config-restored', 'SNAPSHOT_BASE', config],
      ] as const) {
        await acceptance.act(id, async () => {
          await save(configFile, code)
          await expect.poll(async () => JSON.parse(await readFile(output('app.json'), 'utf8')) as unknown, { timeout: 30_000 }).toMatchObject({
            pages: ['pages/index/index'],
            window: { navigationBarTitleText: title },
          })
          await checkSnapshot()
          await checkIdentity(id)
        })
        await acceptance.check(id, session, await session.currentPage())
      }
      // 原生补丁保留 data；通过新方法的 setData 验证新 utility 闭包和旧 count 同时成立。
      for (const [id, code, color, marker] of [
        ['utility-patched', script.replace('#fce7f3', '#dbeafe').replace('SNAPSHOT_BASE', 'SNAPSHOT_UPDATED').replace('this.data.count + 1', 'this.data.count + 2'), '#dbeafe', 'SNAPSHOT_UPDATED'],
        ['utility-restored', script, '#fce7f3', 'SNAPSHOT_BASE'],
      ] as const) {
        await acceptance.act(id, async () => {
          const previous = await version()
          await save(scriptFile, code)
          await expect.poll(version, { timeout: 30_000 }).toBeGreaterThan(previous)
          await (await (await session.currentPage()).$('#increment'))!.tap()
          const classes = await backgroundClasses(color)
          expect(classes.length).toBeGreaterThan(0)
          const update = await readFile(output(WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE), 'utf8')
          expect(update).toContain(marker)
          const node = (await (await session.currentPage()).$('#script-utility'))!
          const renderedClasses = await (node.attribute ?? node.attr).call(node, 'class')
          expect(classes.some(name => renderedClasses.split(/\s+/).includes(name) && update.includes(name))).toBe(true)
          if (id === 'utility-restored') {
            expect(await backgroundClasses('#dbeafe')).toEqual([])
          }
          await checkIdentity(id)
        })
        await acceptance.check(id, session, await session.currentPage())
      }
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
