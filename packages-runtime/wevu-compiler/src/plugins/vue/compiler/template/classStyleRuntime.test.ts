import { describe, expect, it } from 'vitest'
import {
  buildClassStyleWxsTag,
  CLASS_STYLE_WXS_FILE,
  CLASS_STYLE_WXS_MODULE,
  getClassStyleWxsSource,
  resolveClassStyleWxsLocation,
} from './classStyleRuntime'

describe('classStyleRuntime helpers', () => {
  it('builds wxs/sjs helper tags', () => {
    expect(buildClassStyleWxsTag('wxs')).toBe(`<wxs module="${CLASS_STYLE_WXS_MODULE}" src="./${CLASS_STYLE_WXS_FILE}.wxs"/>`)
    expect(buildClassStyleWxsTag('.sjs', '/pkg/helper.sjs')).toBe(`<sjs module="${CLASS_STYLE_WXS_MODULE}" src="/pkg/helper.sjs"/>`)
  })

  it('resolves class/style runtime file location', () => {
    const rootResult = resolveClassStyleWxsLocation({
      relativeBase: 'pages/index/index.vue',
      extension: 'wxs',
    })
    expect(rootResult.fileName).toBe(`${CLASS_STYLE_WXS_FILE}.wxs`)
    expect(rootResult.src).toBe(`../../${CLASS_STYLE_WXS_FILE}.wxs`)

    const subPackageResult = resolveClassStyleWxsLocation({
      relativeBase: 'packageA/pages/foo/index.vue',
      packageRoot: 'packageA',
      extension: '.sjs',
    })
    expect(subPackageResult.fileName).toBe(`packageA/${CLASS_STYLE_WXS_FILE}.sjs`)
    expect(subPackageResult.src).toBe(`../../${CLASS_STYLE_WXS_FILE}.sjs`)
  })

  it('returns runtime helper source for wxs and sjs', () => {
    const wxs = getClassStyleWxsSource({ extension: 'wxs' })
    const sjs = getClassStyleWxsSource({ extension: 'sjs' })

    expect(wxs).toContain('function normalizeClass')
    expect(wxs).toContain('module.exports')
    expect(sjs).toContain('function normalizeStyle')
    expect(sjs).toContain('export default')
  })
})
