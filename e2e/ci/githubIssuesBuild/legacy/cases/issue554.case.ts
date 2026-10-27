import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'
import { stripGeneratedScopeAttrs } from '../helpers'

export const group = 'standard'
export const order = 23

export function registerGithubIssuesBuildCase() {
  it('issue #554: injects slot metadata for v-for component default slots', async () => {
    await runBuild()

    const pageJsonPath = path.join(DIST_ROOT, 'pages/issue-554/index.json')
    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-554/index.wxml')
    const pageJson = await fs.readJson(pageJsonPath) as { usingComponents?: Record<string, string> }
    const pageWxml = stripGeneratedScopeAttrs(await fs.readFile(pageWxmlPath, 'utf-8'))

    expect(pageJson.usingComponents).toMatchObject({
      'loop-slot-cell': '/components/issue-554/LoopSlotCell/index',
    })
    expect(pageWxml).toContain('loop-slot-cell')
    expect(pageWxml).toContain('wx:for="{{items}}"')
    expect(pageWxml).toContain('wx:for-item="__wv_item_')
    expect(pageWxml).toContain('wx:key="key"')
    expect(pageWxml).toContain(`vue-slots="{{__wv_bind_0[__wv_index_1]}}"`)
    expect(pageWxml).toContain('<image class="issue554-image" src="{{__wv_item_0.src}}" mode="aspectFit" />')
  })
}
