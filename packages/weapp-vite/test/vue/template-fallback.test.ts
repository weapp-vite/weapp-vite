import { describe, expect, it, vi } from 'vitest'

describe('Vue Template Compiler - fallback normalization', () => {
  it('rewrites template literal bindings when babel parse fails', async () => {
    vi.doMock('@babel/parser', () => ({
      parse: () => {
        throw new Error('parse-fail')
      },
    }))

    const { compileVueTemplateToWxml } = await vi.importActual<typeof import('../../src/plugins/vue/compiler/template')>(
      '../../src/plugins/vue/compiler/template',
    )

    const result = compileVueTemplateToWxml(
      // eslint-disable-next-line no-template-curly-in-string
      '<native-badge :text="`状态：${currentType}`" :type="currentType" />',
      'test.vue',
    )

    expect(result.code).toContain('text="{{\'状态：\' + (currentType)}}"')
    expect(result.code).not.toContain('`')
    expect(result.code).not.toContain('${')

    vi.resetModules()
    vi.doUnmock('@babel/parser')
  })
})
