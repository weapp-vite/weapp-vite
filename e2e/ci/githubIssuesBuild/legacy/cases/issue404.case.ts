import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 66

export function registerGithubIssuesBuildCase() {
  it('issue #404: keeps onPageScroll page hooks enabled and exposes runtime probes in the page bundle', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-404/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-404/index.js')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')

    expect(pageWxml).toContain('issue-404 onPageScroll bridge')
    expect(pageWxml).toContain('has instance onPageScroll')
    expect(pageWxml).toContain('latest scrollTop')
    expect(pageJs).toContain('_runE2E')
    expect(pageJs).toContain('hasInstanceOnPageScroll')
    expect(pageJs).toContain('enableOnPageScroll')
  })
}
