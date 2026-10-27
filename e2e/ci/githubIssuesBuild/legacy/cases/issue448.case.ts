import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 30

export function registerGithubIssuesBuildCase() {
  it('issue #448: injects the next batch of web runtime globals on demand', async () => {
    await runBuild()

    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-448/index.js')
    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-448/index.wxml')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')

    expect(pageWxml).toContain('issue-448 next web runtime globals')
    expect(pageJs).toContain('_runE2E')
    expect(pageJs).toContain('microtaskState')
    expect(pageJs).toContain('installWebRuntimeGlobals({ targets: [')
    expect(pageJs).toContain('"queueMicrotask"')
    expect(pageJs).toContain('const encoded = btoa("AB");')
    expect(pageJs).toContain('URL.parse("123", "fake://abc")')
    expect(pageJs).toContain('URL.canParse(')
    expect(pageJs).toContain('searchParams.sort()')
    expect(pageJs).toContain('headers.getSetCookie()')
    expect(pageJs).toContain('Response.json(')
    expect(pageJs).toContain('Response.error()')
    expect(pageJs).toContain('function _runE2E() {')
    expect(pageJs).toContain('function _runFormDataUploadE2E()')
    expect(pageJs).toContain('globalThis.wx')
    expect(pageJs).toContain('.downloadFile({')
    expect(pageJs).toContain('new Blob([')
    expect(pageJs).toContain('new File([')
    expect(pageJs).toContain('FormData')
  })
}
