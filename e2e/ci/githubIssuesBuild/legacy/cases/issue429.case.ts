import type { Page as PageJson } from '@weapp-core/schematics'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 13

export function registerGithubIssuesBuildCase() {
  it('issue #429: prefers local component auto import and warns when name collides with a builtin component tag', async () => {
    await runBuild()

    const pageJsonPath = path.join(DIST_ROOT, 'pages/issue-429/index.json')
    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-429/index.wxml')
    const pageJson = await fs.readJson(pageJsonPath) as PageJson
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')

    expect(pageWxml).toContain('issue-429 builtin-name auto import')
    expect(pageJson.usingComponents).toMatchObject({
      'list-view': '/components/issue-429/list-view/index',
    })
  })
}
