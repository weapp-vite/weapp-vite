import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 57

export function registerGithubIssuesBuildCase() {
  it('issue #459: keeps directly imported web-apis polyfills interoperable in github-issues app', async () => {
    await runBuild()

    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-459/index.js')
    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-459/index.wxml')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')

    expect(pageWxml).toContain('issue-459 web-apis polyfill compatibility')
    expect(pageJs).toContain('_runE2E')
    expect(pageJs).toContain('"/abc", "https://issue-459.invalid"')
    expect(pageJs).toContain('"bodyValue"')
    expect(pageJs).toContain('issue-459')
  })
}
