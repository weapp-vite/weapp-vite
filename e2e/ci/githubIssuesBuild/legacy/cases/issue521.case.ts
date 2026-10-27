import { WEVU_BINDING_MANIFEST_KEY } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { findWevuRuntimeChunk } from '../../../../utils/wevu-vendor'
import { findMarkupElements } from '../../markup'
import { runBuild } from '../build/standard'
import { DIST_ROOT, SLOT_OWNER_ATTR } from '../constants'
import { stripGeneratedScopeAttrs } from '../helpers'

export const group = 'standard'
export const order = 50

export function registerGithubIssuesBuildCase() {
  it('issue #521: keeps generated scoped slot components virtual for flex layouts', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-521/index.wxml')
    const pageJsonPath = path.join(DIST_ROOT, 'pages/issue-521/index.json')
    const scopedSlotJsonPath = path.join(DIST_ROOT, 'pages/issue-521/index.__scoped-slot-default-0.json')
    const scopedSlotWxmlPath = path.join(DIST_ROOT, 'pages/issue-521/index.__scoped-slot-default-0.wxml')
    const hostWxmlPath = path.join(DIST_ROOT, 'components/issue-521/ScopedFlexHost/index.wxml')
    const runtime = await findWevuRuntimeChunk(
      DIST_ROOT,
      code => code.includes('virtualHost') && /options:\s*\{\s*virtualHost:\s*(?:true|!0)\s*\}/.test(code),
      'scoped slot virtualHost options',
    )

    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJson = await fs.readJson(pageJsonPath) as { usingComponents?: Record<string, string> }
    const scopedSlotJson = await fs.readJson(scopedSlotJsonPath) as { component?: boolean, styleIsolation?: string }
    const scopedSlotWxml = stripGeneratedScopeAttrs(await fs.readFile(scopedSlotWxmlPath, 'utf-8'))
    const hostWxml = await fs.readFile(hostWxmlPath, 'utf-8')
    const scopedSlotJs = await fs.readFile(scopedSlotWxmlPath.replace(/\.wxml$/, '.js'), 'utf-8')

    expect(pageWxml).toContain('issue-521 scoped slot flex layout')
    expect(pageWxml).toContain('generic:scoped-slots-default=')
    expect(pageWxml).toContain(SLOT_OWNER_ATTR)
    expect(pageJson.usingComponents).toMatchObject({
      'scoped-flex-host': '/components/issue-521/ScopedFlexHost/index',
      'flex-item': '/components/issue-521/FlexItem/index',
    })
    expect(Object.values(pageJson.usingComponents ?? {})).toContain('/pages/issue-521/index.__scoped-slot-default-0')
    expect(scopedSlotJson).toMatchObject({
      component: true,
      styleIsolation: 'apply-shared',
    })
    expect(findMarkupElements(scopedSlotWxml, 'flex-item').map(node => node.attribs)).toEqual([
      expect.objectContaining({ label: 'A', value: '{{__wvSlotPropsData.xyz}}' }),
      expect.objectContaining({ label: 'B', value: '{{__wvSlotPropsData.xyz}}' }),
    ])
    expect(scopedSlotJs).toMatch(/createWevuScopedSlotComponent\(\s*\{/)
    expect(scopedSlotJs).toContain(JSON.stringify(WEVU_BINDING_MANIFEST_KEY))
    expect(hostWxml).toContain('<scoped-slots-default wx:if="{{__wvSlotOwnerId}}"')
    expect(runtime.code).toContain('virtualHost')
    expect(runtime.code).toMatch(/options:\s*\{\s*virtualHost:\s*(?:true|!0)\s*\}/)
  })
}
