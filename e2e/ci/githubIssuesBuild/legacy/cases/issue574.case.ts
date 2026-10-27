import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'
import { stripGeneratedScopeAttrs } from '../helpers'

export const group = 'standard'
export const order = 40

export function registerGithubIssuesBuildCase() {
  it('issue #574: preserves template slot output order around implicit default children', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-574/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-574/index.js')
    const componentWxmlPath = path.join(DIST_ROOT, 'components/issue-574/VanCell/index.wxml')

    const pageWxml = stripGeneratedScopeAttrs(await fs.readFile(pageWxmlPath, 'utf-8'))
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const componentWxml = await fs.readFile(componentWxmlPath, 'utf-8')
    const defaultIndex = pageWxml.indexOf('data-order="default"')
    const footer1Index = pageWxml.indexOf('data-order="footer1"')
    const footer2Index = pageWxml.indexOf('data-order="footer2"')

    expect(defaultIndex).toBeGreaterThanOrEqual(0)
    expect(footer1Index).toBeGreaterThan(defaultIndex)
    expect(footer2Index).toBeGreaterThan(footer1Index)
    expect(pageWxml).toContain('van-cell vue-slots="{{ {footer1:true,footer2:true,default:true} }}"')
    expect(pageWxml).not.toContain('vue-slots="{{{')
    expect(pageWxml).not.toContain('vue-slots="{{ {[')
    expect(pageWxml).toContain('<view slot="footer1" class="issue574-footer1" data-order="footer1" />')
    expect(pageWxml).toContain('<text slot="footer2" class="issue574-footer2" data-order="footer2" />')
    expect(pageJs).toContain('_runE2E')
    expect(componentWxml).toContain('<slot />')
    expect(componentWxml).toContain('<slot name="footer1" />')
    expect(componentWxml).toContain('<slot name="footer2" />')
  })
}
