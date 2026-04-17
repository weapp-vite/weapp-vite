import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/issue-340-hoist')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

async function runBuild() {
  await fs.remove(DIST_ROOT)

  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: 'ci:issue-340-hoist',
    skipNpm: true,
  })
}

describe.sequential('e2e app: issue-340-hoist (build)', () => {
  it('keeps cross-subpackage source imports stable when sharedStrategy is hoist', async () => {
    await runBuild()

    const itemPageJsPath = path.join(DIST_ROOT, 'subpackages/item/login-required/index.js')
    const userPageJsPath = path.join(DIST_ROOT, 'subpackages/user/register/form.js')
    const rootCommonPath = path.join(DIST_ROOT, 'common.js')
    const itemInvalidCommonPath = path.join(DIST_ROOT, 'subpackages/item/common.js')
    const userInvalidCommonPath = path.join(DIST_ROOT, 'subpackages/user/common.js')
    const itemSharedPath = path.join(DIST_ROOT, 'subpackages/item/weapp-shared/common.js')
    const userSharedPath = path.join(DIST_ROOT, 'subpackages/user/weapp-shared/common.js')
    const rootVendorsPath = path.join(DIST_ROOT, 'vendors.js')
    const itemVendorsPath = path.join(DIST_ROOT, 'subpackages/item/vendors.js')
    const userVendorsPath = path.join(DIST_ROOT, 'subpackages/user/vendors.js')
    const itemRuntimePath = path.join(DIST_ROOT, 'subpackages/item/rolldown-runtime.js')
    const userRuntimePath = path.join(DIST_ROOT, 'subpackages/user/rolldown-runtime.js')
    const rootWevuDefinePropertyPath = path.join(DIST_ROOT, 'weapp-vendors/wevu-defineProperty.js')

    const itemPageJs = await fs.readFile(itemPageJsPath, 'utf-8')
    const userPageJs = await fs.readFile(userPageJsPath, 'utf-8')
    const rootWevuDefinePropertyJs = await fs.readFile(rootWevuDefinePropertyPath, 'utf-8')
    expect(itemPageJs).toContain('item-login-required:issue-340-hoist:shared')
    expect(userPageJs).toContain('user-register-form:issue-340-hoist:shared')
    expect(rootWevuDefinePropertyJs).toContain('useIssue340SharedMessage')
    expect(rootWevuDefinePropertyJs).toContain('issue-340-hoist')

    expect(itemPageJs).toMatch(/require\((['"`])\.\.\/\.\.\/\.\.\/weapp-vendors\/wevu-defineProperty\.js\1\)/)
    expect(userPageJs).toMatch(/require\((['"`])\.\.\/\.\.\/\.\.\/weapp-vendors\/wevu-defineProperty\.js\1\)/)
    expect(itemPageJs).not.toMatch(/weapp-shared\/common(?:\.\d+)?\.js/)
    expect(userPageJs).not.toMatch(/weapp-shared\/common(?:\.\d+)?\.js/)
    expect(itemPageJs).not.toMatch(/require\((['"`])\.\.\/\.\.\/common(?:\.\d+)?\.js\1\)/)
    expect(userPageJs).not.toMatch(/require\((['"`])\.\.\/\.\.\/common(?:\.\d+)?\.js\1\)/)
    expect(itemPageJs).not.toMatch(/vendors(?:\.\d+)?\.js/)
    expect(userPageJs).not.toMatch(/vendors(?:\.\d+)?\.js/)

    expect(await fs.pathExists(rootCommonPath)).toBe(false)
    expect(await fs.pathExists(itemInvalidCommonPath)).toBe(false)
    expect(await fs.pathExists(userInvalidCommonPath)).toBe(false)
    expect(await fs.pathExists(itemSharedPath)).toBe(false)
    expect(await fs.pathExists(userSharedPath)).toBe(false)
    expect(await fs.pathExists(rootVendorsPath)).toBe(false)
    expect(await fs.pathExists(itemVendorsPath)).toBe(false)
    expect(await fs.pathExists(userVendorsPath)).toBe(false)
    expect(await fs.pathExists(rootWevuDefinePropertyPath)).toBe(true)
    expect(await fs.pathExists(itemRuntimePath)).toBe(false)
    expect(await fs.pathExists(userRuntimePath)).toBe(false)
  })
})
