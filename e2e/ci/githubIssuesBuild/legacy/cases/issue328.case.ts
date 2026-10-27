import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 84

export function registerGithubIssuesBuildCase() {
  it('issue #328: keeps setup ref props available on first paint for child string props', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-328/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-328/index.js')
    const probeWxmlPath = path.join(DIST_ROOT, 'components/issue-328/ValueProbe/index.wxml')
    const probeJsPath = path.join(DIST_ROOT, 'components/issue-328/ValueProbe/index.js')

    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')
    const probeWxml = await fs.readFile(probeWxmlPath, 'utf-8')
    const probeJs = await fs.readFile(probeJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-328 setup ref prop first paint')
    expect(issuePageWxml).toContain('value-probe')
    expect(issuePageWxml).toContain('issue328-toggle')
    expect(issuePageWxml).toContain('toggle value: {{value1}}')
    expect(issuePageWxml).toContain('value="{{value1}}"')
    expect(issuePageJs).toContain('value1')
    expect(issuePageJs).toContain('advanceValue')
    expect(issuePageJs).toContain('_runE2E')
    expect(issuePageJs).toContain('111')
    expect(issuePageJs).toContain('222')

    expect(probeWxml).toContain('data-current-value="{{props.value}}"')
    expect(probeWxml).toContain('data-history="{{historyText}}"')
    expect(probeWxml).toContain('{{historyText}}')
    expect(probeJs).toContain('valueHistory')
    expect(probeJs).toContain('historyText')
    expect(probeJs).toMatch(/default:\s*['"`]0\.00['"`]/)
  })
}
