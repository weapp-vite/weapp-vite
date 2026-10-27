import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { findMarkupElements } from '../../markup'
import { runSlotFallbackCompilerOffBuild } from '../builders/slotFallbackCompilerOffBuild'
import { SLOT_FALLBACK_COMPILER_OFF_DIST_ROOT } from '../constants'

export const group = 'slotCompilerOff'
export const order = 19

export function registerGithubIssuesBuildCase() {
  it('slot fallback compiler off: keeps plain fallback guards independent from scoped slot compiler', async () => {
    await runSlotFallbackCompilerOffBuild()

    const pageWxmlPath = path.join(SLOT_FALLBACK_COMPILER_OFF_DIST_ROOT, 'pages/slot-fallback-compiler-off/index.wxml')
    const componentWxmlPath = path.join(SLOT_FALLBACK_COMPILER_OFF_DIST_ROOT, 'components/slot-fallback-compiler-off/PlainSlotFallbackCard/index.wxml')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const componentWxml = await fs.readFile(componentWxmlPath, 'utf-8')

    expect(findMarkupElements(pageWxml, 'plain-slot-fallback-card').map(node => node.attribs)).toContainEqual(expect.objectContaining({
      'class': 'slot-fallback-off-card-provided',
      'vue-slots': '{{ {header:true,default:true} }}',
    }))
    expect(pageWxml).not.toContain('vue-slots="{{{')
    expect(pageWxml).not.toContain('vue-slots="{{ {[')
    expect(pageWxml).not.toContain('generic:scoped-slots-')
    expect(componentWxml).toContain(`<block wx:if="{{vueSlots&&vueSlots.header}}">`)
    expect(componentWxml).toContain('<slot name="header" />')
    expect(componentWxml).toContain('class="slot-fallback-off-fallback-header" data-slot-fallback-off-case="fallback-header"')
    expect(componentWxml).toContain('slot-fallback-compiler-off fallback header')
    expect(componentWxml).toContain(`<block wx:if="{{vueSlots&&vueSlots.default}}">`)
    expect(componentWxml).toContain('<slot />')
    expect(componentWxml).toContain('class="slot-fallback-off-fallback-default" data-slot-fallback-off-case="fallback-default"')
    expect(componentWxml).toContain('{{fallbackDefault}}')
    expect(componentWxml).not.toContain('<slot name="header"><text class="slot-fallback-off-fallback-header">')
    expect(componentWxml).not.toContain('<slot><text class="slot-fallback-off-fallback-default">')
  })
}
