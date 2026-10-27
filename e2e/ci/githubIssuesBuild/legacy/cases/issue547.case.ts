import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { findMarkupElements } from '../../markup'
import { runIssue547AugmentedBuild } from '../builders/issue547AugmentedBuild'
import { DIST_ROOT } from '../constants'
import { stripGeneratedScopeAttrs } from '../helpers'

export const group = 'issue547'
export const order = 52

export function registerGithubIssuesBuildCase() {
  it('issue #547: augmented nested default slots emit every scoped slot asset', async () => {
    await runIssue547AugmentedBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-547/index.wxml')
    const pageJsonPath = path.join(DIST_ROOT, 'pages/issue-547/index.json')
    const parentScopedSlotWxmlPath = path.join(DIST_ROOT, 'pages/issue-547/index.__scoped-slot-default-0.wxml')
    const parentScopedSlotJsonPath = path.join(DIST_ROOT, 'pages/issue-547/index.__scoped-slot-default-0.json')
    const childScopedSlotWxmlPath = path.join(DIST_ROOT, 'pages/issue-547/index.__scoped-slot-default-1.wxml')

    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJson = await fs.readJson(pageJsonPath) as { usingComponents?: Record<string, string> }
    const parentScopedSlotWxml = stripGeneratedScopeAttrs(await fs.readFile(parentScopedSlotWxmlPath, 'utf-8'))
    const parentScopedSlotJson = await fs.readJson(parentScopedSlotJsonPath) as { componentGenerics?: Record<string, true>, usingComponents?: Record<string, string> }
    const childScopedSlotWxml = stripGeneratedScopeAttrs(await fs.readFile(childScopedSlotWxmlPath, 'utf-8'))

    expect(pageWxml).toContain('issue-547 nested augmented slot')
    expect(pageWxml).toContain('generic:scoped-slots-default=')
    expect(pageWxml).not.toContain('<nested-slot-cell')
    expect(pageJson.usingComponents).toMatchObject({
      'nested-slot-group': '/components/issue-547/NestedSlotGroup/index',
      'nested-slot-cell': '/components/issue-547/NestedSlotCell/index',
      'nested-slot-image': '/components/issue-547/NestedSlotImage/index',
    })
    expect(Object.values(pageJson.usingComponents ?? {})).toContain('/pages/issue-547/index.__scoped-slot-default-0')
    expect(findMarkupElements(parentScopedSlotWxml, 'nested-slot-cell').map(node => node.attribs)).toEqual([
      expect.objectContaining({ 'generic:scoped-slots-default': expect.any(String) }),
    ])
    expect(parentScopedSlotWxml).not.toContain('<nested-slot-image')
    expect(parentScopedSlotJson.componentGenerics).toBeUndefined()
    expect(Object.values(parentScopedSlotJson.usingComponents ?? {})).toContain('/pages/issue-547/index.__scoped-slot-default-1')
    expect(findMarkupElements(childScopedSlotWxml, 'nested-slot-image')).toHaveLength(1)
  })
}
