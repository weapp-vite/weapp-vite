import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import type { RuntimeErrorCollector } from './runtimeErrors'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const FIXTURE = 'e2e-apps/github-issues/fixtures/issue-1252'
const ROUTE = '/pages/index/index'
const STARTED = '[{"type":"refresherpulling","detail":{"dy":55},"triggered":true},{"type":"refresherrefresh","detail":{"dy":55},"triggered":true}]'
const RESTORED = '[{"type":"refresherpulling","detail":{"dy":55},"triggered":true},{"type":"refresherrefresh","detail":{"dy":55},"triggered":true},{"type":"refresherrestore","detail":{"dy":55},"triggered":false}]'
const RESTARTED = '[{"type":"refresherpulling","detail":{"dy":55},"triggered":true},{"type":"refresherrefresh","detail":{"dy":55},"triggered":true},{"type":"refresherrestore","detail":{"dy":55},"triggered":false},{"type":"refresherpulling","detail":{"dy":55},"triggered":true},{"type":"refresherrefresh","detail":{"dy":55},"triggered":true}]'

describe('issue #1252: native programmatic scroll-view refresher', { concurrent: false }, () => {
  let project: string | undefined
  let host: MiniProgram | undefined
  let errors: RuntimeErrorCollector | undefined

  beforeAll(async () => {
    project = await createIssueRegressionProject(1252)
    await buildIssueRegressionProject(project, 'weapp')
    const app = JSON.parse(await readFile(path.join(project, 'dist/app.json'), 'utf8')) as { pages: string[] }
    expect(app.pages).toEqual([ROUTE.slice(1)])
    for (const extension of ['js', 'json', 'wxml']) {
      await access(path.join(project, `dist/pages/index/index.${extension}`))
    }
    host = await launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      warmupRoute: ROUTE,
      warmupRootSelectors: ['#ready', '#feed'],
    })
    errors = attachRuntimeErrorCollector(host)
  }, 180_000)

  afterEach(() => {
    expect(errors?.getAll()).toEqual([])
  })

  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      project,
      disposeTransport: () => errors?.dispose(),
      closeSession: () => host?.close(),
      stopDev: () => {},
    })
  }, 120_000)

  it('renders programmatic pulling, refresh and restore without mutating a new page', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      {
        id: 'initial',
        route: ROUTE,
        action: '重新进入后原生刷新控件和空事件记录可见',
        nodes: [{ selector: '#ready', text: 'ready' }, { selector: '#feed', count: 1 }, { selector: '#trace', text: '[]' }],
      },
      {
        id: 'started',
        route: ROUTE,
        action: '程序提交 true 后由控件依次发送 pulling 与 refresh',
        nodes: [{ selector: '#ready', text: 'ready' }, { selector: '#trace', text: STARTED }],
      },
      {
        id: 'restored',
        route: ROUTE,
        action: '程序提交 false 后控件发送 restore，原顺序保留在页面',
        nodes: [{ selector: '#ready', text: 'ready' }, { selector: '#trace', text: RESTORED }],
      },
      {
        id: 'reopened',
        route: ROUTE,
        action: '旧页面卸载后新页面不继承刷新状态或延迟回调',
        nodes: [{ selector: '#ready', text: 'ready' }, { selector: '#feed', count: 1 }, { selector: '#trace', text: '[]' }],
      },
    ])
    const page = await host!.reLaunch(ROUTE)
    await dom.check('initial', host!, page)
    // 这里只提交页面数据，事件由原生 scroll-view 产生；不伪造原生拖动事件。
    await page.callMethod('trigger')
    await expect.poll(() => page.data('trace'), { timeout: 10_000 }).toBe(STARTED)
    expect(await page.data('triggered')).toBe(true)
    await dom.check('started', host!, page)
    await page.callMethod('restore')
    await expect.poll(() => page.data('trace'), { timeout: 10_000 }).toBe(RESTORED)
    expect(await page.data('triggered')).toBe(false)
    await dom.check('restored', host!, page)
    const reopened = await host!.reLaunch(ROUTE)
    // 跨过本轮回弹和刷新延迟回调窗口，验证卸载后的静默语义。
    await reopened.waitFor(500)
    await dom.check('reopened', host!, reopened)
  })

  it('ignores restore callback reentry until a fresh explicit true commit', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      {
        id: 'initial',
        route: ROUTE,
        action: '进入独立页面，刷新记录为空',
        nodes: [{ selector: '#ready', text: 'ready' }, { selector: '#trace', text: '[]' }],
      },
      {
        id: 'started',
        route: ROUTE,
        action: '程序触发的刷新已完成展开',
        nodes: [{ selector: '#ready', text: 'ready' }, { selector: '#trace', text: STARTED }],
      },
      {
        id: 'reentry-held',
        route: ROUTE,
        action: 'restore 回调写入 true 不在回弹期间再次触发刷新',
        nodes: [{ selector: '#ready', text: 'ready' }, { selector: '#trace', text: RESTORED }],
      },
      {
        id: 'restarted',
        route: ROUTE,
        action: '回弹结束后的显式相等 true 提交可触发下一轮刷新',
        nodes: [{ selector: '#ready', text: 'ready' }, { selector: '#trace', text: RESTARTED }],
      },
    ])
    const page = await host!.reLaunch(ROUTE)
    await dom.check('initial', host!, page)
    await page.callMethod('trigger')
    await expect.poll(() => page.data('trace'), { timeout: 10_000 }).toBe(STARTED)
    await dom.check('started', host!, page)
    await page.callMethod('reenter')
    await page.callMethod('restore')
    await expect.poll(() => page.data('triggered'), { timeout: 10_000 }).toBe(true)
    await page.waitFor(500)
    expect(await page.data('trace')).toBe(RESTORED)
    expect(await page.data('reenter')).toBe(false)
    await dom.check('reentry-held', host!, page)
    await page.callMethod('trigger')
    await expect.poll(() => page.data('trace'), { timeout: 10_000 }).toBe(RESTARTED)
    await dom.check('restarted', host!, page)
  })

  it('keeps disabled programmatic updates silent and isolates the next page', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      {
        id: 'initial',
        route: ROUTE,
        action: '初始页面启用刷新且事件为空',
        nodes: [{ selector: '#ready', text: 'ready' }, { selector: '#trace', text: '[]' }],
      },
      {
        id: 'disabled',
        route: ROUTE,
        action: '禁用后 true 和 false 提交均不生成刷新事件',
        nodes: [{ selector: '#ready', text: 'ready' }, { selector: '#trace', text: '[]' }],
      },
      {
        id: 'reopened',
        route: ROUTE,
        action: '新页面恢复启用并可再次程序刷新',
        nodes: [{ selector: '#ready', text: 'ready' }, { selector: '#trace', text: STARTED }],
      },
    ])
    const page = await host!.reLaunch(ROUTE)
    await dom.check('initial', host!, page)
    await page.callMethod('disable')
    expect(await page.data('enabled')).toBe(false)
    await page.callMethod('trigger')
    expect(await page.data('triggered')).toBe(true)
    await page.waitFor(500)
    expect(await page.data('trace')).toBe('[]')
    await page.callMethod('restore')
    await page.waitFor(500)
    expect(await page.data('trace')).toBe('[]')
    await dom.check('disabled', host!, page)
    const reopened = await host!.reLaunch(ROUTE)
    expect(await reopened.data('enabled')).toBe(true)
    await reopened.callMethod('trigger')
    await expect.poll(() => reopened.data('trace'), { timeout: 10_000 }).toBe(STARTED)
    await dom.check('reopened', host!, reopened)
  })
})
