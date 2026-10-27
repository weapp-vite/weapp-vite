import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 49

export function registerGithubIssuesBuildCase() {
  it('issue #502: keeps structural directives on slot outlet elements', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-502/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-502/index.js')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')

    expect(pageWxml).toContain('issue-502 slot condition outlet')
    expect(pageWxml).toContain('<block wx:if="{{abc}}"><scoped-slots-default wx:if="{{__wvSlotOwnerId}}"')
    expect(pageWxml).toContain('<block wx:elif="{{efg}}"><scoped-slots-default wx:if="{{__wvSlotOwnerId}}"')
    expect(pageWxml).toContain('<block wx:else><scoped-slots-default wx:if="{{__wvSlotOwnerId}}"')
    expect(pageWxml).toContain('<block wx:else><slot /></block></block><block wx:elif="{{efg}}">')
    expect(pageWxml).toContain('<block wx:else><slot /></block></block><block wx:else>')
    expect(pageWxml).toContain('<block wx:else><slot /></block></block><view class="issue502-action"')
    expect(pageWxml).not.toContain('<slot /><slot /><slot />')
    expect(pageJs).toContain('toggleBranch')
    expect(pageJs).toContain('_runE2E')
  })
}
