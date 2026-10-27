import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT, SLOT_OWNER_ATTR } from '../constants'

export const group = 'standard'
export const order = 62

export function registerGithubIssuesBuildCase() {
  it('issue #380: keeps custom-tab-bar out of default page layouts', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-380/index.wxml')
    const customTabBarWxmlPath = path.join(DIST_ROOT, 'custom-tab-bar/index.wxml')
    const customTabBarJsonPath = path.join(DIST_ROOT, 'custom-tab-bar/index.json')

    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const customTabBarWxml = await fs.readFile(customTabBarWxmlPath, 'utf-8')
    const customTabBarJson = await fs.readFile(customTabBarJsonPath, 'utf-8')

    expect(pageWxml).toContain(`<weapp-layout-default ${SLOT_OWNER_ATTR}>`)
    expect(pageWxml).toContain('issue-380 page')
    expect(customTabBarWxml).toContain('issue-380 custom tab bar')
    expect(customTabBarWxml).not.toContain('<weapp-layout-default')
    expect(customTabBarJson).not.toContain('weapp-layout-default')
  })
}
