import { describe, expect, it } from 'vitest'
import { resolveEventDirectiveName } from './events'

describe('resolveEventDirectiveName', () => {
  it('ignores invalid or empty vue event directives', () => {
    expect(resolveEventDirectiveName('@')).toBeUndefined()
    expect(resolveEventDirectiveName('@tap..stop')).toBe('catch:tap')
  })

  it('keeps unsupported alipay native bindings untouched', () => {
    expect(resolveEventDirectiveName('mut-bind:tap', 'alipay')).toBe('onTap')
    expect(resolveEventDirectiveName('capture-catch:tap', 'alipay')).toBe('captureCatchTap')
    expect(resolveEventDirectiveName('model:value', 'alipay')).toBeUndefined()
  })
})
