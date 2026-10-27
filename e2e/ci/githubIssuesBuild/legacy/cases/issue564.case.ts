import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { findMarkupElements } from '../../markup'
import { runIssue564AugmentedBuild } from '../build/issue564AugmentedBuild'
import { DIST_ROOT } from '../constants'

export const group = 'issue564'
export const order = 54

export function registerGithubIssuesBuildCase() {
  it('issue #564: native component default content stays inline inside augmented scoped slot assets', async () => {
    await runIssue564AugmentedBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-564/index.wxml')
    const pageJsonPath = path.join(DIST_ROOT, 'pages/issue-564/index.json')
    const scopedSlotWxmlPath = path.join(DIST_ROOT, 'pages/issue-564/index.__scoped-slot-default-0.wxml')
    const scopedSlotJsonPath = path.join(DIST_ROOT, 'pages/issue-564/index.__scoped-slot-default-0.json')
    const nestedScopedSlotWxmlPath = path.join(DIST_ROOT, 'pages/issue-564/index.__scoped-slot-default-1.wxml')
    const nativeTabbarWxmlPath = path.join(DIST_ROOT, 'components/issue-564/native-tabbar/index.wxml')
    const nativeTabbarJsPath = path.join(DIST_ROOT, 'components/issue-564/native-tabbar/index.js')
    const nativeTabbarJsonPath = path.join(DIST_ROOT, 'components/issue-564/native-tabbar/index.json')
    const nativeTabbarGenericJsonPath = path.join(DIST_ROOT, 'components/issue-564/native-tabbar/__weapp_vite_scoped_slot_generic_component.json')

    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJson = await fs.readJson(pageJsonPath) as { usingComponents?: Record<string, string> }
    const scopedSlotWxml = await fs.readFile(scopedSlotWxmlPath, 'utf-8')
    const scopedSlotJson = await fs.readJson(scopedSlotJsonPath) as { usingComponents?: Record<string, string> }
    const nativeTabbarWxml = await fs.readFile(nativeTabbarWxmlPath, 'utf-8')
    const nativeTabbarJs = await fs.readFile(nativeTabbarJsPath, 'utf-8')
    const nativeTabbarJson = await fs.readJson(nativeTabbarJsonPath) as { componentGenerics?: Record<string, { default?: string }> }
    const nativeTabbarGenericJson = await fs.readJson(nativeTabbarGenericJsonPath) as { component?: boolean, options?: { virtualHost?: boolean } }

    expect(pageWxml).toContain('issue-564 native nested scoped slot')
    expect(pageWxml).toContain('generic:scoped-slots-default=')
    expect(pageJson.usingComponents).toMatchObject({
      'issue-564-native-tabbar': '/components/issue-564/native-tabbar/index',
      'issue-564-native-tabbar-item': '/components/issue-564/native-tabbar-item/index',
    })
    expect(Object.values(pageJson.usingComponents ?? {})).toContain('/pages/issue-564/index.__scoped-slot-default-0')
    expect(Object.values(pageJson.usingComponents ?? {})).not.toContain('/pages/issue-564/index.__scoped-slot-default-1')
    expect(scopedSlotWxml).toContain('<issue-564-native-tabbar-item wx:for="{{__wv_bind_0}}"')
    expect(scopedSlotWxml).not.toContain('wx:for="{{__wvOwner.tabItems}}"')
    const nativeItems = findMarkupElements(scopedSlotWxml, 'issue-564-native-tabbar-item')
    expect(nativeItems).toHaveLength(1)
    const inlineLabel = nativeItems[0].children.find(node => 'name' in node && node.name === 'text')
    expect(inlineLabel).toMatchObject({
      attribs: { class: 'issue564-slot-label', id: `{{${nativeItems[0].attribs['wx:for-item']}.label}}` },
      children: [{ type: 'text', data: `{{${nativeItems[0].attribs['wx:for-item']}.label}}` }],
    })
    expect(scopedSlotWxml).not.toContain('generic:scoped-slots-default')
    expect(Object.values(scopedSlotJson.usingComponents ?? {})).toContain('/components/issue-564/native-tabbar-item/index')
    expect(Object.values(scopedSlotJson.usingComponents ?? {})).not.toContain('/pages/issue-564/index.__scoped-slot-default-1')
    expect(nativeTabbarJson.componentGenerics?.['scoped-slots-default']?.default).toBe('./__weapp_vite_scoped_slot_generic_component')
    expect(nativeTabbarWxml).toContain('<slot /><scoped-slots-default')
    expect(nativeTabbarWxml).toContain('__wvSlotOwnerId="{{__wvSlotOwnerId}}"')
    expect(nativeTabbarJs).toContain('__wvSlotOwnerId')
    expect(nativeTabbarGenericJson).toMatchObject({
      component: true,
      options: {
        virtualHost: true,
      },
    })
    expect(await fs.pathExists(nestedScopedSlotWxmlPath)).toBe(false)
  })
}
