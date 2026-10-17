import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'

const FIXTURE = 'e2e-apps/github-issues/fixtures/issue-1235'
const ROUTE = '/pages/index/index'

function nodes(count: number, summary: string, order = 'alpha,beta', visible = 'visible') {
  return [
    { selector: '#issue1235-count', text: String(count) },
    { selector: '#issue1235-summary', text: summary },
    { selector: '#issue1235-order', text: order },
    { selector: '#issue1235-visible', text: visible },
  ]
}

describe('issue #1235: conditional loop component event reentry', { concurrent: false }, () => {
  let project: string | undefined
  let host: MiniProgram | undefined

  beforeAll(async () => {
    project = await createIssueRegressionProject(1235)
    await buildIssueRegressionProject(project, 'weapp')
    const app = JSON.parse(await readFile(path.join(project, 'dist/app.json'), 'utf8')) as { pages: string[] }
    expect(app.pages).toEqual(['pages/index/index', 'pages/empty/index'])
    for (const entry of [...app.pages, 'components/child/index']) {
      for (const extension of ['js', 'json', 'wxml']) {
        await access(path.join(project, `dist/${entry}.${extension}`))
      }
    }
    host = await launchAutomator({
      projectPath: project,
      warmupRoute: ROUTE,
      warmupRootSelectors: ['#issue1235-page'],
    })
  }, 180_000)

  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      project,
      closeSession: () => host?.close(),
      stopDev: () => {},
    })
  }, 120_000)

  async function tapRow(page: Awaited<ReturnType<MiniProgram['currentPage']>>, row: string) {
    const child = await page.$(`#child-${row}`)
    expect(child).toBeTruthy()
    const button = await child!.$(`#emit-${row}`)
    expect(button).toBeTruthy()
    await button!.tap()
  }

  it('appends once and resolves the actual replacement handler after a render', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      { id: 'initial', route: ROUTE, action: '条件循环包含两个独立子组件', nodes: nodes(0, '') },
      { id: 'single', route: ROUTE, action: '单次事件在同步追加后只记录一次', nodes: nodes(1, 'original:alpha') },
      { id: 'replacement', route: ROUTE, action: '实际更换父处理函数后只派发给新函数一次', nodes: nodes(2, 'original:alpha,replacement:beta') },
    ])
    const page = await host!.reLaunch(ROUTE)
    await dom.check('initial', host!, page)
    await tapRow(page, 'alpha')
    await dom.check('single', host!, page)
    expect((await page.callMethod('readState')).received).toEqual([{ row: 'alpha', handler: 'original' }])
    await page.callMethod('replaceHandler')
    expect((await page.callMethod('readState')).handlerReplaced).toBe(true)
    await tapRow(page, 'beta')
    await dom.check('replacement', host!, page)
    expect((await page.callMethod('readState')).received).toEqual([
      { row: 'alpha', handler: 'original' },
      { row: 'beta', handler: 'replacement' },
    ])
  })

  it('keeps one receiver per event while the handler synchronously reorders keyed children', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      { id: 'first', route: ROUTE, action: '事件回调重排两个稳定 key 节点，事件不重放', nodes: nodes(1, 'original:alpha', 'beta,alpha') },
      { id: 'second', route: ROUTE, action: '重排后另一节点只触发对应的一次接收', nodes: nodes(2, 'original:alpha,original:beta') },
    ])
    const page = await host!.reLaunch(ROUTE)
    await page.callMethod('setMode', 'reorder')
    await tapRow(page, 'alpha')
    await dom.check('first', host!, page)
    await tapRow(page, 'beta')
    await dom.check('second', host!, page)
    expect((await page.callMethod('readState')).received).toEqual([
      { row: 'alpha', handler: 'original' },
      { row: 'beta', handler: 'original' },
    ])
  })

  it('does not replay events when a callback removes the loop or a page is reopened', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      { id: 'removed', route: ROUTE, action: '回调同步卸载声明树后保留一次接收', nodes: nodes(1, 'original:alpha', 'alpha,beta', 'hidden') },
      { id: 'restored', route: ROUTE, action: '重新挂载不会补发旧事件', nodes: nodes(1, 'original:alpha') },
      { id: 'next', route: ROUTE, action: '恢复后新事件只接收一次', nodes: nodes(2, 'original:alpha,original:beta') },
      { id: 'empty', route: '/pages/empty/index', action: '离开后原页面完成卸载', nodes: [{ selector: '#issue1235-empty', text: 'unloaded' }] },
      { id: 'reopened', route: ROUTE, action: '重新进入同路由使用独立初始接收状态', nodes: nodes(0, '') },
    ])
    const page = await host!.reLaunch(ROUTE)
    await page.callMethod('setMode', 'unmount')
    await tapRow(page, 'alpha')
    await dom.check('removed', host!, page)
    expect(await page.$('#child-alpha')).toBeNull()
    expect(await page.$('#child-beta')).toBeNull()
    await page.callMethod('restoreChildren')
    await dom.check('restored', host!, page)
    await tapRow(page, 'beta')
    await dom.check('next', host!, page)
    expect((await page.callMethod('readState')).received).toHaveLength(2)
    const empty = await host!.reLaunch('/pages/empty/index')
    await dom.check('empty', host!, empty)
    const reopened = await host!.reLaunch(ROUTE)
    await dom.check('reopened', host!, reopened)
    expect((await reopened.callMethod('readState')).received).toEqual([])
  })
})
