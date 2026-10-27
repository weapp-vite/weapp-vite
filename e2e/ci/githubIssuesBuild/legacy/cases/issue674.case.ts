import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 27

export function registerGithubIssuesBuildCase() {
  it('issue #674: injects vueSlots into slot-aware components without declared props', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-674/index.wxml')
    const slotProbeWxmlPath = path.join(DIST_ROOT, 'components/issue-674/SlotProbe/index.wxml')
    const slotProbeJsPath = path.join(DIST_ROOT, 'components/issue-674/SlotProbe/index.js')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const slotProbeWxml = await fs.readFile(slotProbeWxmlPath, 'utf-8')
    const slotProbeJs = await fs.readFile(slotProbeJsPath, 'utf-8')

    expect(pageWxml).toContain('issue674-slot-probe')
    expect(pageWxml).toContain('vue-slots=')
    expect(pageWxml).toContain('header:true')
    expect(pageWxml).toContain('default:true')
    expect(slotProbeWxml).toContain('<slot />')
    expect(slotProbeWxml).toContain('<slot name="header" />')
    expect(slotProbeWxml).not.toContain('vueSlots&&vueSlots')
    expect(slotProbeJs).toContain('"vueSlots"')
    expect(slotProbeJs).toContain('"__wvSlotOwnerId"')
    expect(slotProbeJs).toContain('"__wvSlotScope"')
  })
}
