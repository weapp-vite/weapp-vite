import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDomAcceptance } from '../utils/domAcceptance'
import { createHmrRuntimeDiagnostics } from '../utils/hmrRuntimeDiagnostics'
import { createJsxHmrSession, JSX_HMR_ROUTE } from './statefulHmrDom/jsxSession'

const TITLE = '纯 TSX（.tsx）'
const SHARED = '跨文件静态 JSX fragment'
const MARKER = 'HMR-SHARED-FRAGMENT-UPDATED'

function nodes(count: number, title = TITLE, shared = SHARED) {
  return [
    { selector: '.title', text: title },
    { selector: `//text[text()="${shared}"]`, query: 'xpath' as const, text: shared },
    { selector: '#tsx-island-button', text: `dynamic island: ${count}` },
  ]
}

describe('wevu JSX/TSX capability HMR in real WeChat DevTools', { concurrent: false }, () => {
  const session = createJsxHmrSession()
  beforeAll(() => session.start(), 600_000)
  afterAll(() => session.close(), 120_000)

  it('preserves state across repeated TSX handler updates and restores', async (context) => {
    context.onTestFailed(() => {
      process.stdout.write(session.dev.getOutput().slice(-16_000))
    })
    const dom = createDomAcceptance(context, 'apps/wevu-jsx-tsx-demo', [
      { id: 'tsx:initial', route: JSX_HMR_ROUTE, action: '检查初始模板和动态岛计数', nodes: nodes(0) },
      { id: 'tsx:interacted', route: JSX_HMR_ROUTE, action: '动态岛交互后保留页面身份', nodes: nodes(1) },
      { id: 'tsx:handler-updated', route: JSX_HMR_ROUTE, action: '纯脚本更新保留计数并使用新步长', nodes: nodes(3) },
      { id: 'tsx:handler-restored', route: JSX_HMR_ROUTE, action: '脚本恢复仍保留页面状态', nodes: nodes(4) },
      { id: 'tsx:handler-updated-again', route: JSX_HMR_ROUTE, action: '再次更新事件脚本且保持状态', nodes: nodes(7) },
      { id: 'tsx:handler-restored-again', route: JSX_HMR_ROUTE, action: '第二次恢复原始事件逻辑', nodes: nodes(8) },
    ])
    const page = await session.begin()
    expect(page).toBeTruthy()
    await dom.check('tsx:initial', session.miniProgram, page)
    await session.mark()
    await session.tap()
    await dom.check('tsx:interacted', session.miniProgram, page)
    const diagnostics = createHmrRuntimeDiagnostics(session.miniProgram, 'apps/wevu-jsx-tsx-demo')
    const expectedIdentity = { errors: [], pageId: page!.pageId, runtime: { appMarkerRetained: true, pageMarkerRetained: true } }
    expect(await diagnostics.initialize()).toMatchObject(expectedIdentity)
    const original = session.originalPage
    expect(original).toContain('this.islandCount += 1')
    for (const [step, count, changed, restored] of [
      [2, 3, 'tsx:handler-updated', 'tsx:handler-restored'],
      [3, 7, 'tsx:handler-updated-again', 'tsx:handler-restored-again'],
    ] as const) {
      await session.saveScript(original.replace('this.islandCount += 1', `this.islandCount += ${step}`))
      await session.tap()
      await dom.check(changed, session.miniProgram, page)
      expect(await diagnostics.capture(changed)).toMatchObject(expectedIdentity)
      expect(await session.state()).toMatchObject({ count, identity: 'jsx-hmr-instance', route: 'pages/tsx-basic/index' })
      await session.saveScript(original)
      await session.tap()
      await dom.check(restored, session.miniProgram, page)
      expect(await diagnostics.capture(restored)).toMatchObject(expectedIdentity)
      expect(await session.state()).toMatchObject({ count: count + 1, identity: 'jsx-hmr-instance', route: 'pages/tsx-basic/index' })
    }
  }, 180_000)

  it('automatically reloads shared and page TSX template changes through sticky classic', async (context) => {
    context.onTestFailed(() => {
      process.stdout.write(session.dev.getOutput().slice(-16_000))
    })
    const dom = createDomAcceptance(context, 'apps/wevu-jsx-tsx-demo', [
      { id: 'tsx:fallback-initial', route: JSX_HMR_ROUTE, action: '模板修改前确认初始状态', nodes: nodes(0) },
      { id: 'tsx:fallback-prepared', route: JSX_HMR_ROUTE, action: '记录回退前页面身份和交互计数', nodes: nodes(1) },
      { id: 'tsx:shared-updated', route: JSX_HMR_ROUTE, action: '共享编译模板更新自动重载且旧交付链路已退役', nodes: nodes(0, TITLE, MARKER) },
      { id: 'tsx:shared-interacted', route: JSX_HMR_ROUTE, action: '回退后原有动态岛事件仍可交互', nodes: nodes(1, TITLE, MARKER) },
      { id: 'tsx:page-updated', route: JSX_HMR_ROUTE, action: 'classic 接管后续混合模板和脚本更新', nodes: nodes(0, 'HMR-TSX-PAGE-UPDATED', MARKER) },
      { id: 'tsx:classic-handler-updated', route: JSX_HMR_ROUTE, action: '自动重载后使用更新的动态岛事件步长', nodes: nodes(2, 'HMR-TSX-PAGE-UPDATED', MARKER) },
      { id: 'tsx:page-restored', route: JSX_HMR_ROUTE, action: '页面源码恢复仍由 classic 自动重载', nodes: nodes(0, TITLE, MARKER) },
      { id: 'tsx:shared-restored', route: JSX_HMR_ROUTE, action: '共享源码恢复仍使用 classic', nodes: nodes(0) },
      { id: 'tsx:original-clicked', route: JSX_HMR_ROUTE, action: '完整恢复后原始事件恢复一步累加', nodes: nodes(1) },
      { id: 'tsx:shared-updated-again', route: JSX_HMR_ROUTE, action: '再次共享模板保存仍由同一 classic 会话接管', nodes: nodes(0, TITLE, MARKER) },
      { id: 'tsx:shared-restored-again', route: JSX_HMR_ROUTE, action: '第二次恢复共享源码并完成自动重载', nodes: nodes(0) },
    ])
    const check = async (id: string) => dom.check(id, session.miniProgram, await session.miniProgram.currentPage())
    await session.begin()
    await check('tsx:fallback-initial')
    await session.mark()
    await session.tap()
    await check('tsx:fallback-prepared')
    expect(await session.state()).toMatchObject({ count: 1, identity: 'jsx-hmr-instance' })
    const shared = session.originalShared.replace(SHARED, MARKER)
    expect(shared).not.toBe(session.originalShared)
    await session.saveClassic('shared', shared, MARKER)
    await check('tsx:shared-updated')
    await session.tap()
    await check('tsx:shared-interacted')
    const page = session.originalPage.replace(TITLE, 'HMR-TSX-PAGE-UPDATED').replace('this.islandCount += 1', 'this.islandCount += 2')
    await session.saveClassic('page', page, 'HMR-TSX-PAGE-UPDATED')
    await check('tsx:page-updated')
    await session.tap()
    await check('tsx:classic-handler-updated')
    await session.saveClassic('page', session.originalPage, TITLE)
    await check('tsx:page-restored')
    await session.saveClassic('shared', session.originalShared, SHARED)
    await check('tsx:shared-restored')
    await session.tap()
    await check('tsx:original-clicked')
    await session.saveClassic('shared', shared, MARKER)
    await check('tsx:shared-updated-again')
    await session.saveClassic('shared', session.originalShared, SHARED)
    await check('tsx:shared-restored-again')
  }, 300_000)
})
