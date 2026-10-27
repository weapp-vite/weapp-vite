import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runAggregateBuild } from '../build/aggregateBuild'
import { DIST_ROOT } from '../constants'
import { scanFiles } from '../helpers'

export const group = 'issue829'
export const order = 25

export function registerGithubIssuesBuildCase() {
  it('issue #829: keeps nested scoped-slot function props on the owner path', async () => {
    await runAggregateBuild()

    const appJsonPath = path.join(DIST_ROOT, 'app.json')
    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-829/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-829/index.js')
    const issue466MainWxmlPath = path.join(DIST_ROOT, 'pages/issue-466/index.wxml')
    const issue466SubpackageWxmlPath = path.join(DIST_ROOT, 'subpackages/issue-466/index.wxml')
    const appJson = await fs.readJson(appJsonPath) as {
      pages?: string[]
      subPackages?: Array<{ root?: string }>
    }
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf8')
    const pageJs = await fs.readFile(pageJsPath, 'utf8')
    const scopedSlotWxmlFiles = (await scanFiles(path.join(DIST_ROOT, 'pages/issue-829')))
      .filter(file => file.startsWith('index.__scoped-slot-default-') && file.endsWith('.wxml'))
    const scopedSlotWxml = await Promise.all(scopedSlotWxmlFiles.map(async file => await fs.readFile(path.join(DIST_ROOT, 'pages/issue-829', file), 'utf8')))

    expect(appJson.pages).toContain('pages/issue-466/index')
    expect(appJson.pages?.some(page => page.startsWith('components/'))).toBe(false)
    expect(appJson.subPackages?.some(subPackage => subPackage.root === 'subpackages/issue-466')).toBe(true)
    await expect(fs.pathExists(issue466MainWxmlPath)).resolves.toBe(true)
    await expect(fs.pathExists(issue466SubpackageWxmlPath)).resolves.toBe(true)
    expect(pageWxml).toContain('query-fn="{{queryFn}}"')
    expect(pageJs).toContain('__wevuFunctionPropPaths')
    expect(pageJs).toContain('"queryFn"')
    expect(scopedSlotWxml.some(content => content.includes('query-fn="{{__wvOwner.queryFn}}"'))).toBe(true)
  })
}
