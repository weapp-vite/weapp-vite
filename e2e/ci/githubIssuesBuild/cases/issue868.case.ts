import type { GithubIssuesBuildCaseContext } from './types'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'

export function registerGithubIssuesBuildCase(context: GithubIssuesBuildCaseContext) {
  it('issue #868: preserves nested member paths in v-for keys', async () => {
    await context.runStandardBuild()

    const pageWxml = await fs.readFile(
      path.join(context.distRoot, 'pages/issue-868/index.wxml'),
      'utf8',
    )

    expect(pageWxml).toContain('wx:key="__wv_key_0"')
    expect(pageWxml).not.toContain('wx:key="item.id"')
    expect(pageWxml).not.toContain('wx:key="item"')
  })
}
