import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'
import { createObjectPropertyPattern, expectProductionEnvironment } from '../helpers'

export const group = 'standard'
export const order = 11

export function registerGithubIssuesBuildCase() {
  it('issue #431: replaces import.meta.env expressions inside native wxml files', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-431/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-431/index.js')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')

    expect(pageWxml).toContain('{{\'issue-431 native wxml env replacement\'}}')
    expect(pageWxml).toContain('{{\'https://static.example.com/issue-431\'}}/logo.png')
    expect(pageWxml).toContain('data-case="double"')
    expect(pageWxml).toContain('data-template-url="{{\'/pages/issue-431/index.wxml\'}}"')
    expect(pageWxml).toContain('data-template-dir="{{\'/pages/issue-431\'}}"')
    expect(pageWxml).toContain('data-env-label="{{\'issue-431 native wxml env replacement\'}}"')
    expect(pageWxml).toContain('data-env-base="{{\'https://static.example.com/issue-431\'}}"')
    expect(pageWxml).toContain('data-case=\'single\'')
    expect(pageWxml).toContain('data-template-url=\'{{"/pages/issue-431/index.wxml"}}\'')
    expect(pageWxml).toContain('data-template-dir=\'{{"/pages/issue-431"}}\'')
    expect(pageWxml).toContain('data-env-label=\'{{"issue-431 native wxml env replacement"}}\'')
    expect(pageWxml).toContain('data-env-base=\'{{"https://static.example.com/issue-431"}}\'')
    expect(pageWxml).not.toContain('import.meta.env')
    expect(pageWxml).not.toContain('import.meta.url')
    expect(pageWxml).not.toContain('import.meta.dirname')
    expect(pageJs).toContain('/pages/issue-431/index.js')
    expect(pageJs).toContain('/pages/issue-431')
    expect(pageJs).toContain('importMetaSnapshot')
    expect(pageJs).toMatch(createObjectPropertyPattern('url', '/pages/issue-431/index.js'))
    expectProductionEnvironment(pageJs)
    expect(pageJs).not.toContain('import.meta.url')
    expect(pageJs).not.toContain('import.meta.dirname')
    expect(pageJs).not.toContain('import.meta.env')
  })
}
