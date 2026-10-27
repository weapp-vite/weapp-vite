import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { findMarkupElements } from '../../markup'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 16

export function registerGithubIssuesBuildCase() {
  it('issue #528: compiles slot fallback content to conditional wxml branches', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-528/index.wxml')
    const componentWxmlPath = path.join(DIST_ROOT, 'components/issue-528/SlotFallbackCard/index.wxml')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const componentWxml = await fs.readFile(componentWxmlPath, 'utf-8')

    expect(findMarkupElements(pageWxml, 'issue528-slot-fallback-card').map(node => node.attribs)).toContainEqual(expect.objectContaining({
      'class': 'issue528-card-provided',
      'vue-slots': '{{ {header:true,default:true} }}',
    }))
    expect(pageWxml).not.toContain('vue-slots="{{{')
    expect(pageWxml).not.toContain('vue-slots="{{ {[')
    expect(pageWxml).not.toContain('vue-slot-flags')
    expect(componentWxml).toContain(`<block wx:if="{{vueSlots&&vueSlots.header}}">`)
    expect(componentWxml).toContain('<slot name="header" /></block><block wx:else><text class="issue528-fallback-header">issue-528 fallback header</text></block>')
    expect(componentWxml).toContain(`<block wx:if="{{vueSlots&&vueSlots.default}}">`)
    expect(componentWxml).toContain('<slot /></block><block wx:else><text class="issue528-fallback-default">{{fallbackDefault}}</text></block>')
    expect(componentWxml).not.toContain('vueSlots[')
    expect(componentWxml).not.toContain('<slot name="header"><text class="issue528-fallback-header">')
    expect(componentWxml).not.toContain('<slot><text class="issue528-fallback-default">')
  })
}
