import type { TransformContext } from '../../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/types'
import type { RecordOptions } from './types'
import { describe, expect, it } from 'vitest'
import { planBindingRecord } from './plan'

describe('compile binding request freezing', () => {
  it('captures current scopes, normalized outer lists, safe calls and source locations before mutation', () => {
    const context = {
      rewriteScopedSlot: true,
      scopeStack: [new Set(['item'])],
      templateSafeCallNames: new Set(['safe']),
      forStack: [{ item: 'item', index: 'index', rawListExp: 'items', itemAliases: { title: 'item.title' } }],
    } as unknown as TransformContext
    const options: RecordOptions = {
      kind: 'text',
      expression: 'title + suffix',
      sourceLocation: { start: { line: 1, column: 2, offset: 1 }, end: { line: 1, column: 3, offset: 2 } },
      scopes: [{ kind: 'for', depth: 1, locals: ['item'] }],
      scopeDependencies: [{ expression: 'outside + local', locals: ['local'] }],
    }
    const locals = ['extra']
    const normalizationCalls: Array<{ expression: string, scopes: number, loops: number }> = []
    const planned = planBindingRecord(options, context, locals, (expression, current) => {
      normalizationCalls.push({ expression, scopes: current!.scopeStack.length, loops: current!.forStack.length })
      return `normalized:${expression}`
    })
    context.scopeStack[0]!.add('later')
    context.templateSafeCallNames.add('laterSafe')
    context.forStack[0]!.rawListExp = 'laterList'
    context.forStack[0]!.itemAliases!.title = 'laterAlias'
    options.expression = 'laterExpression'
    options.scopes![0]!.locals!.push('laterLocal')
    options.scopeDependencies![0]!.locals.push('laterScope')
    options.sourceLocation!.start.line = 99
    locals.push('laterExtra')
    expect(normalizationCalls).toEqual([
      { expression: 'title + suffix', scopes: 1, loops: 1 },
      { expression: 'items', scopes: 0, loops: 0 },
    ])
    expect(planned.inputs).toEqual([
      { expression: 'normalized:title + suffix', locals: ['item', 'extra'], safeCallNames: ['safe'] },
      { expression: 'normalized:items', locals: [], safeCallNames: ['safe'] },
      { expression: 'outside + local', locals: ['local'], safeCallNames: [] },
    ])
    expect(planned.context.forStack[0]).toMatchObject({ rawListExp: 'normalized:items', itemAliases: { title: 'item.title' } })
    expect([...planned.context.scopeStack[0]!]).toEqual(['item'])
    expect(planned.options.scopes![0]!.locals).toEqual(['item'])
    expect(planned.options.sourceLocation!.start.line).toBe(1)
    expect(Object.isFrozen(planned.inputs[0]!.locals)).toBe(true)
  })

  it('preserves nullish raw-list selection and skips outer analysis when there are no locals', () => {
    const context = {
      rewriteScopedSlot: false,
      scopeStack: [],
      templateSafeCallNames: new Set<string>(),
      forStack: [{ rawListExp: '', listExp: 'mustNotUse' }, { rawListExp: 'items' }],
    } as unknown as TransformContext
    const planned = planBindingRecord({ kind: 'text', expression: 'value' }, context, undefined, expression => expression)
    expect(planned.inputs).toEqual([{ expression: 'value', locals: [], safeCallNames: [] }])
    expect(planned.context.forStack[0]!.rawListExp).toBe('')
  })
})
