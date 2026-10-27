import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runIssue615AugmentedBuild } from '../build/issue615AugmentedBuild'
import { DIST_ROOT } from '../constants'
import { scanFiles } from '../helpers'

export const group = 'issue615'
export const order = 24

export function registerGithubIssuesBuildCase() {
  it('issue #615: compiles scoped slot v-for owner list through a safe runtime binding', async () => {
    await runIssue615AugmentedBuild()

    const files = await scanFiles(DIST_ROOT)
    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-615/index.wxml')
    const scopedSlotWxmlFiles = files
      .filter(file => file.startsWith('pages/issue-615/index.__scoped-slot-') && file.endsWith('.wxml'))
      .sort()
    const scopedSlotJsPath = path.join(DIST_ROOT, 'pages/issue-615/index.__scoped-slot-default-0.js')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const scopedSlotWxml = (await Promise.all(scopedSlotWxmlFiles.map(file => fs.readFile(path.join(DIST_ROOT, file), 'utf-8')))).join('\n')
    const scopedSlotJs = await fs.readFile(scopedSlotJsPath, 'utf-8')

    expect(pageWxml).toContain('generic:scoped-slots-default=')
    expect(scopedSlotWxmlFiles).toContain('pages/issue-615/index.__scoped-slot-default-0.wxml')
    expect(scopedSlotWxml).toContain('tabbar-item wx:for="{{__wv_bind_0}}"')
    expect(scopedSlotWxml).not.toContain('wx:for="{{__wvOwner.list}}"')
    expect(scopedSlotWxml).toContain('data-issue615-label="{{item.label}}"')
    expect(scopedSlotWxml).toContain('{{item.label}}')
    expect(scopedSlotJs).toContain('__wvOwnerProxy')
    expect(scopedSlotJs).toContain('list')
    expect(scopedSlotJs).not.toContain('模板 v-for 数据源表达式执行失败: __wv_bind_0')
    expect(scopedSlotJs).not.toContain('模板运行时表达式执行失败: __wv_bind_0 = list')
  })
}
