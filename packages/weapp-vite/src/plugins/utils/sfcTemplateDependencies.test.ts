import { describe, expect, it } from 'vitest'
import { rebaseSfcTemplateDependencies, recordSfcBlockSource, resolveSfcTemplateSource } from './sfcTemplateDependencies'

describe('SFC template dependency identity', () => {
  it('keeps the resolver-selected identity scoped to its options and importer', () => {
    const options = {}
    const importer = '/project/src/pages/index.vue'
    const otherImporter = '/project/src/components/index.vue'
    recordSfcBlockSource(options, '@templates/body', importer, '/project/templates/body.html?raw')
    recordSfcBlockSource(options, '@templates/body', otherImporter, './other.html')

    expect(resolveSfcTemplateSource(options, '@templates/body', importer)).toBe('/project/templates/body.html')
    expect(resolveSfcTemplateSource(options, '@templates/body', otherImporter)).toBe('/project/src/components/other.html')
    expect(resolveSfcTemplateSource({}, '@templates/body', importer)).toBeUndefined()
    expect(resolveSfcTemplateSource(options, './body.html', importer)).toBeUndefined()
    expect(resolveSfcTemplateSource(undefined, '@templates/body', importer)).toBeUndefined()
  })

  it('uses the compiler relative-source fallback without guessing the block extension', () => {
    const options = {}
    recordSfcBlockSource(options, './parts/body.custom', '/project/src/pages/index.vue')
    expect(resolveSfcTemplateSource(options, './parts/body.custom', '/project/src/pages/index.vue')).toBe('/project/src/pages/parts/body.custom')
  })
})

describe('external SFC template dependency paths', () => {
  it('rebases native import/include/WXS paths while retaining template content', () => {
    const template = [
      '<import src="../../../shared/card.wxml" />',
      '<include src=\'./included.wxml\' />',
      '<wxs module="helper" src="./filter.wxs" />',
      '<view data-src="./unchanged.wxml">content</view>',
    ].join('\n')
    expect(rebaseSfcTemplateDependencies(template, '/project/src/pages/card/parts/body.html', '/project/src/pages/card/index.vue')).toBe([
      '<import src="../../shared/card.wxml" />',
      '<include src="./parts/included.wxml" />',
      '<wxs module="helper" src="./parts/filter.wxs" />',
      '<view data-src="./unchanged.wxml">content</view>',
    ].join('\n'))
  })

  it('retains absolute, remote and dynamic dependencies', () => {
    const template = [
      '<import src="/shared/card.wxml" />',
      '<include src="https://example.test/card.wxml" />',
      '<include src="{{templatePath}}" />',
    ].join('\n')
    expect(rebaseSfcTemplateDependencies(template, '/project/src/parts/body.html', '/project/src/index.vue')).toBe(template)
  })

  it('does not rewrite inline or same-directory templates', () => {
    const template = '<include src=\'./included.wxml\' />'
    expect(rebaseSfcTemplateDependencies(template, undefined, '/project/src/index.vue')).toBe(template)
    expect(rebaseSfcTemplateDependencies(template, '/project/src/body.html', '/project/src/index.vue')).toBe(template)
  })
})
