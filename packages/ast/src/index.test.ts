import { describe, expect, it } from 'vitest'
import { mayContainPlatformApiAccess, mayContainStaticRequireLiteral, parseJsLikeWithEngine } from './index'
import { collectComponentPropsFromCode } from './operations/componentProps'
import { collectFeatureFlagsFromCode } from './operations/featureFlags'
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

  it('collects component props with babel and oxc', () => {
    const source = `
const options = {
  properties: {
    title: String,
    count: { type: Number, optionalTypes: [String] },
  },
}
Component(options)
`

    const expected = new Map([
      ['title', 'string'],
      ['count', 'number | string'],
    ])

    expect(collectComponentPropsFromCode(source, { astEngine: 'babel' })).toEqual(expected)
    expect(collectComponentPropsFromCode(source, { astEngine: 'oxc' })).toEqual(expected)
  })

  it('collects generic feature flags with babel and oxc', () => {
    const source = `
import { onLoad } from 'wevu'
import * as wevuNs from 'wevu'
onLoad(() => {})
wevuNs.onShow?.(() => {})
`

    const expected = new Set(['enableShare', 'enableShow'])
    const options = {
      moduleId: 'wevu',
      hookToFeature: {
        onLoad: 'enableShare',
        onShow: 'enableShow',
      } as const,
    }

    expect(collectFeatureFlagsFromCode(source, {
      ...options,
      astEngine: 'babel',
    })).toEqual(expected)
    expect(collectFeatureFlagsFromCode(source, {
      ...options,
      astEngine: 'oxc',
    })).toEqual(expected)
  })
})
