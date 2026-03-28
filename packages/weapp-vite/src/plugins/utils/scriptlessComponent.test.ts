import { describe, expect, it, vi } from 'vitest'
import { emitScriptlessComponentAsset, SCRIPTLESS_COMPONENT_STUB } from './scriptlessComponent'

describe('scriptless component helpers', () => {
  it('exposes the shared scriptless component stub', () => {
    expect(SCRIPTLESS_COMPONENT_STUB).toBe('Component({})')
  })

  it('emits scriptless component assets with the shared stub source', () => {
    const emitFile = vi.fn()

    emitScriptlessComponentAsset({ emitFile }, 'layouts/default.js')

    expect(emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: 'layouts/default.js',
      source: 'Component({})',
    })
  })
})
