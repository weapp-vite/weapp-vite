import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runIssue510AugmentedBuild } from '../build/issue510AugmentedBuild'
import { ISSUE_510_DIST_ROOT, SLOT_OWNER_ATTR } from '../constants'
import { stripGeneratedScopeAttrs } from '../helpers'

export const group = 'issue510'
export const order = 51

export function registerGithubIssuesBuildCase() {
  it('issue #510: augmented plain default slots preserve projected provide/inject scope', async () => {
    await runIssue510AugmentedBuild()

    const pageWxmlPath = path.join(ISSUE_510_DIST_ROOT, 'pages/issue-510/index.wxml')
    const pageJsonPath = path.join(ISSUE_510_DIST_ROOT, 'pages/issue-510/index.json')
    const scopedSlotWxmlPath = path.join(ISSUE_510_DIST_ROOT, 'pages/issue-510/index.__scoped-slot-default-0.wxml')
    const hostWxmlPath = path.join(ISSUE_510_DIST_ROOT, 'components/issue-510/AugmentedSlotHost/index.wxml')

    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJson = await fs.readJson(pageJsonPath) as { usingComponents?: Record<string, string> }
    const scopedSlotWxml = stripGeneratedScopeAttrs(await fs.readFile(scopedSlotWxmlPath, 'utf-8'))
    const hostWxml = await fs.readFile(hostWxmlPath, 'utf-8')

    expect(pageWxml).toContain('issue-510 augmented slot provide inject')
    expect(pageWxml).toContain('generic:scoped-slots-default=')
    expect(pageWxml).toContain(SLOT_OWNER_ATTR)
    expect(pageWxml).not.toContain('<view class="issue510-wrapper"><augmented-slot-leaf /></view>')
    expect(pageJson.usingComponents).toMatchObject({
      'augmented-slot-host': '/components/issue-510/AugmentedSlotHost/index',
      'augmented-slot-leaf': '/components/issue-510/AugmentedSlotLeaf/index',
    })
    expect(Object.values(pageJson.usingComponents ?? {})).toContain('/pages/issue-510/index.__scoped-slot-default-0')
    expect(scopedSlotWxml).toContain('<view class="issue510-wrapper"><augmented-slot-leaf /></view>')
    expect(hostWxml).toContain('<scoped-slots-default wx:if="{{__wvSlotOwnerId}}"')
  })
}
