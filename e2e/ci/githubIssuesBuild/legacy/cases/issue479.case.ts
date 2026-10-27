import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 34

export function registerGithubIssuesBuildCase() {
  it('issue #479: injects indirect wevu page feature hooks from local helpers', async () => {
    await runBuild()

    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-479/index.js')
    const issuePageJsonPath = path.join(DIST_ROOT, 'pages/issue-479/index.json')
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-479/index.wxml')

    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')
    const issuePageJson = await fs.readFile(issuePageJsonPath, 'utf-8')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-479 indirect page feature hooks')
    expect(issuePageJs).toContain('useIssue479PageFeatureHooks')
    expect(issuePageJs).toContain('enableOnPullDownRefresh: true')
    expect(issuePageJs).toContain('enableOnReachBottom: true')
    expect(issuePageJson).toContain('"enablePullDownRefresh": true')
    expect(issuePageJson).toContain('"onReachBottomDistance": 50')
    expect(issuePageJs).not.toContain('pages/issue-479/usePageFeatureHooks')
  })
}
