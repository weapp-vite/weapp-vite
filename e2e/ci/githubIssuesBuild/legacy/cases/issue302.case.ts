import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 73

export function registerGithubIssuesBuildCase() {
  it('issue #302: keeps v-for class bindings in sync with active state', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-302/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-302/index.js')

    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-302 v-for class binding update')
    expect(issuePageWxml).toContain('active: {{active}}')
    expect(issuePageWxml).toContain('wx:for="{{tabs}}"')
    expect(issuePageWxml).toContain('wx:key="id"')
    expect(issuePageWxml).toMatch(/wx:for-index="(?:__wv_index_0|index)"/)
    expect(issuePageWxml).toMatch(/class="\{\{__wv_cls_\d+\[(?:__wv_index_0|index)\]\}\}"/)
    expect(issuePageWxml).not.toContain('active === tab.id')

    const classBindingTokens = issuePageWxml.match(/__wv_cls_\d+/g) ?? []
    expect(new Set(classBindingTokens).size).toBeGreaterThanOrEqual(1)

    expect(issuePageJs).toContain('setActive')
    expect(issuePageJs).toContain('active')
    expect(issuePageJs).toContain('tabs')
    expect(issuePageJs).toContain('_runE2E')
    expect(issuePageJs).toContain('issue302-item-')
    expect(issuePageJs).toContain('issue302-item-active')
    expect(issuePageJs).toContain('issue302-item-inactive')
  })
}
