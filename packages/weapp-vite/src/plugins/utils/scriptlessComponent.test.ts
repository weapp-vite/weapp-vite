import { describe, expect, it, vi } from 'vitest'
import {
  emitScriptlessComponentAsset,
  ensureScriptlessComponentAsset,
  resolveScriptlessComponentFileName,
  SCRIPTLESS_COMPONENT_STUB,
} from './scriptlessComponent'

describe('scriptless component helpers', () => {
  it('exposes the shared scriptless component stub', () => {
    expect(SCRIPTLESS_COMPONENT_STUB).toBe('Component({})')
  })

  it('resolves the shared scriptless component file name', () => {
    expect(resolveScriptlessComponentFileName('layouts/default/index', 'js')).toBe('layouts/default/index.js')
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

  it('ensures a scriptless component asset exists in bundle', () => {
    const emitFile = vi.fn()
    const bundle: Record<string, any> = {}

    const fileName = ensureScriptlessComponentAsset(
      { emitFile },
      bundle,
      'layouts/default/index',
      'js',
    )

    expect(fileName).toBe('layouts/default/index.js')
    expect(emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: 'layouts/default/index.js',
      source: 'Component({})',
    })
  })

  it('rewrites existing asset source to the shared stub', () => {
    const emitFile = vi.fn()
    const bundle: Record<string, any> = {
      'layouts/default/index.js': {
        type: 'asset',
        source: 'Component({ data: { ready: true } })',
      },
    }

    const fileName = ensureScriptlessComponentAsset(
      { emitFile },
      bundle,
      'layouts/default/index',
      'js',
    )

    expect(fileName).toBe('layouts/default/index.js')
    expect(bundle['layouts/default/index.js'].source).toBe('Component({})')
    expect(emitFile).not.toHaveBeenCalled()
  })
})
