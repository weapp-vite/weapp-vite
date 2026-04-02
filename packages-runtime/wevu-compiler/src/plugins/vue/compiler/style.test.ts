import type { SFCStyleBlock } from 'vue/compiler-sfc'
import { describe, expect, it } from 'vitest'
import { compileVueStyleToWxss } from './style'

const CARD_PREFIX_RE = /^card_/
const ITEM_PREFIX_RE = /^item_/

function createStyleBlock(content: string, overrides: Partial<SFCStyleBlock> = {}): SFCStyleBlock {
  return {
    type: 'style',
    content,
    attrs: {},
    loc: {} as any,
    scoped: false,
    module: false,
    ...overrides,
  } as SFCStyleBlock
}

describe('compileVueStyleToWxss', () => {
  it('keeps source code when no scoped/modules option is enabled', () => {
    const result = compileVueStyleToWxss(
      createStyleBlock('.card { color: red; }'),
      { id: 'abc123' },
    )

    expect(result).toEqual({
      code: '.card { color: red; }',
    })
  })

  it('adds scoped attribute to plain selectors', () => {
    const result = compileVueStyleToWxss(
      createStyleBlock('.card, .title { color: red; }'),
      { id: 'abc123', scoped: true },
    )

    expect(result.code).toContain('.card[data-v-abc123]')
    expect(result.code).toContain('.title[data-v-abc123]')
  })

  it('supports scoped style block flag', () => {
    const result = compileVueStyleToWxss(
      createStyleBlock('.button { color: blue; }', { scoped: true }),
      { id: 'scope-flag' },
    )

    expect(result.code).toContain('.button[data-v-scope-flag]')
  })

  it('transforms css modules with default module name', () => {
    const result = compileVueStyleToWxss(
      createStyleBlock('.card { color: red; }', { module: true }),
      { id: 'module-1' },
    )

    expect(result.modules).toBeDefined()
    expect(result.modules?.$style?.card).toMatch(CARD_PREFIX_RE)
    expect(result.code).toContain(`.${result.modules?.$style?.card}`)
    expect(result.code).not.toContain('.card {')
  })

  it('supports named css modules and scoped + modules pipeline', () => {
    const result = compileVueStyleToWxss(
      createStyleBlock('.item { color: red; }', { module: 'styles', scoped: true }),
      { id: 'module-2' },
    )

    expect(result.modules?.styles?.item).toMatch(ITEM_PREFIX_RE)
    expect(result.code).toContain(`[data-v-module-2]`)
  })
})
