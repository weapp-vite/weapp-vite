import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 42

export function registerGithubIssuesBuildCase() {
  it('issue #590: compiles props-based class/style bindings for components without setup', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-590/index.wxml')
    const pageJsonPath = path.join(DIST_ROOT, 'pages/issue-590/index.json')
    const componentWxmlPath = path.join(DIST_ROOT, 'components/issue-590/SimpleBadge/index.wxml')
    const componentJsPath = path.join(DIST_ROOT, 'components/issue-590/SimpleBadge/index.js')

    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJson = await fs.readJSON(pageJsonPath) as {
      usingComponents?: Record<string, string>
    }
    const componentWxml = await fs.readFile(componentWxmlPath, 'utf-8')
    const componentJs = await fs.readFile(componentJsPath, 'utf-8')

    expect(pageWxml).toContain('issue-590 no setup props computed style')
    expect(pageJson.usingComponents?.['simple-badge']).toBe('/components/issue-590/SimpleBadge/index')
    expect(componentWxml).toContain('id="issue590-badge"')
    expect(componentWxml).toMatch(/class="\{\{__wv_cls_\d+\}\}"/)
    expect(componentWxml).toMatch(/style="\{\{__wv_style_\d+\}\}"/)
    expect(componentJs).toMatch(/__wv_cls_\d+/)
    expect(componentJs).toMatch(/__wv_style_\d+/)
    expect(componentJs).toContain('__wevuProps')
    expect(componentJs).toContain('issue590-badge')
    expect(componentJs).toContain('issue-590 badge')
  })
}
