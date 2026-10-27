import type { AppJsonWithSubPackages } from '../types'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runIssue595ScopedBuild } from '../builders/issue595ScopedBuild'
import { ISSUE_595_DIST_ROOT } from '../constants'
import { scanFiles } from '../helpers'

export const group = 'issue595'
export const order = 47

export function registerGithubIssuesBuildCase() {
  it('issue #595: builds scoped main package and selected subpackage only', async () => {
    await runIssue595ScopedBuild()

    const appJson = await fs.readJSON(path.join(ISSUE_595_DIST_ROOT, 'app.json')) as AppJsonWithSubPackages
    const subPackageRoots = (appJson.subPackages ?? appJson.subpackages ?? []).map(entry => entry.root)
    const files = await scanFiles(ISSUE_595_DIST_ROOT)

    expect(appJson.pages).toContain('pages/block-slot/index')
    expect(appJson.pages).toContain('pages/issue-590/index')
    expect(subPackageRoots).toEqual(['subpackages/item'])
    expect(files).toContain('pages/issue-590/index.js')
    expect(files).toContain('subpackages/item/index.js')
    expect(files).toContain('subpackages/item/login-required/index.js')
    expect(files).not.toContain('subpackages/user/index.js')
    expect(files).not.toContain('subpackages/issue-466/index.js')
  })
}
