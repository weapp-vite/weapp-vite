import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 17

export function registerGithubIssuesBuildCase() {
  it('issue #530: compiles default slot fallback guards without slot array scans', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-530/index.wxml')
    const componentWxmlPath = path.join(DIST_ROOT, 'components/issue-530/SlotFallbackProbe/index.wxml')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const componentWxml = await fs.readFile(componentWxmlPath, 'utf-8')

    const providedProbe = pageWxml
      .match(/<issue530-slot-fallback-probe[^>]*\/>/g)
      ?.find(tag => tag.includes('class="issue530-card-provided"'))
    expect(providedProbe).toBeDefined()
    expect(providedProbe!).toContain('vue-slots=')
    expect(providedProbe!).toContain('generic:scoped-slots-default=')
    expect(componentWxml).toContain('<block wx:if="{{vueSlots&&vueSlots.default}}">')
    expect(componentWxml).toContain('<scoped-slots-default wx:if="{{__wvSlotOwnerId}}"')
    expect(componentWxml).toContain('<block wx:else><text class="issue530-fallback-default">issue-530 fallback default</text><text class="issue530-scoped-fallback-default">issue-530 scoped fallback default</text></block>')
    expect(componentWxml).not.toContain('vueSlots[')
  })
}
