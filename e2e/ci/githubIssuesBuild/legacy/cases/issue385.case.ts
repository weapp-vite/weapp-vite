import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 63

export function registerGithubIssuesBuildCase() {
  it('issue #385: initializes native default layout state and short-circuits duplicate setPageLayout updates', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-385/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-385/index.js')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')

    expect(pageWxml).toContain('<attach-probe id="attach-probe" />')
    expect(pageWxml).toContain(`!__wv_page_layout_name || __wv_page_layout_name === 'default'`)
    expect(pageJs).toMatch(/__wv_page_layout_name:\s*[`'"]default[`'"]/)
    expect(pageJs).toMatch(/__wv_page_layout_props:\s*\{\}/)
    expect(pageJs).toContain('Object.keys(__wv_current_layout_props).every(')
    expect(pageJs).toContain('Object.keys(__wv_current_layout_props).length === Object.keys(__wv_next_layout_props).length')
    expect(pageJs).toContain('this.setData({')
  })
}
