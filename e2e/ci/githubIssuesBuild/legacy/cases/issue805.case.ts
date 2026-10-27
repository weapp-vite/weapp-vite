import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 5

export function registerGithubIssuesBuildCase() {
  it('issue #805: lowers optional chaining inside nullish coalescing expressions', async () => {
    await runBuild()

    const pageWxml = await fs.readFile(path.join(DIST_ROOT, 'pages/issue-805/index.wxml'), 'utf-8')

    expect(pageWxml).not.toContain('?.')
    expect(pageWxml).not.toContain('??')
    expect(pageWxml).toContain('a==null?undefined:a.b==null?undefined:a.b.d')
    expect(pageWxml).toContain('!=null?')
    expect(pageWxml).toContain(':4')
  })
}
