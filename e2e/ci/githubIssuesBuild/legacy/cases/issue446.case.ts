import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 68

export function registerGithubIssuesBuildCase() {
  it('issue #446: supports template refs together with Vue 3.4 shortBind syntax', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-446/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-446/index.js')
    const pageJsonPath = path.join(DIST_ROOT, 'pages/issue-446/index.json')
    const componentWxmlPath = path.join(DIST_ROOT, 'components/issue-446/ShortBindProbe/index.wxml')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const pageJson = await fs.readFile(pageJsonPath, 'utf-8')
    const componentWxml = await fs.readFile(componentWxmlPath, 'utf-8')

    expect(pageWxml).toContain('issue-446 template ref and shortBind')
    expect(pageWxml).toContain('__wv-ref-0')
    expect(pageWxml).toContain('visible="{{visible}}"')
    expect(pageWxml).toContain('foo-bar="{{fooBar}}"')
    expect(pageJs).toContain('_runE2E')
    expect(pageJs).toContain('issue-446-short-bind')
    expect(pageJs).toContain('__wevuTemplateRefs')
    expect(pageJs).toContain('name: "nativeAnchor"')
    expect(pageJs).toContain('name: "shortBindProbe"')
    expect(pageJson).toContain('"short-bind-probe": "/components/issue-446/ShortBindProbe/index"')
    expect(componentWxml).toContain('{{props.visible ? \'visible\' : \'hidden\'}}')
    expect(componentWxml).toContain('{{props.fooBar}}')
  })
}
