import { REQUEST_GLOBAL_PLACEHOLDER_KEY, WEB_RUNTIME_GLOBAL_INSTALL_PREDICATE } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { isPlaceholderRequestGlobal, shouldInstallWebRuntimeGlobal } from './globalValue'
import * as runtime from './runtime'

describe('shared global install predicate', () => {
  it('exports the predicate under the shared constant name', () => {
    expect((runtime as Record<string, unknown>)[WEB_RUNTIME_GLOBAL_INSTALL_PREDICATE]).toBe(shouldInstallWebRuntimeGlobal)
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
