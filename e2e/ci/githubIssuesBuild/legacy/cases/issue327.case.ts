import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 82

export function registerGithubIssuesBuildCase() {
  it('issue #327: routes npm deps by mainPackage/subPackages config and only emits configured main-package npm output', async () => {
    await runBuild()

    const issue327NpmRoot = path.join(DIST_ROOT, 'subpackages/issue-327/miniprogram_npm')
    const itemNpmRoot = path.join(DIST_ROOT, 'subpackages/item/miniprogram_npm')
    const userNpmRoot = path.join(DIST_ROOT, 'subpackages/user/miniprogram_npm')
    const subpackageDayjsPath = path.join(issue327NpmRoot, 'dayjs/index.js')
    const subpackageTdesignPath = path.join(issue327NpmRoot, 'tdesign-miniprogram/button/button.js')
    const itemCamelCasePath = path.join(itemNpmRoot, 'camelcase/index.js')
    const userMergePath = path.join(userNpmRoot, 'merge/index.js')
    const mainDayjsPath = path.join(DIST_ROOT, 'miniprogram_npm/dayjs/index.js')
    const mainTdesignPath = path.join(DIST_ROOT, 'miniprogram_npm/tdesign-miniprogram/button/button.js')
    const mainLodashPath = path.join(DIST_ROOT, 'miniprogram_npm/camelcase/index.js')
    const mainMergePath = path.join(DIST_ROOT, 'miniprogram_npm/merge/index.js')
    const issuePageJsPath = path.join(DIST_ROOT, 'subpackages/issue-327/index.js')
    const issuePageJsonPath = path.join(DIST_ROOT, 'subpackages/issue-327/index.json')
    const itemPageJsPath = path.join(DIST_ROOT, 'subpackages/item/index.js')
    const userPageJsPath = path.join(DIST_ROOT, 'subpackages/user/index.js')

    expect(await fs.pathExists(subpackageDayjsPath)).toBe(true)
    expect(await fs.pathExists(subpackageTdesignPath)).toBe(true)
    expect(await fs.pathExists(itemCamelCasePath)).toBe(true)
    expect(await fs.pathExists(userMergePath)).toBe(true)
    expect(await fs.pathExists(mainDayjsPath)).toBe(false)
    expect(await fs.pathExists(mainTdesignPath)).toBe(true)
    expect(await fs.pathExists(mainLodashPath)).toBe(false)
    expect(await fs.pathExists(mainMergePath)).toBe(false)
    expect(await fs.pathExists(path.join(DIST_ROOT, 'miniprogram_npm'))).toBe(true)

    expect(await fs.pathExists(path.join(issue327NpmRoot, 'camelcase/index.js'))).toBe(false)
    expect(await fs.pathExists(path.join(issue327NpmRoot, 'merge/index.js'))).toBe(false)
    expect(await fs.pathExists(path.join(itemNpmRoot, 'merge/index.js'))).toBe(false)
    expect(await fs.pathExists(path.join(itemNpmRoot, 'dayjs/index.js'))).toBe(false)
    expect(await fs.pathExists(path.join(userNpmRoot, 'camelcase/index.js'))).toBe(false)
    expect(await fs.pathExists(path.join(userNpmRoot, 'dayjs/index.js'))).toBe(false)

    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')
    const issuePageJson = await fs.readFile(issuePageJsonPath, 'utf-8')
    const itemPageJs = await fs.readFile(itemPageJsPath, 'utf-8')
    const userPageJs = await fs.readFile(userPageJsPath, 'utf-8')

    expect(issuePageJs).toContain('dayjs')
    expect(issuePageJson).toContain('"t-button": "tdesign-miniprogram/button/button"')
    expect(itemPageJs).toContain('camelcase')
    expect(itemPageJs).toContain('npmMarker')
    expect(userPageJs).toContain('merge')
    expect(userPageJs).toContain('npmMarker')
  })
}
