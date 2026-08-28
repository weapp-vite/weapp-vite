import { describe, expect, it } from 'vitest'
import {
  collectScriptCallStringLiterals,
  collectScriptStringLiterals,
  mayContainScriptCallOrModuleSyntax,
} from './scriptLiterals'

describe('script literal analysis', () => {
  it('collects all string literals in source order', () => {
    expect(collectScriptStringLiterals(`const first = 'alpha'; const second = \`beta\``)).toEqual([
      `'alpha'`,
      '`beta`',
    ])
  })

  it('collects and deduplicates literals inside calls', () => {
    expect(collectScriptCallStringLiterals(`
      createClass('text-red-500', "px-2")
      createClass('text-red-500')
      const ignored = 'outside-call'
    `)).toEqual([
      `"px-2"`,
      `'text-red-500'`,
    ])
  })

  it('detects call and module syntax without parsing', () => {
    expect(mayContainScriptCallOrModuleSyntax(`import { cva } from 'cva'`)).toBe(true)
    expect(mayContainScriptCallOrModuleSyntax(`const button = cva('px-2')`)).toBe(true)
    expect(mayContainScriptCallOrModuleSyntax(`const className = 'px-2'`)).toBe(false)
  })
})
