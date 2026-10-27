import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 43

export function registerGithubIssuesBuildCase() {
  it('issue #599: prefers props named data in generated computed bindings', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-599/index.wxml')
    const pageJsonPath = path.join(DIST_ROOT, 'pages/issue-599/index.json')
    const componentWxmlPath = path.join(DIST_ROOT, 'components/issue-599/DataPropProbe/index.wxml')
    const componentJsPath = path.join(DIST_ROOT, 'components/issue-599/DataPropProbe/index.js')

    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJson = await fs.readJSON(pageJsonPath) as {
      usingComponents?: Record<string, string>
    }
    const componentWxml = await fs.readFile(componentWxmlPath, 'utf-8')
    const componentJs = await fs.readFile(componentJsPath, 'utf-8')

    expect(pageWxml).toContain('issue-599 data prop computed')
    expect(pageJson.usingComponents?.['data-prop-probe']).toBe('/components/issue-599/DataPropProbe/index')
    expect(componentWxml).toContain('data-issue599-label="{{data.label}}"')
    expect(componentWxml).toMatch(/style="\{\{__wv_style_\d+\}\}"/)
    expect(componentJs).toContain('allowNullPropInput: true')
    expect(componentJs).toContain('this.data')
    expect(componentJs).toContain('props: { data: {')
    expect(componentJs).toContain('__wevuPropsDerivedKeys: ["data"]')
  })
}
