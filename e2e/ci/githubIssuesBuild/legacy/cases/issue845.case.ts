import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runIssue845Build } from '../build/issue845Build'
import { ISSUE_845_DIST_ROOT } from '../constants'
import { resolveSharedRuntimeImport } from '../helpers'

export const group = 'issue845'
export const order = 2

export function registerGithubIssuesBuildCase() {
  it('issue #845: emits first-party i18n assets for native and Vue templates', async () => {
    await runIssue845Build()

    const nativeWxml = await fs.readFile(path.join(ISSUE_845_DIST_ROOT, 'pages/issue-845-native/index.wxml'), 'utf8')
    const nativeComponentWxml = await fs.readFile(path.join(ISSUE_845_DIST_ROOT, 'components/issue-845-i18n-card/index.wxml'), 'utf8')
    const vueJs = await fs.readFile(path.join(ISSUE_845_DIST_ROOT, 'pages/issue-845-vue/index.js'), 'utf8')
    const vueWxml = await fs.readFile(path.join(ISSUE_845_DIST_ROOT, 'pages/issue-845-vue/index.wxml'), 'utf8')
    const localesWxs = await fs.readFile(path.join(ISSUE_845_DIST_ROOT, 'i18n/locales.wxs'), 'utf8')
    const localesJs = await fs.readFile(path.join(ISSUE_845_DIST_ROOT, 'i18n/locales.js'), 'utf8')
    const runtimePath = resolveSharedRuntimeImport(path.join(ISSUE_845_DIST_ROOT, 'i18n/locales.js'), localesJs)
    expect(runtimePath).toBeTruthy()
    const runtimeJs = await fs.readFile(runtimePath!, 'utf8')
    const ordinaryWxml = await fs.readFile(path.join(ISSUE_845_DIST_ROOT, 'subpackages/issue-845-normal/index.wxml'), 'utf8')
    const independentWxml = await fs.readFile(path.join(ISSUE_845_DIST_ROOT, 'subpackages/issue-845-independent/index.wxml'), 'utf8')
    const independentJs = await fs.readFile(path.join(ISSUE_845_DIST_ROOT, 'subpackages/issue-845-independent/index.js'), 'utf8')
    const independentRoot = path.join(ISSUE_845_DIST_ROOT, 'subpackages/issue-845-independent')
    const independentRuntimeEntryPath = path.join(independentRoot, 'i18n/locales.js')
    const independentRuntimeEntryJs = await fs.readFile(independentRuntimeEntryPath, 'utf8')
    const independentRuntimePath = resolveSharedRuntimeImport(independentRuntimeEntryPath, independentRuntimeEntryJs)
    expect(independentRuntimePath).toBeTruthy()
    const independentRuntimeJs = await fs.readFile(independentRuntimePath!, 'utf8')
    const appJson = await fs.readJSON(path.join(ISSUE_845_DIST_ROOT, 'app.json')) as {
      subPackages?: Array<{ independent?: boolean, root?: string }>
    }

    expect(nativeWxml).toContain('<wxs module="i18n" src="../../i18n/locales.wxs"/>')
    expect(nativeWxml).toContain('i18n.t(__wv_i18n_locale, \'issue845.greeting\', { user })')
    expect(nativeComponentWxml).toContain('i18n.t(__wv_i18n_locale, \'issue845.greeting\', { user })')
    expect(vueJs).not.toContain('__WEAPP_VITE_I18N__')
    expect(vueJs).toMatch(/behaviors:\s*\[[\w$.]+\.behavior\]/)
    expect(vueJs).not.toContain('behaviors: [{}]')
    expect(vueWxml).toContain('i18n.t(__wv_i18n_locale, \'issue845.greeting\', { user })')
    expect(ordinaryWxml).toContain('<wxs module="i18n" src="./i18n/locales.wxs"/>')
    expect(independentWxml).toContain('<wxs module="i18n" src="./i18n/locales.wxs"/>')
    expect(appJson.subPackages).toContainEqual(expect.objectContaining({
      independent: true,
      root: 'subpackages/issue-845-independent',
    }))
    expect(independentJs).not.toContain('require("../../')
    expect(path.relative(independentRoot, independentRuntimePath!)).not.toMatch(/^\.\.(?:[/\\]|$)/)
    expect(independentRuntimeJs).toContain('RangeError')
    expect(independentRuntimeJs).toContain('__WEAPP_VITE_I18N__')
    expect(localesWxs).toContain('Fallback text')
    expect(runtimeJs).toContain('RangeError')
    for (const root of ['subpackages/issue-845-normal', 'subpackages/issue-845-independent']) {
      expect(await fs.pathExists(path.join(ISSUE_845_DIST_ROOT, root, 'i18n/locales.js'))).toBe(true)
      expect(await fs.pathExists(path.join(ISSUE_845_DIST_ROOT, root, 'i18n/locales.wxs'))).toBe(true)
    }
  })
}
