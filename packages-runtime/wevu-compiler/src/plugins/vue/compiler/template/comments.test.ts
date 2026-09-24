import { describe, expect, it } from 'vitest'
import { compileVueTemplateToWxml } from '../template'

const filename = 'src/components/comment-owner.vue'

describe('template comment preservation', () => {
  it('keeps standalone comment removal as the default and explicit opt-out', () => {
    const template = '<!--root--><view><!--nested--><text>content</text></view>'
    const expected = '<view><text>content</text></view>'

    expect(compileVueTemplateToWxml(template, filename).code).toBe(expected)
    expect(compileVueTemplateToWxml(template, filename, { preserveComments: false }).code).toBe(expected)
  })

  it('preserves source comment content while compiling adjacent Vue conditional branches', () => {
    const comment = '<!-- keep <view> &amp; {{ raw }} > " and \'\nsecond line -->'
    const template = `<view v-if="ready">A</view>${comment}<view v-else-if="pending">B</view><!--else--><view v-else>C</view>`
    const result = compileVueTemplateToWxml(template, filename, { preserveComments: true })

    const baseline = compileVueTemplateToWxml('<view v-if="ready">A</view><view v-else-if="pending">B</view><view v-else>C</view>', filename)
    expect(result.code).toContain(comment)
    expect(result.code).toContain('<!--else-->')
    expect(result.code.replace(/<!--[\s\S]*?-->/g, '')).toBe(baseline.code)
    expect(result.diagnostics).toEqual([])
  })

  it('formats comments atomically without changing their content or adjacent text', () => {
    const comment = '<!-- don\'t split > <view> &amp; "\n  keep indentation -->'
    const result = compileVueTemplateToWxml(`<view><text>before${comment}after</text></view>`, filename, {
      preserveComments: true,
      formatWxml: true,
    })

    expect(result.code).toContain(`<text>before${comment}after</text>`)
    expect(result.diagnostics).toEqual([])
  })

  it('inherits preservation through nested explicit scoped-slot component contexts', () => {
    const result = compileVueTemplateToWxml(
      '<Provider v-slot="{ item }"><!--outer--><Nested v-slot="{ value }"><!--inner--><text>{{ value }}</text></Nested><text>{{ item }}</text></Provider>',
      filename,
      { preserveComments: true },
    )

    expect(result.scopedSlotComponents?.[0]?.template).toContain('<!--outer-->')
    expect(result.scopedSlotComponents?.[1]?.template).toContain('<!--inner-->')
    expect(result.code).not.toContain('<!--outer-->')
    expect(result.code).not.toContain('<!--inner-->')
    expect(result.diagnostics).toEqual([])
  })

  it('moves implicit default-slot comments with augmented content without duplicating them', () => {
    const result = compileVueTemplateToWxml('<Provider><!--before--><Leaf /><!--after--></Provider>', filename, {
      preserveComments: true,
      scopedSlotsRequireProps: false,
    })

    expect(result.scopedSlotComponents?.[0]?.template).toBe('<!--before--><leaf /><!--after-->')
    expect(result.code).not.toContain('<!--')
    expect(result.diagnostics).toEqual([])
  })

  it.each(['auto', 'off'] as const)('preserves named and implicit plain-slot comments in %s mode', (scopedSlotsCompiler) => {
    const result = compileVueTemplateToWxml(
      '<Child><!--before named--><template #header><!--inside named--><text>Header</text></template><!--before default--><text>Default</text><!--after default--></Child>',
      filename,
      { preserveComments: true, scopedSlotsRequireProps: false, scopedSlotsCompiler },
    )

    expect(result.code).toContain('<!--before named--><view slot="header"><!--inside named--><text>Header</text></view><!--before default--><text>Default</text><!--after default-->')
    expect(result.scopedSlotComponents).toBeUndefined()
    expect(result.diagnostics).toEqual([])
  })

  it('does not count comment siblings as additional named-slot projection roots', () => {
    const result = compileVueTemplateToWxml(
      '<Child><template #header><!--before--><text>Header</text><!--after--></template></Child>',
      filename,
      { preserveComments: true, slotSingleRootNoWrapper: true },
    )

    expect(result.code).toContain('<!--before--><text slot="header">Header</text><!--after-->')
    expect(result.code).not.toContain('<view slot="header"')
    expect(result.diagnostics).toEqual([])
  })

  it('keeps comments in the required wrapper for multiple named-slot roots', () => {
    const result = compileVueTemplateToWxml(
      '<Child><template #header><text>First</text><!--between--><text>Second</text></template></Child>',
      filename,
      { preserveComments: true, slotSingleRootNoWrapper: true },
    )

    expect(result.code).toContain('<view slot="header"><text>First</text><!--between--><text>Second</text></view>')
    expect(result.diagnostics).toEqual([])
  })

  it.each(['auto', 'off'] as const)('does not create an implicit default slot for comments in %s mode', (scopedSlotsCompiler) => {
    const result = compileVueTemplateToWxml(
      '<Child><!--sibling--><template #header><!--named only--></template></Child>',
      filename,
      { preserveComments: true, scopedSlotsRequireProps: false, scopedSlotsCompiler },
    )

    expect(result.code).toContain('<!--sibling--><!--named only-->')
    expect(result.code).not.toContain('default:true')
    expect(result.code).not.toContain('generic:scoped-slots-default')
    expect(result.scopedSlotComponents).toBeUndefined()
    expect(result.diagnostics).toEqual([])
  })

  it.each(['auto', 'off'] as const)('does not add slot fallback branches for comments in %s mode', (scopedSlotsCompiler) => {
    const template = '<slot><!--plain--></slot><slot :item="item"><!--scoped--></slot>'
    const result = compileVueTemplateToWxml(template, filename, { preserveComments: true, scopedSlotsCompiler })
    const baseline = compileVueTemplateToWxml('<slot /><slot :item="item" />', filename, { scopedSlotsCompiler })

    expect(result.code).toContain('<!--plain-->')
    expect(result.code).toContain('<!--scoped-->')
    expect(result.code.replace(/<!--[\s\S]*?-->/g, '')).toBe(baseline.code)
  })
})
