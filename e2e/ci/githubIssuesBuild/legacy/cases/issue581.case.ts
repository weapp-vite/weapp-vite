import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 41

export function registerGithubIssuesBuildCase() {
  it('issue #581: compiles setup object reactive array and loading refs', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-581/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-581/index.js')

    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')

    expect(pageWxml).toContain('issue-581 reactive array flush')
    expect(pageWxml).toContain('wx:for="{{back.state}}"')
    expect(pageWxml).toContain('data-issue581-name="{{value.name}}"')
    expect(pageWxml).toContain('data-loading="{{back.loading ? \'true\' : \'false\'}}"')
    expect(pageWxml).toContain('data-row-count="{{back.state.length}}"')
    expect(pageJs).toContain('fetchIssue581Rows')
    expect(pageJs).toContain('_runE2E')
  })
}
