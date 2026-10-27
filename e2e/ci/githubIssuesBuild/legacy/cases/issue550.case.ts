import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 20

export function registerGithubIssuesBuildCase() {
  it('issue #550: exposes current route name through useRoute()', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-550/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-550/index.js')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')

    expect(pageWxml).toContain('data-route-name="{{routeName}}"')
    expect(pageWxml).toContain('data-matched-name="{{routeMatchedName}}"')
    expect(pageJs).toContain('pages/issue-550/index')
    expect(pageJs).toContain('route.name')
  })
}
