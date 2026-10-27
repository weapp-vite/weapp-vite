import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 48

export function registerGithubIssuesBuildCase() {
  it('issue #500: compiles missing inject continuation probe', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-500/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-500/index.js')

    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')

    expect(pageWxml).toContain('issue-500 inject missing key continuation')
    expect(pageWxml).toContain('inject after line: {{continuationText}}')
    expect(pageWxml).toContain('data-continuation="{{continuationText}}"')
    expect(pageWxml).toContain('data-missing-type="{{missingType}}"')
    expect(pageJs).toContain('issue-500:missing-token')
    expect(pageJs).toContain('_runE2E')
  })
}
