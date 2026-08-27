import { describe, expect, it } from 'vitest'
import { resolveRuntimeGlobalValue, resolveRuntimeRoot } from './runtimeGlobal'

const runtimeRoot = globalThis as Record<string, unknown>

function withMaskedGlobalThis<T>(callback: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(runtimeRoot, 'globalThis')
  Object.defineProperty(runtimeRoot, 'globalThis', {
    configurable: true,
    value: undefined,
  })
  try {
    return callback()
  }
  finally {
    if (descriptor) {
      Object.defineProperty(runtimeRoot, 'globalThis', descriptor)
    }
    else {
      delete runtimeRoot.globalThis
    }
  }
}

describe('runtime global resolver', () => {
  afterEach(() => {
    delete runtimeRoot.window
  })

  it('falls back to global when globalThis is unavailable', () => {
    const root = withMaskedGlobalThis(() => resolveRuntimeRoot())

    expect(root).toBe(runtimeRoot)
  })

  it('reads runtime values from global fallback when globalThis is unavailable', () => {
    const adapter = { request() {} }
    runtimeRoot.my = adapter
    try {
      const value = withMaskedGlobalThis(() => resolveRuntimeGlobalValue('my'))

      expect(value).toBe(adapter)
    }
    finally {
      delete runtimeRoot.my
    }
  })

  it('reads runtime values from window when the primary root does not own them', () => {
    const adapter = { request() {} }
    runtimeRoot.window = {
      my: adapter,
    }

    expect(resolveRuntimeGlobalValue('my', runtimeRoot)).toBe(adapter)
  })
})
