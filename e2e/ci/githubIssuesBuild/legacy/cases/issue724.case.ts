import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runIssue724Build } from '../builders/issue724Build'
import { ISSUE_724_DIST_ROOT } from '../constants'

export const group = 'issue724'
export const order = 6

export function registerGithubIssuesBuildCase() {
  it('issue #724: keeps Vue SFC script, template, and style requests isolated', async () => {
    await runIssue724Build()

    const pageBase = path.join(ISSUE_724_DIST_ROOT, 'pages/issue-724/index')
    const componentBase = path.join(ISSUE_724_DIST_ROOT, 'components/issue-724/RoutingProbe/index')
    const pageJs = await fs.readFile(`${pageBase}.js`, 'utf-8')
    const pageWxml = await fs.readFile(`${pageBase}.wxml`, 'utf-8')
    const pageWxss = await fs.readFile(`${pageBase}.wxss`, 'utf-8')
    const pageJson = await fs.readJSON(`${pageBase}.json`) as { usingComponents?: Record<string, string> }
    const componentJs = await fs.readFile(`${componentBase}.js`, 'utf-8')
    const componentWxml = await fs.readFile(`${componentBase}.wxml`, 'utf-8')
    const componentWxss = await fs.readFile(`${componentBase}.wxss`, 'utf-8')

    expect(pageJs).toContain('issue-724-script-marker')
    expect(pageWxml).toContain('issue-724-template-marker')
    expect(pageWxml).toContain('<issue724-routing-probe />')
    expect(pageWxss).toContain('.issue-724-page')
    expect(pageWxss).toContain('.issue-724-template-marker')
    expect(pageWxss).toContain('.issue-724-style-src')
    expect(pageWxss).not.toContain('.issue-724-component')
    expect(pageJson.usingComponents).toMatchObject({
      'issue724-routing-probe': '/components/issue-724/RoutingProbe/index',
    })

    expect(componentJs).toContain('issue-724-component-script-marker')
    expect(componentWxml).toContain('issue-724-component-template-marker')
    expect(componentWxss).toContain('.issue-724-component')
    expect(componentWxss).not.toContain('.issue-724-page')

    for (const output of [pageJs, pageWxml, pageWxss, componentJs, componentWxml, componentWxss]) {
      expect(output).not.toMatch(/<(?:template|script|style)(?:\s|>)/)
    }
  })
}
