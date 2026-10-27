import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 18

export function registerGithubIssuesBuildCase() {
  it('scoped slot outlet fallback: keeps native named slot projection beside scoped generic outlet', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/scoped-slot-outlet-fallback/index.wxml')
    const componentWxmlPath = path.join(DIST_ROOT, 'components/scoped-slot-outlet-fallback/BackList/index.wxml')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const componentWxml = await fs.readFile(componentWxmlPath, 'utf-8')

    expect(pageWxml).toContain('back-list class="scoped-slot-outlet-fallback-card"')
    expect(pageWxml).toContain('slot="main"')
    expect(pageWxml).toContain('slot="footer"')
    expect(pageWxml).not.toContain('generic:scoped-slots-main=')
    expect(componentWxml).toContain('<scoped-slots-main wx:if="{{__wvSlotOwnerId}}"')
    expect(componentWxml).toContain('<block wx:if="{{!__wvSlotOwnerId}}"><slot name="main" /></block>')
    expect(componentWxml).toContain('<scoped-slots-footer wx:if="{{__wvSlotOwnerId}}"')
    expect(componentWxml).toContain('<block wx:if="{{!__wvSlotOwnerId}}"><slot name="footer" /></block>')
    expect(componentWxml).toContain(`__wvSlotProps="{{['list',back.state.list]}}"`)
    expect(componentWxml).not.toContain('<slot name="main" /><scoped-slots-main')
  })
}
