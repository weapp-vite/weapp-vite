import { afterEach, describe, expect, it, vi } from 'vitest'
import { installWebHostGlobals } from '../src/runtime/hostGlobals'
import { setRuntimeWarningOptions } from '../src/runtime/warning'

afterEach(() => {
  setRuntimeWarningOptions()
  vi.restoreAllMocks()
})

describe('Web host globals', () => {
  it('provides constructor and Behavior identity semantics for module initialization', () => {
    const target = {} as Record<PropertyKey, any>
    installWebHostGlobals(target)
    const options = { methods: { ready: true } }

    expect(target.App(options)).toBe(options)
    expect(target.Page(options)).toBe(options)
    expect(target.Component(options)).toBe(options)
    expect(target.Behavior(options)).toBe(options)
  })

  it('provides no-op compile-time macros for native TypeScript modules', () => {
    const target = {} as Record<PropertyKey, any>
    installWebHostGlobals(target)
    const meta = { layout: 'default' }

    expect(target.definePageMeta(meta)).toBe(meta)
    expect(target.definePageJson(meta)).toBe(meta)
    expect(target.defineAppJson(meta)).toBe(meta)
  })

  it('degrades unavailable plugins to a warning proxy without throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const target = {} as Record<PropertyKey, any>
    installWebHostGlobals(target)

    const plugin = target.requirePlugin('hello-plugin')
    expect(plugin.sayHello()).toBeUndefined()
    expect(plugin.answer).toBeUndefined()
    expect(plugin.then).toBeUndefined()
    target.requirePlugin('hello-plugin')
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('preserves host-provided globals during repeated installation', () => {
    const identity = vi.fn((value: unknown) => value)
    const target = {
      App: identity,
      Page: identity,
      Component: identity,
      Behavior: identity,
      defineAppJson: identity,
      defineComponentJson: identity,
      definePageJson: identity,
      definePageMeta: identity,
      defineSitemapJson: identity,
      defineThemeJson: identity,
      requirePlugin: identity,
    }

    installWebHostGlobals(target)

    expect(Object.values(target).every(value => value === identity)).toBe(true)
  })
})
