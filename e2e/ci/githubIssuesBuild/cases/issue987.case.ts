import type { GithubIssuesBuildCaseContext } from './types'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'

export function registerGithubIssuesBuildCase(context: GithubIssuesBuildCaseContext) {
  it('issue #987: falls back parenthesized member access to runtime bindings', async () => {
    await context.runStandardBuild()

    const wxml = await fs.readFile(path.join(context.distRoot, 'pages/issue-987/index.wxml'), 'utf8')
    const normalized = wxml.replace(/\s/g, '')

    expect(normalized).not.toMatch(/\)\.length/)
    expect(normalized).not.toMatch(/\)\[/)
    expect(wxml).toMatch(/data-empty="\{\{__wv_bind_\d+\}\}"/)
    expect(wxml).toMatch(/wx:if="\{\{__wv_bind_\d+\}\}"/)
    expect(wxml).toMatch(/\{\{__wv_bind_\d+\}\}/)
  })
}
