import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 38

export function registerGithubIssuesBuildCase() {
  it('issue #494: removes synthetic view wrappers from plain template v-slot content when possible', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-494/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-494/index.js')
    const componentWxmlPath = path.join(DIST_ROOT, 'components/issue-494/SlotHost/index.wxml')

    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const componentWxml = await fs.readFile(componentWxmlPath, 'utf-8')

    expect(pageWxml).toContain('slot="icon"')
    expect(pageWxml).toContain('data-probe="single-image"')
    expect(pageWxml).toContain('src="{{iconSrc}}"')
    expect(pageWxml).toContain('<weapp-slot-wrapper slot="header"><view class="issue494-header-probe"')
    expect(pageWxml).toContain('header via template slot: {{headerLabel}}')
    expect(pageWxml).toContain('default via template slot: {{bodyLabel}}')
    expect(pageWxml).not.toContain('<view slot="icon">')
    expect(pageWxml).not.toContain('<block slot="header">')
    expect(pageJs).toContain('toggleLabels')
    expect(pageJs).toContain('_runE2E')
    expect(componentWxml).toContain('<slot name="icon" />')
    expect(componentWxml).toContain('<slot name="header" />')
    expect(componentWxml).toContain('<slot />')
  })
}
