import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 75

export function registerGithubIssuesBuildCase() {
  it('issue #309: keeps onLoad hook active with created setupLifecycle', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-309-created/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-309-created/index.js')

    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-309 created lifecycle onLoad hook')
    expect(issuePageWxml).toContain('loadCount: {{loadCount}}')
    expect(issuePageJs).toContain('_runE2E')
    expect(issuePageJs).toContain('__wevu_isPage: true')
    expect(issuePageJs).toContain('loadCount')
    expect(issuePageJs).not.toContain('onPullDownRefresh')
  })
}
