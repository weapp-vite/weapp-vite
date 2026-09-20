import { access } from 'node:fs/promises'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { COMPONENT_INSTANCE_API_INITIAL_TRACE, COMPONENT_INSTANCE_API_REMOVED_TRACE, COMPONENT_INSTANCE_API_RESTORED_TRACE } from '../utils/componentInstanceApiContract'
import { createDomAcceptance } from '../utils/domAcceptance'
import { closeSharedMiniProgram, DIST_ROOT, getSharedMiniProgram, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT, prepareGithubIssuesBuild, relaunchPage } from './github-issues.runtime.shared'
import { tapRendered } from './tdesignDom'

const ROUTE = '/pages/component-instance-apis/index'
const BASELINE_ROUTE = '/pages/component-instance-apis-baseline/index'

describe('github issues: native component instance APIs', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
    for (const route of [ROUTE, BASELINE_ROUTE]) {
      for (const extension of ['js', 'json', 'wxml']) {
        await access(path.join(DIST_ROOT, `${route.slice(1)}.${extension}`))
      }
    }
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)
  afterAll(async () => {
    await closeSharedMiniProgram()
  }, 30_000)

  it('keeps native relation lifecycle order and component selector scopes across removal and restoration', async (ctx) => {
    const stages = [
      { id: 'initial', action: '打开原生关系页面，检查完整初始顺序及双方自身作用域查询', trace: COMPONENT_INSTANCE_API_INITIAL_TRACE, operation: null },
      { id: 'removed', action: '点击移除子组件，检查 detached 和 unlinked 顺序、关系清空及子节点消失', trace: COMPONENT_INSTANCE_API_REMOVED_TRACE, operation: 'remove-child' },
      { id: 'restored', action: '点击恢复子组件，检查 linked 和 ready 顺序、关系恢复及作用域查询', trace: COMPONENT_INSTANCE_API_RESTORED_TRACE, operation: 'restore-child' },
    ] as const
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [
      { id: 'baseline', route: BASELINE_ROUTE, action: '离开上轮组件后显式清空事件，检查独立准备页', nodes: [{ selector: '#baseline-title', text: '准备组件关系验收' }] },
      ...stages.map(stage => ({
        id: stage.id,
        route: ROUTE,
        action: stage.action,
        nodes: [
          { selector: '#relation-trace', text: stage.trace.join('\n') },
          { selector: '#relation-children', text: stage.id === 'removed' ? 'none' : 'child' },
          { selector: '//*[@id="parent-query"]', query: 'xpath' as const, text: 'parent' },
          stage.id === 'removed'
            ? { selector: '//*[@id="child-query"]', query: 'xpath' as const, count: 0 }
            : { selector: '//*[@id="child-query"]', query: 'xpath' as const, text: 'child' },
        ],
      })),
    ])
    const miniProgram = await getSharedMiniProgram(ctx)
    const baseline = await dom.act('baseline', () => relaunchPage(miniProgram, BASELINE_ROUTE, undefined, 30_000, { readiness: 'route' }))
    if (!baseline) {
      throw new Error('Native component API baseline did not launch')
    }
    await tapRendered(baseline, '//*[@id="clear-trace"]')
    await dom.check('baseline', miniProgram, baseline)
    const page = await dom.act('initial', () => relaunchPage(miniProgram, ROUTE, undefined, 30_000, { readiness: 'route' }))
    if (!page) {
      throw new Error('Native component API page did not launch')
    }
    for (const stage of stages) {
      if (stage.operation) {
        await dom.act(stage.id, () => tapRendered(page, `//*[@id="${stage.operation}"]`))
      }
      // 把实际执行日志刷新到界面；最终验收仍逐项查询真实文本和组件内节点。
      await expect.poll(() => page.callMethod('snapshot'), { timeout: 10_000 }).toEqual(stage.trace)
      await dom.check(stage.id, miniProgram, page)
    }
  })
})
