import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { compileVueTemplateToWxml } from '../../template'

interface InlineContext {
  count: { value: number }
  rows?: number[]
}

function compileInlineHandler(expression: string) {
  const result = compileVueTemplateToWxml(
    `<view @tap="${expression}" />`,
    '/project/src/pages/inline-scope.vue',
    {
      scriptSetupBindings: {
        count: 'setup-ref',
        rows: 'setup-const',
      },
    },
  )

  expect(result.diagnostics).toEqual([])
  expect(result.inlineExpressions).toHaveLength(1)
  const compiledExpression = result.inlineExpressions![0]!.expression
  return runInNewContext(`((ctx, scope, $event) => (${compiledExpression}))`) as (
    ctx: InlineContext,
    scope: Record<string, unknown>,
    event?: unknown,
  ) => unknown
}

describe('inline expression lexical setup binding writes', () => {
  it('keeps a callback parameter write local when it shadows a setup ref', () => {
    const handler = compileInlineHandler('rows.map(count => count++)')
    const context = { count: { value: 1 }, rows: [2] }

    expect(handler(context, {})).toEqual([2])
    expect(context.count.value).toBe(1)
  })

  it('keeps parameter, block, and closure assignments and updates on their lexical bindings', () => {
    const handler = compileInlineHandler(`[
      ((count) => { count = 4; count += 2; return count++ })(1),
      (() => { let count = 3; count = 5; count *= 2; return ++count })(),
      ((count) => () => { count -= 1; return count-- })(4)(),
    ]`)
    const context = { count: { value: 1 } }

    expect(handler(context, {})).toEqual([6, 11, 3])
    expect(context.count.value).toBe(1)
  })

  it('preserves ordinary, compound, and update writes to the genuine setup ref', () => {
    const handler = compileInlineHandler('(count = 2, count += 3, count++, ++count)')
    const context = { count: { value: 1 } }

    expect(handler(context, {})).toBe(7)
    expect(context.count.value).toBe(7)
  })
})
