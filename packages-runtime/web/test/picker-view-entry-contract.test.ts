import { afterEach, describe, expect, it, vi } from 'vitest'

describe('picker-view entry host fallback', () => {
  afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('loads without a browser HTMLElement constructor', async () => {
    vi.stubGlobal('HTMLElement', undefined)
    const [{ WeappPickerView }, { WeappVideo }] = await Promise.all([
      import('../src/runtime/nativeComponents/pickerView'),
      import('../src/runtime/nativeComponents/video'),
    ])
    expect(WeappPickerView).toBeTypeOf('function')
    expect(WeappVideo).toBeTypeOf('function')
  })
})
