import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 78

export function registerGithubIssuesBuildCase() {
  it('issue #318: auto injects setData.pick for template-used keys', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-318/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-318/index.js')

    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-318 auto setData pick from template')
    expect(issuePageWxml).toContain('wx:for="{{list}}"')
    expect(issuePageWxml).toContain('count: {{count}}')
    expect(issuePageWxml).toContain('size: {{list.length}}')
    expect(issuePageWxml).toContain('data-line="{{__wv_bind_')
    expect(issuePageWxml).toContain('data-meta="{{__wv_bind_')
    expect(issuePageWxml).toContain('{{__wv_bind_')
    expect(issuePageWxml).not.toContain('formatRow(')
    expect(issuePageWxml).not.toContain('formatMeta(')

    const bindTokens = issuePageWxml.match(/__wv_bind_\d+/g) ?? []
    expect(new Set(bindTokens).size).toBeGreaterThanOrEqual(2)

    expect(issuePageJs).toContain('_runE2E')
    expect(issuePageJs).toContain('setData')
    expect(issuePageJs).toContain('pick')
    expect(issuePageJs).toContain('"count"')
    expect(issuePageJs).toContain('"list"')
    expect(issuePageJs).toMatch(/['"`]__wv_bind_\d+['"`]/)
  })
}
