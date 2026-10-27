import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runIssue642Build } from '../build/issue642Build'
import { ISSUE_642_DIST_ROOT } from '../constants'
import { expectSetDataPickKeys } from '../helpers'

export const group = 'issue642'
export const order = 26

export function registerGithubIssuesBuildCase() {
  it('issue #642: keeps compiler-owned props and slot bridge bindings in performance setData pick', async () => {
    await runIssue642Build()

    const pageWxmlPath = path.join(ISSUE_642_DIST_ROOT, 'pages/issue-642/index.wxml')
    const pageJsPath = path.join(ISSUE_642_DIST_ROOT, 'pages/issue-642/index.js')
    const scopedSlotWxmlPath = path.join(ISSUE_642_DIST_ROOT, 'pages/issue-642/index.__scoped-slot-default-0.wxml')
    const slotProbeWxmlPath = path.join(ISSUE_642_DIST_ROOT, 'components/issue-642/SlotProbe/index.wxml')
    const slotProbeJsPath = path.join(ISSUE_642_DIST_ROOT, 'components/issue-642/SlotProbe/index.js')
    const scopedProbeWxmlPath = path.join(ISSUE_642_DIST_ROOT, 'components/issue-642/ScopedSlotProbe/index.wxml')
    const scopedProbeJsPath = path.join(ISSUE_642_DIST_ROOT, 'components/issue-642/ScopedSlotProbe/index.js')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const scopedSlotWxml = await fs.readFile(scopedSlotWxmlPath, 'utf-8')
    const slotProbeWxml = await fs.readFile(slotProbeWxmlPath, 'utf-8')
    const slotProbeJs = await fs.readFile(slotProbeJsPath, 'utf-8')
    const scopedProbeWxml = await fs.readFile(scopedProbeWxmlPath, 'utf-8')
    const scopedProbeJs = await fs.readFile(scopedProbeJsPath, 'utf-8')

    expect(pageWxml).toContain('issue642-slot-probe')
    expect(pageWxml).toContain('vue-slots="{{ {header:true,default:true} }}"')
    expect(pageWxml).toContain('vue-slots="{{ {default:true} }}"')
    expect(pageWxml).not.toContain('vue-slots="{{{')
    expect(pageWxml).not.toContain('vue-slots="{{ {[')
    expect(pageWxml).toContain('generic:scoped-slots-default=')
    expectSetDataPickKeys(pageJs, ['vueSlots', '__wvSlotOwnerId', '__wvSlotScope'])
    expectSetDataPickKeys(pageJs, ['__wv_bind_0', '__wv_bind_839'])
    expect(scopedSlotWxml).toContain('data-issue642-slot-state="scoped-provided"')
    expect(scopedSlotWxml).toContain('data-issue642-scoped-value="{{__wvSlotPropsData.io}}"')
    expect(scopedSlotWxml).toContain('{{__wvSlotPropsData.io}}')
    expect(slotProbeWxml).toContain(`<block wx:if="{{vueSlots&&vueSlots.header}}">`)
    expect(slotProbeWxml).toContain(`<block wx:if="{{vueSlots&&vueSlots.default}}">`)
    expect(slotProbeJs).toContain('"vueSlots"')
    expectSetDataPickKeys(slotProbeJs, ['vueSlots', '__wvSlotOwnerId', '__wvSlotScope'])
    expect(scopedProbeWxml).toContain('<scoped-slots-default wx:if="{{__wvSlotOwnerId}}"')
    expect(scopedProbeWxml).toContain(`__wvSlotProps="{{['io',1234]}}"`)
    expect(scopedProbeJs).toContain('"__wvSlotOwnerId"')
    expect(scopedProbeJs).toContain('"__wvSlotScope"')
    expectSetDataPickKeys(scopedProbeJs, ['vueSlots', '__wvSlotOwnerId', '__wvSlotScope'])
  })
}
