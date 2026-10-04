import type { TransformContext } from '../../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/types'
import { describe, expect, it, vi } from 'vitest'
import { registerInlineExpression } from '../../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/expression/inline'
import * as parseModule from '../../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/expression/parse'
import { originFixture, withFixture } from './fixtures'
import { InlineOriginState } from './state'

function productionOrigins(input: string, mutate?: (parsed: NonNullable<ReturnType<typeof parseModule.parseBabelExpressionFile>>) => void) {
  const state = new InlineOriginState()
  const fixture = originFixture([input])
  const context = Object.assign(fixture.context, {
    diagnostics: [],
    rewriteScopedSlot: false,
    scopeStack: [],
    slotPropStack: [],
    forStack: [],
    inlineExpressions: [],
    inlineExpressionSeed: 0,
    scriptSetupBindings: {},
  }) as unknown as TransformContext
  const originalParse = parseModule.parseBabelExpressionFile
  let observed: ReturnType<typeof originalParse> | undefined
  const parse = vi.spyOn(parseModule, 'parseBabelExpressionFile').mockImplementation((source) => {
    observed = originalParse(source)
    state.parsed(source, context, observed)
    if (observed) {
      mutate?.(observed)
    }
    return observed
  })
  try {
    const binding = withFixture(state, fixture, () => state.directive(fixture.directives[0]!, context, input, () => {
      const result = registerInlineExpression(input, context)
      const asset = context.inlineExpressions[0]!
      const statement = observed!.ast.program.body[0]!
      const generated = 'expression' in statement ? statement.expression : undefined
      state.registered(asset, context, generated)
      return result
    }))
    expect(parse).toHaveBeenCalledTimes(1)
    expect(binding?.id).toBe(context.inlineExpressions[0]!.id)
    return { fixture, asset: context.inlineExpressions[0]!, provenance: state.requestFor(context)! }
  }
  finally {
    parse.mockRestore()
  }
}

describe('primitive argument origin summaries through production inline registration', () => {
  it.each([
    'jump(\'中文🙂\', 2, true, null)',
    'jump(\r\n\'中文🙂\',\u20282,\u2029true,\rnull)',
  ])('maps the real registerInlineExpression output using one original parse: %s', (input) => {
    const { fixture, asset, provenance } = productionOrigins(input)
    const occurrence = provenance.occurrences[0]!
    expect(occurrence.fragments).toHaveLength(4)
    expect(occurrence.fragments!.map(fragment => fragment.source.text)).toEqual(['\'中文🙂\'', '2', 'true', 'null'])
    for (const fragment of occurrence.fragments!) {
      expect(fragment.kind).toBe('inline-handler-argument-literal')
      expect(asset.expression.slice(fragment.generated.start, fragment.generated.end)).toBe(fragment.source.text)
      expect(fixture.source.slice(fragment.source.start, fragment.source.end)).toBe(fragment.source.text)
    }
  })

  it('keeps the observed token ranges when the same original AST is subsequently mutated', () => {
    const { provenance } = productionOrigins('jump(1, 2)', (parsed) => {
      if (parsed.expression.type !== 'CallExpression') {
        throw new Error('expected a direct call')
      }
      for (const argument of parsed.expression.arguments) {
        argument.start = 0
        argument.end = 1
      }
    })
    expect(provenance.occurrences[0]!.fragments!.map(fragment => fragment.source.text)).toEqual(['1', '2'])
  })

  it('refuses a changed literal whose text only shares the original token prefix', () => {
    const { provenance } = productionOrigins('jump(2)', (parsed) => {
      if (parsed.expression.type !== 'CallExpression' || parsed.expression.arguments[0]?.type !== 'NumericLiteral') {
        throw new Error('expected a direct numeric argument')
      }
      parsed.expression.arguments[0].value = 20
    })
    expect(provenance.occurrences[0]!.callee.name).toBe('jump')
    expect(provenance.occurrences[0]!.fragments).toBeUndefined()
  })

  it('requires the complete generated token even when a rewritten numeric spelling has the same value', () => {
    const { asset, provenance } = productionOrigins('jump(2)', (parsed) => {
      if (parsed.expression.type !== 'CallExpression' || parsed.expression.arguments[0]?.type !== 'NumericLiteral') {
        throw new Error('expected a direct numeric argument')
      }
      parsed.expression.arguments[0].extra = { raw: '2.0', rawValue: 2 }
    })
    expect(asset.expression).toContain('(2.0)')
    expect(provenance.occurrences[0]!.fragments).toBeUndefined()
  })

  it.each(['jump("same")', 'jump(\'\\u{1F600}\')'])('keeps only callee evidence when the actual generator rewrites token spelling: %s', (input) => {
    const { asset, provenance } = productionOrigins(input, (parsed) => {
      if (parsed.expression.type !== 'CallExpression' || parsed.expression.arguments[0]?.type !== 'StringLiteral') {
        throw new Error('expected a direct string argument')
      }
      delete parsed.expression.arguments[0].extra
    })
    expect(asset.expression).not.toBe(`_ctx.${input}`)
    expect(provenance.occurrences[0]!.callee.name).toBe('jump')
    expect(provenance.occurrences[0]!.fragments).toBeUndefined()
  })

  it.each(['reordered', 'removed', 'complex'] as const)('keeps only callee evidence if generated arguments are %s', (variant) => {
    const { provenance } = productionOrigins('jump(1, 2)', (parsed) => {
      if (parsed.expression.type !== 'CallExpression') {
        throw new Error('expected a direct call')
      }
      if (variant === 'reordered') {
        parsed.expression.arguments.reverse()
      }
      else if (variant === 'removed') {
        parsed.expression.arguments.pop()
      }
      else {
        parsed.expression.arguments[1] = { type: 'Identifier', name: 'value' }
      }
    })
    expect(provenance.occurrences[0]!.callee.name).toBe('jump')
    expect(provenance.occurrences[0]!.fragments).toBeUndefined()
  })

  it.each([
    'jump()',
    'jump($event)',
    'jump(1, value.path)',
    'jump(...values)',
    'jump(1 as number)',
    'jump((1))',
    'jump(slot.value)',
    'jump(value = 1)',
  ])('keeps only the existing callee evidence for unsupported parameters: %s', (input) => {
    const { provenance } = productionOrigins(input)
    expect(provenance.occurrences[0]!.callee.name).toBe('jump')
    expect(provenance.occurrences[0]!.fragments).toBeUndefined()
  })
})
