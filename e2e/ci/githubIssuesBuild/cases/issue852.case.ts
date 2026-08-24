import type { GithubIssuesBuildCaseContext } from './types'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'

export function registerGithubIssuesBuildCase(context: GithubIssuesBuildCaseContext) {
  it('issue #852: normalizes JavaScript numeric literals in WXML expressions', async () => {
    await context.runStandardBuild()

    const wxml = await fs.readFile(path.join(context.distRoot, 'pages/issue-852/index.wxml'), 'utf8')

    expect(wxml).toContain('data-decimal="{{1000000000000}}"')
    expect(wxml).toContain('data-fraction="{{1050.95}}"')
    expect(wxml).toContain('data-binary="{{41349}}"')
    expect(wxml).toContain('data-octal="{{1198}}"')
    expect(wxml).toContain('data-hex="{{10531008}}"')
    expect(wxml).toContain(`data-bigint="{{'1000000000000000000000'}}"`)
    expect(wxml).toContain('{{81985529216486900}}')
    expect(wxml).not.toMatch(/(?:\d_\d|0[bxo]|\d+n\b)/i)
  })
}
