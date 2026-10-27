import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 39

export function registerGithubIssuesBuildCase() {
  it('issue #555: keeps slot attribute on v-if single root content instead of generated block', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-555/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-555/index.js')
    const componentWxmlPath = path.join(DIST_ROOT, 'components/issue-555/SlotCell/index.wxml')

    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const componentWxml = await fs.readFile(componentWxmlPath, 'utf-8')
    const conditionalTextSlotStart = pageWxml.indexOf('<block wx:if="{{value}}"><text')
    const conditionalTextSlotEnd = pageWxml.indexOf('{{value}}</text></block>', conditionalTextSlotStart)
    const conditionalTextSlot = pageWxml.slice(conditionalTextSlotStart, conditionalTextSlotEnd)

    expect(conditionalTextSlotStart).toBeGreaterThanOrEqual(0)
    expect(conditionalTextSlotEnd).toBeGreaterThan(conditionalTextSlotStart)
    expect(conditionalTextSlot).toContain('slot="text"')
    expect(pageWxml).toContain('data-probe="conditional-text"')
    expect(pageWxml).toContain('{{value}}</text></block>')
    expect(pageWxml).not.toContain('<block slot="text"')
    expect(pageWxml).not.toContain('<view slot="text">')
    expect(pageJs).toContain('toggleValue')
    expect(pageJs).toContain('_runE2E')
    expect(componentWxml).toContain('<slot name="text" />')
  })
}
