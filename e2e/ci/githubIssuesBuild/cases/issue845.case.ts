import type { GithubIssuesBuildCaseContext } from './types'
import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, it } from 'vitest'

export function registerGithubIssuesBuildCase(context: GithubIssuesBuildCaseContext) {
  it('issue #845: enables the i18n runtime for the complete fixture gallery', async () => {
    await context.runStandardBuild()
    const app = JSON.parse(await fs.readFile(path.join(context.distRoot, 'app.json'), 'utf8')) as { pages: string[] }
    expect(app.pages).toContain('pages/issue-845-native/index')
    expect(app.pages).toContain('pages/issue-845-vue/index')
    for (const route of ['pages/issue-845-native/index', 'pages/issue-845-vue/index', 'components/issue-845-i18n-card/index']) {
      for (const extension of ['js', 'json', 'wxml']) {
        await expect(fs.access(path.join(context.distRoot, `${route}.${extension}`))).resolves.toBeUndefined()
      }
      const markup = await fs.readFile(path.join(context.distRoot, `${route}.wxml`), 'utf8')
      expect(markup).toContain('i18n.t(__wv_i18n_locale,')
      expect(markup).toContain('i18n/locales.wxs')
      const script = await fs.readFile(path.join(context.distRoot, `${route}.js`), 'utf8')
      expect(script).not.toContain('__WEAPP_VITE_I18N__')
    }
    for (const extension of ['js', 'wxs']) {
      await expect(fs.access(path.join(context.distRoot, `i18n/locales.${extension}`))).resolves.toBeUndefined()
    }
  })
}
