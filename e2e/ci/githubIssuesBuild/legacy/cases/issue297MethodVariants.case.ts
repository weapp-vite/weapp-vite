import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 72

export function registerGithubIssuesBuildCase() {
  it('issue #297: setup method call variants compile to stable bindings', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-297-setup-method-calls/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-297-setup-method-calls/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-297 setup method call variants')
    expect(issuePageWxml).toContain('Case A · 插值调用 + 同级静态文本 + 同级元素')
    expect(issuePageWxml).toContain('Case B · v-bind 多参数调用')
    expect(issuePageWxml).toContain('Case C · v-if + v-for 调用表达式')
    expect(issuePageWxml).toContain('Case D · 成员调用 / 模板字符串 / 三元表达式')
    expect(issuePageWxml).toContain('Case E · 可选调用 + 空值兜底')
    expect(issuePageWxml).toMatch(/wx:if="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/wx:for="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-inline="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-multi="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-label="\{\{__wv_bind_\d+\[[^\]]+\]\}\}"/)
    expect(issuePageWxml).toMatch(/data-loop="\{\{__wv_bind_\d+\[[^\]]+\]\}\}"/)
    expect(issuePageWxml).toMatch(/data-member="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-template="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-ternary="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-wrap="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-optional="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).not.toContain('getCase()')
    expect(issuePageWxml).not.toContain('sayCase(')
    expect(issuePageWxml).not.toContain('getOptionalInvoker?.(')

    expect(issuePageJs).toContain('this.getCase')
    expect(issuePageJs).toContain('this.sayCase')
    expect(issuePageJs).toContain('this.getRows')
    expect(issuePageJs).toContain('this.getOptionalInvoker')
    expect(issuePageJs).toContain('_runE2E')
  })
}
