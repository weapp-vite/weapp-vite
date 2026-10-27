import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { findWevuVendorChunkContaining } from '../../../../utils/wevu-vendor'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 85

export function registerGithubIssuesBuildCase() {
  it('issue #373: compiles shared store computed bindings across reLaunch pages', async () => {
    await runBuild()

    const launchPageWxmlPath = path.join(DIST_ROOT, 'pages/issue-373/launch/index.wxml')
    const launchPageJsPath = path.join(DIST_ROOT, 'pages/issue-373/launch/index.js')
    const resultPageWxmlPath = path.join(DIST_ROOT, 'pages/issue-373/result/index.wxml')
    const resultPageJsPath = path.join(DIST_ROOT, 'pages/issue-373/result/index.js')

    const launchPageWxml = await fs.readFile(launchPageWxmlPath, 'utf-8')
    const launchPageJs = await fs.readFile(launchPageJsPath, 'utf-8')
    const resultPageWxml = await fs.readFile(resultPageWxmlPath, 'utf-8')
    const resultPageJs = await fs.readFile(resultPageJsPath, 'utf-8')
    const { code: wevuRuntime } = await findWevuVendorChunkContaining(DIST_ROOT, ['useIssue373Store'])

    expect(launchPageWxml).toContain('issue-373 store computed survives reLaunch')
    expect(launchPageWxml).toContain('launch count: {{count}}')
    expect(launchPageWxml).toContain('launch doubled: {{doubled}}')
    expect(launchPageWxml).toContain('data-doubled="{{doubled}}"')
    expect(launchPageJs).toContain('runRelaunch')
    expect(launchPageJs).toContain('_runE2E')

    expect(resultPageWxml).toContain('issue-373 reLaunch store computed result')
    expect(resultPageWxml).toContain('result count: {{count}}')
    expect(resultPageWxml).toContain('result doubled: {{doubled}}')
    expect(resultPageWxml).toContain('data-doubled="{{doubled}}"')
    expect(resultPageJs).toContain('increment')
    expect(resultPageJs).toContain('_runE2E')

    expect(wevuRuntime).toContain('issue-373-store')
    expect(launchPageJs).toMatch(/const\s+\{\s*count,\s*doubled\s*\}\s*=\s*[\w$]+\.[\w$]+\(\s*store\s*\)/)
    expect(resultPageJs).toMatch(/const\s+\{\s*count,\s*doubled\s*\}\s*=\s*[\w$]+\.[\w$]+\(\s*store\s*\)/)
  })
}
