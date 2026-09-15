import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  DIST_ROOT,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
} from './github-issues.runtime.shared'
import { runGithubDom } from './githubIssuesDom'

const ISSUE_1013_ROUTE = '/pages/issue-1013/index'

describe('e2e app: github-issues / issue #1013', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
    for (const relativePath of [
      'pages/issue-1013/index.js',
      'pages/issue-1013/index.json',
      'pages/issue-1013/index.wxml',
      'components/issue-1013-child/index.js',
      'components/issue-1013-child/index.json',
      'components/issue-1013-child/index.wxml',
    ]) {
      await expect(fs.pathExists(path.join(DIST_ROOT, relativePath))).resolves.toBe(true)
    }
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('omits unsupported dynamic names while static native and component controls still run', async (ctx) => {
    const wxml = await fs.readFile(path.join(DIST_ROOT, 'pages/issue-1013/index.wxml'), 'utf8')

    expect(wxml).not.toMatch(/\sattr=/)
    expect(wxml).not.toContain('bindevent=')
    expect(wxml).toContain('data-title="{{staticTitle}}"')
    expect(wxml).toContain('bindtap="__weapp_vite_inline"')
    expect(wxml).toContain('data-wd-ready="1"')
    expect(wxml).toContain('bindready="__weapp_vite_inline"')

    await runGithubDom(ctx, ISSUE_1013_ROUTE, [{
      id: 'initial',
      action: '检查动态名称已忽略且静态组件已渲染',
      nodes: [
        { selector: '#issue-1013-dynamic', text: 'dynamic probe' },
        { selector: '#issue-1013-dynamic-count', text: 'dynamic taps: 0' },
        { selector: '#issue-1013-static-probe-count', text: 'static probe taps: 0' },
        { selector: '#issue-1013-native', text: 'native taps: 0', attributes: { 'data-title': 'static-title' } },
        { selector: '#issue-1013-child', scope: [{ has: '#issue-1013-child' }], text: 'component child' },
        { selector: '#issue-1013-component-status', text: 'component: pending' },
      ],
    }, {
      id: 'dynamic-event-ignored',
      action: '静态监听接收 tap，而已拒绝的动态监听不应被调用',
      tap: '#issue-1013-dynamic',
      nodes: [
        { selector: '#issue-1013-dynamic-count', text: 'dynamic taps: 0' },
        { selector: '#issue-1013-static-probe-count', text: 'static probe taps: 1' },
      ],
    }, {
      id: 'static-native-event',
      action: '点击更新原生状态，并通过组件 prop 触发静态自定义事件',
      tap: '#issue-1013-native',
      nodes: [
        { selector: '#issue-1013-native', text: 'native taps: 1', attributes: { 'data-title': 'static-title' } },
        { selector: '#issue-1013-component-status', text: 'component: ready' },
      ],
    }])
  })
})
