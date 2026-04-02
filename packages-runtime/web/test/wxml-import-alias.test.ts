import { describe, expect, it } from 'vitest'
import { compileWxml } from '../src/compiler/wxml'

describe('compileWxml alias tags', () => {
  it('treats wx-import and wx-include like import/include', () => {
    const result = compileWxml({
      id: '/src/pages/index/index.wxml',
      source: `
        <wx-import src="./parts/header.wxml" />
        <view>body</view>
        <wx-include src="../shared/footer.wxml" />
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
    expect(result.code).not.toContain('wx-import')
    expect(result.code).not.toContain('wx-include')
    expect(result.dependencies).toHaveLength(2)
    expect(result.dependencies).toEqual(expect.arrayContaining([
      '/src/pages/index/parts/header.wxml',
      '/src/pages/shared/footer.wxml',
    ]))
  })
})
