import { access, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY } from '@weapp-core/constants'
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

const route = '/pages/index/index'
const fixture = 'e2e-apps/github-issues/fixtures/issue-1081-transaction'

describe('issue #1081: delayed compiler transaction', () => {
  let project: string
  let dev: ReturnType<typeof startDevProcess> | undefined
  let host: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let disposeTransport: (() => void) | undefined
  beforeAll(async () => {
    project = await createIssue1081Project('issue-1081-transaction')
    dev = startDevProcess(process.execPath, [ISSUE_1081_CLI, 'dev', '--non-interactive'], {
      cwd: project,
      env: { ...createDevProcessEnv(), WEAPP_VITE_STATEFUL_HMR_SNAPSHOT_TRACE: '1' },
      reject: false,
    })
    await dev.waitForInitialBuild()
    for (const extension of ['js', 'json', 'wxml', 'wxss']) {
      expect(await readFile(path.join(project, `dist/pages/index/index.${extension}`), 'utf8')).not.toBe('')
    }
    host = await launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      configureHeadlessSession(session) {
        disposeTransport = installStatefulHmrTransport(session, path.join(project, 'dist'))
      },
      warmupRoute: route,
      warmupRootSelectors: ['#issue-1081-utility'],
    })
  }, 180_000)
  afterAll(async () => {
    disposeTransport?.()
    await host?.close()
    await dev?.stop()
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  }, 60_000)

  it('keeps the committed DOM while compilation is held and applies the newest source with CSS Modules', async (context) => {
    context.onTestFailed(() => process.stdout.write(dev!.getOutput()))
    const session = host!
    const page = await session.reLaunch(route)
    const diagnostics = createHmrRuntimeDiagnostics(session as any, fixture)
    const original = await diagnostics.initialize()
    const version = () => session.evaluate(key => (globalThis as any)[key].getVersion(), WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)
    await expect.poll(() => session.evaluate(key => (globalThis as any)[key].getTransportState().initialReady, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)).toBe(true)
    await (await page.$('#increment'))!.tap()
    const realStyles = resolveRuntimeProviderName() === 'devtools'
    const states = [
      { id: 'initial', label: 'initial', background: 'rgb(252, 231, 243)', color: 'rgb(17, 34, 51)' },
      { id: 'held', label: 'initial', background: 'rgb(252, 231, 243)', color: 'rgb(17, 34, 51)' },
      { id: 'latest', label: 'latest', background: 'rgb(220, 252, 231)', color: 'rgb(17, 34, 51)' },
      { id: 'modules', label: 'latest', background: 'rgb(220, 252, 231)', color: 'rgb(68, 85, 102)' },
      { id: 'failed', label: 'latest', background: 'rgb(220, 252, 231)', color: 'rgb(68, 85, 102)' },
      { id: 'recovered', label: 'recovered', background: 'rgb(219, 234, 254)', color: 'rgb(68, 85, 102)' },
    ]
    const dom = createDomAcceptance(context, fixture, states.map(state => ({
      id: state.id,
      route,
      action: `检查 ${state.id} 批次的样式、文本与保留状态`,
      expectedErrors: state.id === 'failed'
        ? [{ source: 'build' as const, level: 'error' as const, channel: 'dev-process', text: '[weapp-vite] stateful HMR: Build failed with 1 error:', count: 1 }]
        : [],
      nodes: [
        { selector: '#batch-label', text: state.label },
        { selector: '#increment', text: '1' },
        { selector: '#issue-1081-utility', text: 'batch utility', ...(realStyles ? { styles: { 'background-color': state.background } } : {}) },
        { selector: '#module-panel', text: 'module panel', ...(realStyles ? { styles: { color: state.color } } : {}) },
      ],
    })))
    await dom.check('initial', session, await session.currentPage())
    const previousVersion = await version()
    const stylesheet = path.join(project, 'dist/pages/index/index.wxss')
    const beforeStyles = await readEmittedStylesheet(stylesheet)
    const source = path.join(project, 'src/batch.ts')
    async function save(label: string, color: string, hold = false) {
      const pending = `${source}.pending`
      await writeFile(pending, `export const label = '${label}'\nexport const utility = 'bg-[${color}]'\n${hold ? '// BATCH_HOLD' : ''}\n`)
      await renameAtomicFile(pending, source)
    }
    await save('held', '#dbeafe', true)
    await expect.poll(() => access(path.join(project, 'batch.entered')).then(() => true, () => false), { timeout: 30_000 }).toBe(true)
    expect(await version()).toBe(previousVersion)
    expect(await readEmittedStylesheet(stylesheet)).toBe(beforeStyles)
    await dom.check('held', session, await session.currentPage())
    // 旧源码仍被编译时保存更新；发布后必须观察同一版本的文本、类名和样式。
    await save('latest', '#dcfce7')
    await writeFile(path.join(project, 'batch.release'), 'release')
    await expect.poll(async () => (await (await session.currentPage())!.$('#batch-label'))!.text(), { timeout: 45_000 }).toBe('latest')
    await expect.poll(() => readEmittedStylesheet(path.join(project, 'dist/app.wxss')), { timeout: 45_000 }).toContain('#dcfce7')
    expect(await version()).toBeGreaterThan(previousVersion)
    await dom.check('latest', session, await session.currentPage())
    const vueFile = path.join(project, 'src/pages/index/index.vue')
    await writeFile(vueFile, (await readFile(vueFile, 'utf8')).replace('#123', '#456'))
    await expect.poll(() => readEmittedStylesheet(stylesheet), { timeout: 45_000 }).toMatch(/color:\s*#(?:445566|456)\b/)
    const moduleNode = (await (await session.currentPage())!.$('#module-panel'))!
    const classes = await (moduleNode.attribute ?? moduleNode.attr).call(moduleNode, 'class')
    expect(classes.trim()).not.toBe('')
    expect((await readEmittedStylesheet(stylesheet)).includes(`.${classes.trim()}`)).toBe(true)
    await dom.check('modules', session, await session.currentPage())
    const committedVersion = await version()
    const committedStyles = await readEmittedStylesheet(stylesheet)
    await dom.act('failed', async () => {
      await writeFile(source, 'export const label = \'invalid\'\nexport const utility = \'bg-[#abcdef]\'\n// BATCH_FAIL\n')
      await expect.poll(() => dev!.getOutput(), { timeout: 30_000 }).toContain('issue1081 injected transform failure')
    })
    expect(await version()).toBe(committedVersion)
    expect(await readEmittedStylesheet(stylesheet)).toBe(committedStyles)
    await dom.check('failed', session, await session.currentPage())
    await save('recovered', '#dbeafe')
    await expect.poll(async () => (await (await session.currentPage())!.$('#batch-label'))!.text(), { timeout: 45_000 }).toBe('recovered')
    await expect.poll(() => readEmittedStylesheet(path.join(project, 'dist/app.wxss')), { timeout: 45_000 }).toContain('#dbeafe')
    await dom.check('recovered', session, await session.currentPage())
    const final = await diagnostics.capture('complete')
    expect(original.pageId).not.toBeNull()
    expect(final.pageId).toBe(original.pageId)
    expect(final.runtime).toMatchObject({ pageMarkerRetained: true, appMarkerRetained: true })
    expect(final.errors).toEqual([])
  }, 180_000)
})
