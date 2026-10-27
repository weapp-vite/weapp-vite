import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'
import { resolveSharedRuntimeImport } from '../helpers'

export const group = 'standard'
export const order = 80

export function registerGithubIssuesBuildCase() {
  it('issue #317: keeps shared chunk duplication in subpackages without invalid self or runtime imports', async () => {
    await runBuild()

    const itemSharedPath = path.join(DIST_ROOT, 'subpackages/item/weapp-shared/common.js')
    const userSharedPath = path.join(DIST_ROOT, 'subpackages/user/weapp-shared/common.js')
    const itemRuntimePath = path.join(DIST_ROOT, 'subpackages/item/rolldown-runtime.js')
    const userRuntimePath = path.join(DIST_ROOT, 'subpackages/user/rolldown-runtime.js')
    const fallbackUnderscorePath = path.join(DIST_ROOT, 'subpackages_item_subpackages_user/common.js')
    const fallbackPlusPath = path.join(DIST_ROOT, 'subpackages_item+subpackages_user/common.js')

    const itemShared = await fs.readFile(itemSharedPath, 'utf-8')
    const userShared = await fs.readFile(userSharedPath, 'utf-8')
    const itemVendorRuntimePath = resolveSharedRuntimeImport(itemSharedPath, itemShared)
    const userVendorRuntimePath = resolveSharedRuntimeImport(userSharedPath, userShared)

    expect(itemShared).not.toMatch(/(?:require\((['"`])\.\.\/\.\.\/rolldown-runtime\.js\1\)|from\s+(['"`])\.\.\/\.\.\/rolldown-runtime\.js\2)/)
    expect(userShared).not.toMatch(/(?:require\((['"`])\.\.\/\.\.\/rolldown-runtime\.js\1\)|from\s+(['"`])\.\.\/\.\.\/rolldown-runtime\.js\2)/)
    expect(itemShared).not.toMatch(/(?:require\((['"`])\.\.\/\.\.\/common\.js\1\)|from\s+(['"`])\.\.\/\.\.\/common\.js\2)/)
    expect(userShared).not.toMatch(/(?:require\((['"`])\.\.\/\.\.\/common\.js\1\)|from\s+(['"`])\.\.\/\.\.\/common\.js\2)/)

    expect(itemShared).not.toMatch(/require\((['"`]).*subpackages_item.*subpackages_user\/common\.js\1\)/)
    expect(userShared).not.toMatch(/require\((['"`]).*subpackages_item.*subpackages_user\/common\.js\1\)/)
    expect(itemVendorRuntimePath).toBeDefined()
    expect(userVendorRuntimePath).toBeDefined()
    expect(itemVendorRuntimePath).toContain(`${path.sep}weapp-vendors${path.sep}`)
    expect(userVendorRuntimePath).toContain(`${path.sep}weapp-vendors${path.sep}`)

    expect(await fs.pathExists(fallbackUnderscorePath)).toBe(false)
    expect(await fs.pathExists(fallbackPlusPath)).toBe(false)
    expect(await fs.pathExists(itemRuntimePath)).toBe(true)
    expect(await fs.pathExists(userRuntimePath)).toBe(true)
  })
}
