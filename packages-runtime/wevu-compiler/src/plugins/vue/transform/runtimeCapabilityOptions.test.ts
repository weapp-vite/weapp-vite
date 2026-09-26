import { describe, expect, it } from 'vitest'
import { transformScript } from './script'

describe('runtime capability option lexical scopes', () => {
  it('reads outer option values instead of shadowing factory locals', () => {
    const result = transformScript(`
import { createApp } from 'wevu'
const strategy = 'patch'
const highFrequencyWarning = true
const options = { setData: { strategy, highFrequencyWarning } }
function boot() {
  const strategy = 'diff'
  const highFrequencyWarning = false
  return createApp(options)
}
boot()
    `.trim(), { sourceMap: false })

    expect(result.runtimeCapabilities).toEqual({
      required: ['patchStrategy', 'setDataHighFrequencyWarning'],
    })
  })

  it('follows aliases across different bindings with the same identifier name', () => {
    const result = transformScript(`
import { createApp } from 'wevu'
const strategy = 'patch'
const outerStrategy = strategy
function boot() {
  const strategy = outerStrategy
  const options = { setData: { strategy } }
  return createApp(options)
}
boot()
    `.trim(), { sourceMap: false })

    expect(result.runtimeCapabilities).toEqual({ required: ['patchStrategy'] })
  })

  it('preserves declaration scopes through option, setData and warning aliases', () => {
    const result = transformScript(`
import { createWevuComponent as register } from 'wevu'
const enabled = true
const warning = { enabled }
const setData = { highFrequencyWarning: warning }
const original = { setData }
const options = original
function boot() {
  const enabled = false
  const warning = false
  const setData = { strategy: 'diff' }
  const original = {}
  return register(options)
}
boot()
    `.trim(), { sourceMap: false })

    expect(result.runtimeCapabilities).toEqual({ required: ['setDataHighFrequencyWarning'] })
  })

  it('keeps inherited option values in the extends declaration scope', () => {
    const result = transformScript(`
import { defineComponent } from 'wevu'
const strategy = 'patch'
const base = { setData: { strategy } }
const options = { extends: base }
function boot() {
  const strategy = 'diff'
  const base = {}
  return defineComponent(options)
}
boot()
    `.trim(), { sourceMap: false })

    expect(result.runtimeCapabilities).toEqual({ required: ['patchStrategy'] })
  })

  it('resolves mixin elements in the array declaration scope', () => {
    const result = transformScript(`
import { defineComponent } from 'wevu'
const enabled = true
const feature = { setData: { highFrequencyWarning: { enabled } } }
const mixins = [feature]
function boot() {
  const enabled = false
  const feature = {}
  return defineComponent({ mixins })
}
boot()
    `.trim(), { sourceMap: false })

    expect(result.runtimeCapabilities).toEqual({ required: ['setDataHighFrequencyWarning'] })
  })

  it('resolves both manual defaults branches in their declaration scopes', () => {
    const result = transformScript(`
import { setWevuDefaults } from 'wevu'
const strategy = 'patch'
const highFrequencyWarning = true
const app = { setData: { strategy } }
const component = { setData: { highFrequencyWarning } }
const defaults = { app, component }
function boot() {
  const strategy = 'diff'
  const highFrequencyWarning = false
  const app = {}
  const component = {}
  setWevuDefaults(defaults)
}
boot()
    `.trim(), { sourceMap: false })

    expect(result.runtimeCapabilities).toEqual({
      required: ['patchStrategy', 'setDataHighFrequencyWarning'],
    })
  })

  it('resolves explicit overrides after spreads in their declaration scope', () => {
    const result = transformScript(`
import { createApp } from 'wevu'
const strategy = 'patch'
const enabled = true
const options = {
  ...getOptions(),
  setData: {
    ...getSetData(),
    strategy,
    highFrequencyWarning: { ...getWarning(), enabled },
  },
}
function boot() {
  const strategy = 'diff'
  const enabled = false
  return createApp(options)
}
boot()
    `.trim(), { sourceMap: false })

    expect(result.runtimeCapabilities).toEqual({
      required: ['patchStrategy', 'setDataHighFrequencyWarning'],
    })
  })

  it('does not install capabilities enabled only by shadowing locals', () => {
    const result = transformScript(`
import { createApp } from 'wevu'
const strategy = 'diff'
const enabled = false
const options = {
  setData: { strategy, highFrequencyWarning: { enabled } },
}
function boot() {
  const strategy = 'patch'
  const enabled = true
  return createApp(options)
}
boot()
    `.trim(), { sourceMap: false })

    expect(result.runtimeCapabilities).toBeUndefined()
  })

  it('keeps late spreads and escaped aliases conservative across scopes', () => {
    const result = transformScript(`
import { createApp } from 'wevu'
const strategy = 'diff'
const setData = { strategy, highFrequencyWarning: false, ...getOverrides() }
const options = { setData }
consume(options)
function boot() {
  const setData = {}
  return createApp(options)
}
boot()
    `.trim(), { sourceMap: false })

    expect(result.runtimeCapabilities).toEqual({
      required: ['patchStrategy', 'setDataHighFrequencyWarning'],
      conservative: ['patchStrategy', 'setDataHighFrequencyWarning'],
    })
  })
})
