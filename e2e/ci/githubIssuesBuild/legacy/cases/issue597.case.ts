import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'
import { stripGeneratedScopeAttrs } from '../helpers'

export const group = 'standard'
export const order = 45

export function registerGithubIssuesBuildCase() {
  it('issue #597: preserves same-name conditional slot branches', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-597/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-597/index.js')
    const componentWxmlPath = path.join(DIST_ROOT, 'components/issue-597/Issue597Card/index.wxml')

    const pageWxml = stripGeneratedScopeAttrs(await fs.readFile(pageWxmlPath, 'utf-8'))
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const componentWxml = await fs.readFile(componentWxmlPath, 'utf-8')

    expect(pageWxml).toContain('issue597-card vue-slots="{{ {header:true} }}"')
    expect(pageWxml).not.toContain('vue-slots="{{{')
    expect(pageWxml).not.toContain('vue-slots="{{ {[')
    expect(pageWxml).toContain('<block wx:if="{{abc}}"><view slot="header" class="issue597-header-a" data-issue597-branch="if">header if branch</view></block>')
    expect(pageWxml).toContain('<block wx:else><text slot="header" class="issue597-header-b" data-issue597-branch="else">header else branch</text></block>')
    expect(pageWxml).not.toContain('<text slot="header" class="issue597-header-b" data-issue597-branch="else" />\n</issue597-card>')
    expect(pageJs).toContain('_runE2E')
    expect(componentWxml).toContain('<slot name="header" />')
  })
}
