import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT, SLOT_OWNER_ATTR } from '../constants'
import { stripGeneratedScopeAttrs } from '../helpers'

export const group = 'standard'
export const order = 9

export function registerGithubIssuesBuildCase() {
  it('discussion #338: emits mapped wxml tags from vue html-style templates', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-338/index.wxml')
    const pageWxml = stripGeneratedScopeAttrs(await fs.readFile(pageWxmlPath, 'utf-8'))

    expect(pageWxml).toContain(`<weapp-layout-default ${SLOT_OWNER_ATTR}>`)
    expect(pageWxml).toContain('<block wx:if="{{true}}"><view')
    expect(pageWxml).toContain('class="div issue338-page"')
    expect(pageWxml).toContain('id="issue338-page"')
    expect(pageWxml).toContain('data-e2e-issue="338"')
    expect(pageWxml).toContain('<text class="span issue338-title">{{title}}</text>')
    expect(pageWxml).toContain('<image class="img issue338-cover" src="{{cover}}" mode="aspectFit" />')
    expect(pageWxml).toContain('<view class="section issue338-links">')
    expect(pageWxml).toContain('<navigator class="a issue338-link" wx:for="{{links}}"')
    expect(pageWxml).toContain('url="{{\'/pages/\'+link+\'/index\'}}"')
    expect(pageWxml).not.toContain('<div')
    expect(pageWxml).not.toContain('<span')
    expect(pageWxml).not.toContain('<img')
    expect(pageWxml).not.toContain('<section')
    expect(pageWxml).not.toContain('<a ')
  })
}
