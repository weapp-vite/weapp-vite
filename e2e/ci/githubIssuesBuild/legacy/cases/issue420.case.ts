import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 29

export function registerGithubIssuesBuildCase() {
  it('issue #420: injects WebSocket globals for socket.io-client entry pages', async () => {
    await runBuild()

    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-420/index.js')
    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-420/index.wxml')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')

    expect(pageWxml).toContain('issue-420 socket.io-client bootstrap')
    expect(pageJs).toContain('transportName')
    expect(pageJs).toContain('socket.invalid/github-issues')
    expect(pageJs).toContain('/* __wvRGC__ */')
    expect(pageJs).toContain('installWebRuntimeGlobals({ targets: [')
    expect(pageJs).toContain('"WebSocket"')
    expect(pageJs).toContain('|| globalThis')
    expect(pageJs).toContain('var WebSocket =')
    expect(pageJs).toContain('.WebSocket')
    expect(pageJs).toContain('var URL =')
    expect(pageJs).toContain('.URL')
  })
}
