import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 76

export function registerGithubIssuesBuildCase() {
  it('issue #312: keeps setup computed object bindings reactive after reference round trip', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-312/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-312/index.js')

    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-312 computed object round trip')
    expect(issuePageWxml).toContain('current option:')
    expect(issuePageWxml).toContain('issue312-probe')
    expect(issuePageWxml).toContain('data-current-label="{{option.label}}"')
    expect(issuePageWxml).toContain('issue312-btn-inc')
    expect(issuePageWxml).toContain('issue312-btn-dec')
    expect(issuePageJs).toContain('_runE2E')
    expect(issuePageJs).toContain('options')
    expect(issuePageJs).toContain('option')
    expect(issuePageJs).toContain('index')
  })
}
