import { describe, expect, it } from 'vitest'
import { assertNodeStackBudget, CHROMIUM_ARGUMENTS, NODE_STACK_ARGUMENT } from './runtime'

describe('fixed parser benchmark stack budget', () => {
  it('requires the same explicit 4096 KiB V8 budget instead of inheriting a default', () => {
    expect(() => assertNodeStackBudget([NODE_STACK_ARGUMENT, '--import', 'tsx'])).not.toThrow()
    expect(() => assertNodeStackBudget(['--stack_size=4096'])).not.toThrow()
    expect(() => assertNodeStackBudget(['--stack-size', '4096'])).not.toThrow()
    expect(() => assertNodeStackBudget([])).toThrow('stack budget')
    expect(() => assertNodeStackBudget(['--stack-size=2048'])).toThrow('stack budget')
    expect(() => assertNodeStackBudget(['--stack-size=2048', NODE_STACK_ARGUMENT])).toThrow('stack budget')
    expect(CHROMIUM_ARGUMENTS).toEqual(['--enable-automation', '--js-flags=--stack-size=4096'])
  })
})
