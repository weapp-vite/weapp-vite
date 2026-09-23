import { ok as assert } from 'node:assert'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { buildRuntimePruning, RUNTIME_PRUNING_ROOT, RUNTIME_PUBLIC_FACTORY_ROOT } from '../utils/runtimePruning'

const HOME = '/pages/index/index'
const DETAIL = '/detail/index'

// 两个 fixture 分别启动一次，避免公开工厂的保守能力污染纯模板裁剪产物。
async function launchRuntimeFixture(projectPath: string) {
  await buildRuntimePruning('weapp', projectPath)
  return launchAutomator({
    projectPath,
    trustProject: true,
    warmupRoute: HOME,
    // 分包页面以 text 为根，使用两页共有的节点；下方继续验证各页的精确业务 selector。
    warmupRootSelectors: ['text'],
    warmupAllowRelaunch: false,
    disableRelaunchSessionRecovery: true,
  })
}

describe('issue #1064: runtime after automatic pruning', { concurrent: false }, () => {
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined

  beforeAll(async () => {
    miniProgram = await launchRuntimeFixture(RUNTIME_PRUNING_ROOT)
  }, 360_000)

  afterAll(async () => {
    await miniProgram?.close()
  }, 30_000)

  it('mounts without a router, updates reactive props and reLaunches a subpackage', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues/fixtures/runtime-pruning', [
      { id: 'cold-start', route: HOME, action: '验证无 router 首屏挂载', nodes: [{ selector: '#pruning-phase', text: 'mounted' }, { selector: '#pruning-count', text: '0' }] },
      { id: 'updated', route: HOME, action: '点击按钮更新响应式状态和子组件 props', nodes: [{ selector: '#pruning-count', text: '1' }, { selector: '#pruning-doubled', text: '2' }, { selector: '#pruning-child-value', text: '1', scope: ['#pruning-child'] }] },
      { id: 'subpackage', route: DETAIL, action: '跳转到分包并验证生命周期', nodes: [{ selector: '#pruning-detail', text: 'mounted' }] },
      { id: 'relaunch', route: HOME, action: '重新启动首页并验证状态隔离', nodes: [{ selector: '#pruning-count', text: '0' }, { selector: '#pruning-phase', text: 'mounted' }] },
    ])
    assert(miniProgram)
    const page = await miniProgram.currentPage()
    assert(page)
    await page.waitForRendered({ selector: '#pruning-page', timeout: 10_000 })
    await expect.poll(() => page.callMethod('readSnapshot')).toEqual({ count: 0, phase: 'mounted', trace: ['setup', 'load', 'mounted'] })
    await dom.check('cold-start', miniProgram, page)
    const button = await page.$('#pruning-increment')
    assert(button)
    await button.tap()
    await expect.poll(() => page.data('count')).toBe(1)
    await dom.check('updated', miniProgram, page)
    const detail = await miniProgram.reLaunch(DETAIL)
    assert(detail)
    await detail.waitForRendered({ selector: '#pruning-detail', timeout: 10_000 })
    await dom.check('subpackage', miniProgram, detail)
    const restarted = await miniProgram.reLaunch(HOME)
    assert(restarted)
    await restarted.waitForRendered({ selector: '#pruning-page', timeout: 10_000 })
    await dom.check('relaunch', miniProgram, restarted)
  })
})

describe('issue #1064: dynamic public factory compatibility', { concurrent: false }, () => {
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined

  beforeAll(async () => {
    miniProgram = await launchRuntimeFixture(RUNTIME_PUBLIC_FACTORY_ROOT)
  }, 360_000)

  afterAll(async () => {
    await miniProgram?.close()
  }, 30_000)

  it('retains JSX island dispatch for a native page using a dynamic public factory', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues/fixtures/runtime-public-factory', [
      { id: 'public-initial', route: HOME, action: '公开动态工厂首次挂载', nodes: [{ selector: '#public-factory-phase', text: 'mounted' }, { selector: '#public-factory-count', text: '0' }] },
      { id: 'public-updated', route: HOME, action: '动态岛按钮派发事件并更新状态', nodes: [{ selector: '#public-factory-count', text: '1' }] },
      { id: 'public-relaunch', route: HOME, action: '重新启动后保留工厂和事件能力', nodes: [{ selector: '#public-factory-count', text: '0' }, { selector: '#public-factory-phase', text: 'mounted' }] },
    ])
    assert(miniProgram)
    const page = await miniProgram.currentPage()
    assert(page)
    await page.waitForRendered({ selector: '#public-factory-page', timeout: 10_000 })
    await expect.poll(() => page.callMethod('readSnapshot')).toEqual({ count: 0, phase: 'mounted' })
    await dom.check('public-initial', miniProgram, page)
    const button = await page.$('#public-factory-increment')
    assert(button)
    await button.tap()
    await expect.poll(() => page.data('count')).toBe(1)
    await dom.check('public-updated', miniProgram, page)
    const restarted = await miniProgram.reLaunch(HOME)
    assert(restarted)
    await restarted.waitForRendered({ selector: '#public-factory-page', timeout: 10_000 })
    await expect.poll(() => restarted.callMethod('readSnapshot')).toEqual({ count: 0, phase: 'mounted' })
    await dom.check('public-relaunch', miniProgram, restarted)
  })
})
