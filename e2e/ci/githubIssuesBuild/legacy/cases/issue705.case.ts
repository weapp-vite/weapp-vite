import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 21

export function registerGithubIssuesBuildCase() {
  it('issue #705: compiles router route sync runtime probe', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-705/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-705/index.js')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')

    expect(pageWxml).toContain('data-route-path="{{routePath}}"')
    expect(pageJs).toContain('_runE2E')
    expect(pageJs).toContain('pages/issue-550/index')
  })
}
