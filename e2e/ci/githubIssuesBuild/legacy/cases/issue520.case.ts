import type { Page as PageJson } from '@weapp-core/schematics'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 14

export function registerGithubIssuesBuildCase() {
  it('issue #520: injects slot metadata for resolver-imported wevu components', async () => {
    await runBuild()

    const pageJsonPath = path.join(DIST_ROOT, 'pages/issue-520/index.json')
    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-520/index.wxml')
    const pageJson = await fs.readJson(pageJsonPath) as PageJson
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')

    expect(pageJson.usingComponents).toMatchObject({
      'issue520-resolver-slot-card': '/components/issue-520/ResolverSlotCard/index',
    })
    expect(pageWxml).toContain('issue520-resolver-slot-card vue-slots="{{ {header:true,default:true} }}"')
    expect(pageWxml).not.toContain('vue-slots="{{{')
    expect(pageWxml).not.toContain('vue-slots="{{ {[')
    expect(pageWxml).toContain('issue-520 resolver slot header')
    expect(pageWxml).toContain('issue-520 resolver slot default')
  })
}
