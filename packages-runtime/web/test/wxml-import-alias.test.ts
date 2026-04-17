import { describe, expect, it } from 'vitest'
import { compileWxml } from '../src/compiler/wxml'
import { TEMPLATE_IMPORT_TAG_NAMES, TEMPLATE_INCLUDE_TAG_NAMES } from '../src/shared/wxml'

describe('compileWxml alias tags', () => {
  it('exposes multi-platform template import/include tag aliases', () => {
    expect(TEMPLATE_IMPORT_TAG_NAMES).toEqual(expect.arrayContaining([
      'import',
      'wx-import',
      'a-import',
      's-import',
      'tt-import',
    ]))
    expect(TEMPLATE_INCLUDE_TAG_NAMES).toEqual(expect.arrayContaining([
      'include',
      'wx-include',
      'a-include',
      's-include',
      'tt-include',
    ]))
  })

  it.each([
    ['wx-import', 'wx-include'],
    ['a-import', 'a-include'],
    ['s-import', 's-include'],
    ['tt-import', 'tt-include'],
  ])('treats %s and %s like import/include', (importTagName, includeTagName) => {
    const result = compileWxml({
      id: '/src/pages/index/index.wxml',
      source: `
        <${importTagName} src="./parts/header.wxml" />
        <view>body</view>
        <${includeTagName} src="../shared/footer.wxml" />
      `,
      resolveTemplatePath: (raw) => {
        if (raw === './parts/header.wxml') {
          return '/src/pages/index/parts/header.wxml'
        }
        if (raw === '../shared/footer.wxml') {
          return '/src/pages/shared/footer.wxml'
        }
        return undefined
      },
      resolveWxsPath: () => undefined,
    })

    expect(result.code).toContain(`import { templates as __wxml_import_0 } from './parts/header.wxml'`)
    expect(result.code).toContain(`import { render as __wxml_include_0 } from '../shared/footer.wxml'`)
    expect(result.code).not.toContain(importTagName)
    expect(result.code).not.toContain(includeTagName)
    expect(result.dependencies).toHaveLength(2)
    expect(result.dependencies).toEqual(expect.arrayContaining([
      '/src/pages/index/parts/header.wxml',
      '/src/pages/shared/footer.wxml',
    ]))
  })
})
