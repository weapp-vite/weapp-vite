/* eslint-disable no-extend-native -- 原型访问器只用于复现继承规则，finally 完整恢复。 */
import type { OutputChunk } from 'rolldown'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rewriteChunkNpmImportsToLocalRoot } from '../localRoot'

describe('local root sparse pattern contracts', () => {
  beforeEach(() => {
    vi.stubEnv('WEAPP_VITE_NATIVE', '0')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([false, true])('preserves inherited pattern getters (non-index key=%s)', (extraKey) => {
    const index = '99'
    const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, index)
    expect(descriptor).toBeUndefined()
    const patterns = Array.from({ length: 99 }).fill('ui-lib')
    patterns.length = 100
    if (extraKey) {
      Object.defineProperty(patterns, '4294967295', { value: 'ui-lib', configurable: true })
    }
    const chunk = {
      type: 'chunk',
      fileName: 'pages/index.js',
      code: String.raw`const matcher = /\B/; const dep = require('other-lib/button')`,
      map: null,
      imports: [],
      moduleIds: [],
    } as unknown as OutputChunk
    let reads = 0
    try {
      Object.defineProperty(Array.prototype, index, {
        configurable: true,
        get(this: unknown[]) {
          if (this === patterns) {
            return ++reads === 1 ? 'ui-lib' : 'other-lib'
          }
        },
        set(this: unknown[], value: unknown) {
          Object.defineProperty(this, index, { value, writable: true, enumerable: true, configurable: true })
        },
      })
      rewriteChunkNpmImportsToLocalRoot(chunk, '', patterns, {}, { collectPlatformApiAccess: false })
    }
    finally {
      if (descriptor) {
        Object.defineProperty(Array.prototype, index, descriptor)
      }
      else {
        delete (Array.prototype as unknown as Record<string, unknown>)[index]
      }
    }

    expect(chunk.code).toContain('require("../miniprogram_npm/other-lib/button")')
    expect(reads).toBe(2)
    expect(Object.getOwnPropertyDescriptor(Array.prototype, index)).toBeUndefined()
  })
})
