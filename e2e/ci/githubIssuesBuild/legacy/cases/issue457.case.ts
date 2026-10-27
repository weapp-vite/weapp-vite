import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 31

export function registerGithubIssuesBuildCase() {
  it('issue #457: keeps injected web runtime code readable in production output', async () => {
    await runBuild()

    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-457/index.js')
    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-457/index.wxml')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const lineCount = pageJs.split('\n').length

    expect(pageWxml).toContain('issue-457 web runtime debug readability')
    expect(pageJs).toContain('_runE2E')
    expect(pageJs).toContain('installWebRuntimeGlobals({ targets: [')
    expect(pageJs).toContain('"atob"')
    expect(pageJs).toContain('"btoa"')
    expect(pageJs).toContain('const encoded = btoa("issue-457");')
    expect(lineCount).toBeGreaterThan(5)
  })
}
