import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'
import { resolveSharedRuntimeImport } from '../helpers'

export const group = 'standard'
export const order = 81

export function registerGithubIssuesBuildCase() {
  it('issue #340: keeps cross-subpackage source imports runnable for item/login-required and user/register/form', async () => {
    await runBuild()

    const appJsonPath = path.join(DIST_ROOT, 'app.json')
    const itemPageJsPath = path.join(DIST_ROOT, 'subpackages/item/login-required/index.js')
    const userPageJsPath = path.join(DIST_ROOT, 'subpackages/user/register/form.js')
    const invalidSharedPageWxmlPath = path.join(DIST_ROOT, 'subpackages/item/issue-340-shared.wxml')
    const itemSharedPath = path.join(DIST_ROOT, 'subpackages/item/weapp-shared/common.js')
    const userSharedPath = path.join(DIST_ROOT, 'subpackages/user/weapp-shared/common.js')
    const itemInvalidCommonPath = path.join(DIST_ROOT, 'subpackages/item/common.js')
    const userInvalidCommonPath = path.join(DIST_ROOT, 'subpackages/user/common.js')
    const itemVendorsPath = path.join(DIST_ROOT, 'subpackages/item/vendors.js')
    const userVendorsPath = path.join(DIST_ROOT, 'subpackages/user/vendors.js')
    const itemRuntimePath = path.join(DIST_ROOT, 'subpackages/item/rolldown-runtime.js')
    const userRuntimePath = path.join(DIST_ROOT, 'subpackages/user/rolldown-runtime.js')

    const appJson = JSON.parse(await fs.readFile(appJsonPath, 'utf-8'))
    const itemPageJs = await fs.readFile(itemPageJsPath, 'utf-8')
    const userPageJs = await fs.readFile(userPageJsPath, 'utf-8')
    const itemShared = await fs.readFile(itemSharedPath, 'utf-8')
    const userShared = await fs.readFile(userSharedPath, 'utf-8')
    const itemVendorRuntimePath = resolveSharedRuntimeImport(itemSharedPath, itemShared)
    const userVendorRuntimePath = resolveSharedRuntimeImport(userSharedPath, userShared)
    const itemSubPackage = (appJson.subPackages ?? appJson.subpackages ?? []).find((entry: any) => entry?.root === 'subpackages/item')

    expect(itemPageJs).toContain('item-login-required:issue-340:shared')
    expect(userPageJs).toContain('user-register-form:issue-340:shared')
    expect(itemPageJs).toMatch(/(?:require\((['"`])\.\.\/weapp-shared\/common(?:\.\d+)?\.js\1\)|from\s+(['"`])\.\.\/weapp-shared\/common(?:\.\d+)?\.js\2)/)
    expect(userPageJs).toMatch(/(?:require\((['"`])\.\.\/weapp-shared\/common(?:\.\d+)?\.js\1\)|from\s+(['"`])\.\.\/weapp-shared\/common(?:\.\d+)?\.js\2)/)
    expect(itemPageJs).not.toMatch(/(?:require\((['"`])\.\.\/\.\.\/\.\.\/common\.js\1\)|from\s+(['"`])\.\.\/\.\.\/\.\.\/common\.js\2)/)
    expect(userPageJs).not.toMatch(/(?:require\((['"`])\.\.\/\.\.\/\.\.\/common\.js\1\)|from\s+(['"`])\.\.\/\.\.\/\.\.\/common\.js\2)/)
    expect(itemPageJs).not.toMatch(/(?:require\((['"`])\.\.\/\.\.\/common(?:\.\d+)?\.js\1\)|from\s+(['"`])\.\.\/\.\.\/common(?:\.\d+)?\.js\2)/)
    expect(userPageJs).not.toMatch(/(?:require\((['"`])\.\.\/\.\.\/common(?:\.\d+)?\.js\1\)|from\s+(['"`])\.\.\/\.\.\/common(?:\.\d+)?\.js\2)/)
    expect(itemPageJs).not.toMatch(/vendors(?:\.\d+)?\.js/)
    expect(userPageJs).not.toMatch(/vendors(?:\.\d+)?\.js/)

    expect(itemShared).toContain('issue-340')
    expect(userShared).toContain('issue-340')
    expect(itemShared).not.toMatch(/(?:require\((['"`])\.\.\/\.\.\/rolldown-runtime\.js\1\)|from\s+(['"`])\.\.\/\.\.\/rolldown-runtime\.js\2)/)
    expect(userShared).not.toMatch(/(?:require\((['"`])\.\.\/\.\.\/rolldown-runtime\.js\1\)|from\s+(['"`])\.\.\/\.\.\/rolldown-runtime\.js\2)/)
    expect(itemShared).not.toMatch(/subpackages_item.*subpackages_user\/common\.js/)
    expect(userShared).not.toMatch(/subpackages_item.*subpackages_user\/common\.js/)
    expect(itemVendorRuntimePath).toBeDefined()
    expect(userVendorRuntimePath).toBeDefined()
    expect(itemVendorRuntimePath).toContain(`${path.sep}weapp-vendors${path.sep}`)
    expect(userVendorRuntimePath).toContain(`${path.sep}weapp-vendors${path.sep}`)

    expect(itemSubPackage?.pages).toEqual([
      'index',
      'issue-769/index',
      'login-required/index',
    ])
    expect(await fs.pathExists(invalidSharedPageWxmlPath)).toBe(false)
    expect(await fs.pathExists(itemInvalidCommonPath)).toBe(false)
    expect(await fs.pathExists(userInvalidCommonPath)).toBe(false)
    expect(await fs.pathExists(itemVendorsPath)).toBe(false)
    expect(await fs.pathExists(userVendorsPath)).toBe(false)
    expect(await fs.pathExists(itemRuntimePath)).toBe(true)
    expect(await fs.pathExists(userRuntimePath)).toBe(true)
  })
}
