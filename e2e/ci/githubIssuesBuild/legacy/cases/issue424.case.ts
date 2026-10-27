import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'
import { scanFiles } from '../helpers'

export const group = 'standard'
export const order = 28

export function registerGithubIssuesBuildCase() {
  it('issue #424: avoids duplicated output for imported src/assets images', async () => {
    await runBuild()

    const files = await scanFiles(DIST_ROOT)
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-424/index.js')
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-424/index.wxml')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')

    expect(files).not.toContain('assets/images/home/goods-1.png')
    expect(files).not.toContain('assets/images/home/banner-1.jpg')
    expect(files.some(file => /^goods-1-[a-z0-9]+\.png$/.test(file))).toBe(true)
    expect(files.some(file => /^banner-1-[a-z0-9]+\.jpg$/.test(file))).toBe(true)
    expect(issuePageWxml).toContain('issue-424 duplicated imported src asset output')
    expect(issuePageJs).toContain('_runE2E')
    expect(issuePageJs).toContain('goods-1-')
    expect(issuePageJs).toContain('banner-1-')
  })
}
