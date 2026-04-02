import { describe, expect, it } from 'vitest'
import { normalizeClassBindingExpression, normalizeStyleBindingExpression } from './bindings'

function createContext() {
  return {
    warnings: [] as string[],
    rewriteScopedSlot: false,
    scopeStack: [],
    slotPropStack: [],
    forStack: [],
  } as any
}

describe('template expression bindings', () => {
  it('normalizes class bindings and records spread warnings', () => {
    const context = createContext()
    const result = normalizeClassBindingExpression(
      `[baseClass, { active: isActive, [dynamicClass]: enabled }, ...extraClass]`,
      context,
    )

    expect(result.some(exp => exp.includes('baseClass'))).toBe(true)
    expect(result.some(exp => exp.includes('active'))).toBe(true)
    expect(result.some(exp => exp.includes('dynamicClass'))).toBe(true)
    expect(context.warnings.some((message: string) => message.includes(':class'))).toBe(true)
  })

  it('normalizes style bindings and records spread warnings', () => {
    const context = createContext()
    const result = normalizeStyleBindingExpression(
      `[{ color }, { width: width + 'px', [dynamicKey]: dynamicValue }, ...extraStyle]`,
      context,
    )

    expect(result.some(exp => exp.includes('__weapp_vite.stylePair'))).toBe(true)
    expect(result.some(exp => exp.includes('dynamicKey'))).toBe(true)
    expect(context.warnings.some((message: string) => message.includes(':style'))).toBe(true)
  })

  it('falls back to original expression when parsing fails', () => {
    const classContext = createContext()
    const styleContext = createContext()

    expect(normalizeClassBindingExpression('foo +', classContext)).toEqual(['foo +'])
    expect(normalizeStyleBindingExpression('foo +', styleContext)).toEqual(['foo +'])
  })
})
