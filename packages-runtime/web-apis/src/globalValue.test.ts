import { REQUEST_GLOBAL_PLACEHOLDER_KEY, WEB_RUNTIME_GLOBAL_INSTALL_PREDICATE } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { isNativeOwnedRequestGlobal, isPlaceholderRequestGlobal, markWebRuntimeGlobalInstalled, resolveGlobalValue, shouldInstallWebRuntimeGlobal } from './globalValue'
import * as runtime from './runtime'

describe('shared global install predicate', () => {
  it('reads computed globals without Reflect and tolerates inaccessible properties', () => {
    const key = '__wevuGlobalValueProbe__'
    const value = { now: () => 1 }
    Object.defineProperty(globalThis, key, { configurable: true, value })
    Object.defineProperty(globalThis, `${key}Throwing__`, {
      configurable: true,
      get() {
        throw new Error('inaccessible')
      },
    })

    try {
      expect(resolveGlobalValue<typeof value>(key)).toBe(value)
      expect(resolveGlobalValue(`${key}Throwing__`)).toBeUndefined()
    }
    finally {
      Reflect.deleteProperty(globalThis, key)
      Reflect.deleteProperty(globalThis, `${key}Throwing__`)
    }
  })

  it('exports the predicate under the shared constant name', () => {
    expect((runtime as Record<string, unknown>)[WEB_RUNTIME_GLOBAL_INSTALL_PREDICATE]).toBe(shouldInstallWebRuntimeGlobal)
  })

  it('marks bridge-owned values so a later generation can replace them', () => {
    const installed = markWebRuntimeGlobalInstalled(() => {})

    expect(isNativeOwnedRequestGlobal(installed)).toBe(true)
    expect(shouldInstallWebRuntimeGlobal(installed)).toBe(true)
    expect(markWebRuntimeGlobalInstalled(installed)).toBe(installed)
  })

  it('does not mark host values that cannot be extended', () => {
    const hostValue = Object.freeze(() => {})

    expect(() => markWebRuntimeGlobalInstalled(hostValue)).not.toThrow()
    expect(isNativeOwnedRequestGlobal(hostValue)).toBe(false)
    expect(shouldInstallWebRuntimeGlobal(hostValue)).toBe(false)
  })

  it('treats missing and placeholder values as installable and keeps real implementations', () => {
    expect(shouldInstallWebRuntimeGlobal(undefined)).toBe(true)
    expect(shouldInstallWebRuntimeGlobal(null)).toBe(true)
    expect(shouldInstallWebRuntimeGlobal({ [REQUEST_GLOBAL_PLACEHOLDER_KEY]: true })).toBe(true)
    expect(shouldInstallWebRuntimeGlobal(Object.assign(() => {}, { [REQUEST_GLOBAL_PLACEHOLDER_KEY]: true }))).toBe(true)
    expect(shouldInstallWebRuntimeGlobal(() => {})).toBe(false)
    expect(shouldInstallWebRuntimeGlobal({})).toBe(false)
    expect(isPlaceholderRequestGlobal({})).toBe(false)
    expect(isPlaceholderRequestGlobal({ [REQUEST_GLOBAL_PLACEHOLDER_KEY]: true })).toBe(true)
  })
})
