import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 15

export function registerGithubIssuesBuildCase() {
  it('issue #651: resolves custom resolver SFC entries without relying on .vue suffix in resolvedId', async () => {
    await runBuild()

    const pageJsonPath = path.join(DIST_ROOT, 'pages/issue-651/index.json')
    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-651/index.wxml')
    const noExtComponentWxmlPath = path.join(DIST_ROOT, 'issue-fixtures/issue-651/ResolverNoExt/index.wxml')
    const noExtComponentWxssPath = path.join(DIST_ROOT, 'issue-fixtures/issue-651/ResolverNoExt/index.wxss')
    const withExtComponentWxssPath = path.join(DIST_ROOT, 'issue-fixtures/issue-651/ResolverWithExt/index.wxss')
    const pageJson = await fs.readJson(pageJsonPath) as { usingComponents?: Record<string, string> }
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const noExtComponentWxml = await fs.readFile(noExtComponentWxmlPath, 'utf-8')
    const noExtComponentWxss = await fs.readFile(noExtComponentWxssPath, 'utf-8')
    const withExtComponentWxss = await fs.readFile(withExtComponentWxssPath, 'utf-8')

    expect(pageJson.usingComponents).toMatchObject({
      'issue651-resolver-no-ext': '/issue-fixtures/issue-651/ResolverNoExt/index',
      'issue651-resolver-with-ext': '/issue-fixtures/issue-651/ResolverWithExt/index',
    })
    expect(pageWxml).toContain('issue651-resolver-no-ext vue-slots="{{ {default:true} }}"')
    expect(pageWxml).not.toContain('vue-slots="{{{')
    expect(pageWxml).not.toContain('vue-slots="{{ {[')
    expect(pageWxml).toContain('issue651-resolver-with-ext')
    expect(noExtComponentWxml).toContain('<slot />')
    expect(noExtComponentWxss).toContain('.issue651-no-ext')
    expect(withExtComponentWxss).toContain('.issue651-with-ext')
  })
}
