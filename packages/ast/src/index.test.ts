import { describe, expect, it } from 'vitest'
import { mayContainPlatformApiAccess, mayContainStaticRequireLiteral, parseJsLikeWithEngine } from './index'
import { collectScriptSetupImportsFromCode } from './operations/scriptSetupImports'

describe('@weapp-vite/ast', () => {
  it('supports babel and oxc engines', () => {
    expect(parseJsLikeWithEngine('export const value = 1')).toMatchObject({ type: 'File' })
    expect(parseJsLikeWithEngine('export const value = 1', { engine: 'oxc' })).toMatchObject({ type: 'Program' })
  })

  it('keeps script setup import analysis aligned', () => {
    const source = `
import type { FooProps } from './types'
import FooCard, { BarButton as RenamedButton, BazText } from './components'
`
    const names = new Set(['FooCard', 'RenamedButton'])

    expect(collectScriptSetupImportsFromCode(source, names, { astEngine: 'babel' })).toEqual(
      collectScriptSetupImportsFromCode(source, names, { astEngine: 'oxc' }),
    )
  })

  it('supports oxc fast prechecks', () => {
    expect(mayContainPlatformApiAccess('const value = wx.getStorageSync("x")', { engine: 'oxc' })).toBe(true)
    expect(mayContainPlatformApiAccess('const value = localStorage.getItem("x")', { engine: 'oxc' })).toBe(false)
    expect(mayContainStaticRequireLiteral('const mod = require("./dep")', { engine: 'oxc' })).toBe(true)
    expect(mayContainStaticRequireLiteral('const mod = require(name)', { engine: 'oxc' })).toBe(false)
  })
})
