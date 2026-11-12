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
import { githubText as text } from './githubIssuesDom/nodes'

const route = '/pages/teleport-root-portal/index'

describe('e2e app: github-issues / teleport root-portal', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()

    const pageRoot = path.join(DIST_ROOT, 'pages/teleport-root-portal/index')
    for (const extension of ['js', 'json', 'wxml']) {
      expect(await fs.pathExists(`${pageRoot}.${extension}`)).toBe(true)
    }

    const appJson = await fs.readJSON(path.join(DIST_ROOT, 'app.json')) as { pages?: string[] }
    expect(appJson.pages).toContain('pages/teleport-root-portal/index')

    const pageJson = await fs.readJSON(`${pageRoot}.json`) as { usingComponents?: Record<string, string> }
    expect(Object.keys(pageJson.usingComponents ?? {})).not.toContain('teleport')

    const template = await fs.readFile(`${pageRoot}.wxml`, 'utf8')
    expect([...template.matchAll(/<root-portal\b/g)]).toHaveLength(7)
    expect(template).not.toMatch(/<teleport[\s>/]/i)
    expect(template).not.toContain('to="body"')
    expect(template).not.toContain('to="#inner-target"')
    expect(template).not.toContain('defer')

    // 静态 disabled 与未设置 disabled 分别映射为 enable 的 false/true 字面量。
    expect(template).toContain('enable="{{true}}"')
    expect(template).toContain('enable="{{false}}"')
    for (const [tag] of template.matchAll(/<root-portal\b[^>]*>/g)) {
      expect(tag).toContain('enable=')
      expect(tag).not.toContain('disabled')
    }

    // v-if 保留为结构块，嵌套的不可映射 Teleport 仍渲染在外层 portal 内。
    expect(template).toContain('<block wx:if="{{showConditionalPortal}}"><root-portal enable="{{true}}">')
    expect(template).toContain(
      '<root-portal enable="{{true}}"><view id="teleport-nested-outer"><view id="teleport-nested-degraded">nested-degraded</view></view></root-portal>',
    )
    expect(template).toContain('<root-portal enable="{{!(portalDisabled)}}">')
    expect(template).toContain('id="teleport-degraded-content"')

    // 原生 root-portal 的 externalClass 与 root-portal 内样式变量需原样保留。
    expect(template).toContain('externalClass="teleport-external-class"')
    expect(template).toContain('id="teleport-style-content"')
    expect(template).toContain('color: var(--teleport-accent)')
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)
  afterAll(() => closeSharedMiniProgram())

  it('renders mapped and degraded Teleport content in real runtime', async (ctx) => {
    await runGithubDom(ctx, route, [{
      id: 'initial',
      action: '首屏检查映射后的 root-portal 内容与降级内容都正常渲染',
      nodes: [
        text('#teleport-status', 'enabled'),
        text('#teleport-conditional-status', 'shown'),
        text('#teleport-portal-content', 'portal-content'),
        text('#teleport-disabled-portal-content', 'disabled-portal-content'),
        text('#teleport-degraded-content', 'degraded-content'),
        text('#teleport-html-content', 'html-content'),
        text('#teleport-missing-target-content', 'missing-target-content'),
        text('#teleport-conditional-content', 'conditional-content'),
        text('#teleport-nested-degraded', 'nested-degraded'),
        text('#teleport-style-content', 'styled-content'),
        text('#teleport-external-class-content', 'external-class-content'),
      ],
    }, {
      id: 'disabled-toggled',
      action: '切换 disabled 后检查 enable 绑定更新且内容仍然可见',
      method: '_togglePortal',
      nodes: [
        text('#teleport-status', 'disabled'),
        text('#teleport-portal-content', 'portal-content'),
      ],
    }, {
      id: 'conditional-hidden',
      action: '关闭 v-if 后检查 root-portal 条件渲染移除内容',
      method: '_toggleConditionalPortal',
      nodes: [
        text('#teleport-conditional-status', 'hidden'),
        { selector: '#teleport-conditional-content', count: 0 },
      ],
    }])
  })
})
