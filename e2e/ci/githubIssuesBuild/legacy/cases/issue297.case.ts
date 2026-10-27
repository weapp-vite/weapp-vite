import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 71

export function registerGithubIssuesBuildCase() {
  it('issue #297: compiles complex call expressions', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-297/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-297/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-297 complex call expressions')
    expect(issuePageWxml).toContain('Case A · v-bind 调用表达式')
    expect(issuePageWxml).toContain('Case B · v-if + v-for 调用表达式')
    expect(issuePageWxml).toContain('Case C · 多参数调用（含激活项）')
    expect(issuePageWxml).toContain('Case A(v-bind):')
    expect(issuePageWxml).toContain('Case B(v-if/v-for):')
    expect(issuePageWxml).toContain('Case C(多参数):')
    expect(issuePageWxml).toContain('新增列表项')
    expect(issuePageWxml).toContain('重置列表')
    expect(issuePageWxml).toMatch(/wx:if="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/wx:for="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-title="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-hello="\{\{__wv_bind_\d+\[[^\]]+\]\}\}"/)
    expect(issuePageWxml).toMatch(/\{\{__wv_bind_\d+\[[^\]]+\]\}\}/)
    expect(issuePageWxml).not.toContain('sayHello(')
    const bindTokens = issuePageWxml.match(/__wv_bind_\d+/g) ?? []
    expect(new Set(bindTokens).size).toBeGreaterThanOrEqual(5)

    expect(issuePageJs).toContain('sayHello(1, \'root\', dasd)')
    expect(issuePageJs).toContain('dasd')
    expect(issuePageJs).toContain('this.sayHello')
    expect(issuePageJs).toContain('_runE2E')
  })
}
