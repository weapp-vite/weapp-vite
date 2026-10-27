import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'
import { stripGeneratedScopeAttrs } from '../helpers'

export const group = 'standard'
export const order = 79

export function registerGithubIssuesBuildCase() {
  it('issue #322: keeps static class and hidden v-show fallback when expression access throws', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-322/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-322/index.js')
    const issuePageWxml = stripGeneratedScopeAttrs(await fs.readFile(issuePageWxmlPath, 'utf-8'))
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-322 class/v-show first paint flicker')
    expect(issuePageWxml).toContain('set email error')
    expect(issuePageWxml).toContain('clear email error')
    expect(issuePageWxml).toMatch(/class="\{\{__wv_cls_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/style="\{\{__wv_style_\d+\}\}"/)
    expect(issuePageWxml).not.toContain('errors.email ?')
    expect(issuePageWxml).toMatch(/<input[^>]*class="\{\{__wv_cls_\d+\}\}"[^>]*\/>/)
    expect(issuePageWxml).not.toContain('</input>')
    expect(issuePageWxml).toMatch(/<input[^>]*\/><view style="\{\{__wv_style_\d+\}\}" class="issue322-error-tip">/)

    expect(issuePageJs).toMatch(/__wv_cls_\d+/)
    expect(issuePageJs).toMatch(/__wv_style_\d+/)
    expect(issuePageJs).toContain('hasEmailError: Boolean(errors.value?.email)')
    expect(issuePageJs).toContain('emailError: errors.value?.email ?? ""')
    expect(issuePageJs).toMatch(/return\s+["'`]issue322-input issue322-input-base["'`]/)
    expect(issuePageJs).toMatch(/return\s+["'`]display: none["'`]/)
  })
}
