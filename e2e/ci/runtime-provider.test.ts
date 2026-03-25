import { describe, expect, it } from 'vitest'
import {
  E2E_RUNTIME_PROVIDER_ENV,
  assertRuntimeProviderImplemented,
  describeRuntimeProviderSelection,
  resolveRuntimeProviderName,
} from '../utils/runtimeProvider'

describe('runtimeProvider', () => {
  it('defaults to devtools when env is unset', () => {
    expect(resolveRuntimeProviderName(undefined)).toBe('devtools')
    expect(describeRuntimeProviderSelection(undefined)).toEqual({
      envName: E2E_RUNTIME_PROVIDER_ENV,
      provider: 'devtools',
      source: 'default',
    })
  })

  it('accepts headless selection from env value', () => {
    expect(resolveRuntimeProviderName('headless')).toBe('headless')
    expect(describeRuntimeProviderSelection('headless')).toEqual({
      envName: E2E_RUNTIME_PROVIDER_ENV,
      provider: 'headless',
      source: 'env',
    })
  })

  it('rejects unknown providers with a clear error', () => {
    expect(() => resolveRuntimeProviderName('foo')).toThrowError(
      /Unsupported e2e runtime provider "foo"/,
    )
  })

  it('accepts implemented providers', () => {
    expect(() => assertRuntimeProviderImplemented('headless')).not.toThrow()
    expect(() => assertRuntimeProviderImplemented('devtools')).not.toThrow()
  })
})
