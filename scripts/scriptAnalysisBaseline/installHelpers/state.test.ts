import { describe, expect, it, vi } from 'vitest'
import { ScriptBaselineState } from './state'

describe('script baseline AST ownership', () => {
  it('consumes an existing AST once only when the final source is byte-identical', () => {
    const state = new ScriptBaselineState()
    const session = state.beginCompile()
    const ast = { type: 'File' }
    let owned: unknown = ast
    const take = vi.fn(() => {
      const current = owned
      owned = undefined
      return current
    })
    const token = state.createTransfer(session, 'export default {}', take)
    expect(state.takeAst('export default {}', token)).toBe(ast)
    expect(owned).toBeUndefined()
    expect(state.takeAst('export default {}', token)).toBeUndefined()
    expect(take).toHaveBeenCalledTimes(1)
    state.endCompile(session)
    expect(state.snapshot()).toMatchObject({ astReuse: 1, astAlreadyConsumed: 1, activeCompiles: 0, pendingTransfers: 0 })
  })

  it('does not obtain or parse an AST when source changed or fast setup never consumes the transfer', () => {
    const state = new ScriptBaselineState()
    const first = state.beginCompile()
    const changed = vi.fn(() => ({ type: 'File' }))
    const token = state.createTransfer(first, 'const value = 1', changed)
    expect(state.takeAst('const value=1', token)).toBeUndefined()
    expect(changed).not.toHaveBeenCalled()
    state.endCompile(first)
    const second = state.beginCompile()
    const fast = vi.fn(() => ({ type: 'File' }))
    state.createTransfer(second, 'const value = 1', fast)
    state.endCompile(second)
    expect(fast).not.toHaveBeenCalled()
    expect(state.snapshot()).toMatchObject({ astSourceMismatch: 1, astNotConsumed: 1, astReuse: 0, activeCompiles: 0, pendingTransfers: 0 })
  })

  it('keeps concurrent compilations isolated and never reuses expired or unavailable ASTs', () => {
    const state = new ScriptBaselineState()
    const first = state.beginCompile()
    const second = state.beginCompile()
    const expired = state.createTransfer(first, 'same source', () => ({ owner: 'first' }))
    const available = state.createTransfer(second, 'same source', () => ({ owner: 'second' }))
    expect(() => state.reset()).toThrow(/active compilation/)
    state.endCompile(first)
    expect(state.takeAst('same source', expired)).toBeUndefined()
    expect(state.takeAst('same source', available)).toEqual({ owner: 'second' })
    const missing = state.createTransfer(second, 'same source', () => undefined)
    expect(state.takeAst('same source', missing)).toBeUndefined()
    state.endCompile(second)
    state.assertIdle()
    state.reset()
    expect(Object.values(state.snapshot()).every(value => value === 0)).toBe(true)
  })

  it('releases unconsumed AST closures on exceptional cleanup without calling them', () => {
    const state = new ScriptBaselineState()
    const session = state.beginCompile()
    const take = vi.fn(() => ({ type: 'File' }))
    const token = state.createTransfer(session, 'source', take)
    state.release()
    state.assertIdle()
    expect(token.take).toBeUndefined()
    expect(token.source).toBeUndefined()
    expect(take).not.toHaveBeenCalled()
  })
})

describe('script baseline conservative prefilters', () => {
  it('delegates the page-meta decision to the production hint and preserves the unknown-source path', () => {
    const state = new ScriptBaselineState()
    const hint = vi.fn((source: string) => source.includes('definePageMeta') || source.includes('\\'))
    expect(state.skipPageMeta(undefined, hint)).toBe(false)
    expect(hint).not.toHaveBeenCalled()
    expect(state.skipPageMeta('const value = 1', hint)).toBe(true)
    expect(state.skipPageMeta('definePageMeta({})', hint)).toBe(false)
    expect(state.skipPageMeta('defin\\u0065PageMeta({})', hint)).toBe(false)
    expect(state.snapshot()).toMatchObject({ pageMetaSkipped: 1, pageMetaAnalyzed: 3 })
  })

  it('skips reserved-props parsing only without an observer or with an unescaped negative source hint', () => {
    const state = new ScriptBaselineState()
    const warn = () => {}
    expect(state.skipReservedProps('defineProps({ id: String })', undefined)).toBe(true)
    expect(state.skipReservedProps('const count = 1', warn)).toBe(true)
    expect(state.skipReservedProps('defin\\u0065Props({ id: String })', warn)).toBe(false)
    expect(state.skipReservedProps('interface Props { id: string }; defineProps<Props>()', warn)).toBe(false)
    expect(state.snapshot()).toMatchObject({ reservedSkipped: 2, reservedAnalyzed: 2 })
  })
})
