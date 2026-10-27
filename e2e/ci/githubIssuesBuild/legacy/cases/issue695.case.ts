import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 35

export function registerGithubIssuesBuildCase() {
  it('issue #695: keeps direct pull-down hook feature enabled for Vue SFC pages', async () => {
    await runBuild()

    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-695/index.js')
    const issuePageJsonPath = path.join(DIST_ROOT, 'pages/issue-695/index.json')
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-695/index.wxml')

    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')
    const issuePageJson = await fs.readFile(issuePageJsonPath, 'utf-8')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-695 direct pull-down hook')
    expect(issuePageJs).toContain('enableOnPullDownRefresh: true')
    expect(issuePageJson).toContain('"enablePullDownRefresh": true')
  })
}
