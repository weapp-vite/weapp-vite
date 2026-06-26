import { describe, expect, it } from 'vitest'
import { createWevuRootImportHmrComposableSource, WEVU_ROOT_HMR_EXPORTS } from './wevu-root-hmr-exports'

describe('wevu root HMR export fixture generator', () => {
  it('generates a root wevu import for every guarded value export', () => {
    const source = createWevuRootImportHmrComposableSource('ROOT_EXPORT_GUARD')

    for (const exportName of WEVU_ROOT_HMR_EXPORTS) {
      expect(source).toContain(`${exportName} as __wevuRoot_${exportName}`)
    }
  })

  it('keeps the runtime APIs that previously failed in active setup code', () => {
    const source = createWevuRootImportHmrComposableSource('ROOT_EXPORT_GUARD')

    expect(source).toContain('__wevuRoot_onShareAppMessage(() =>')
    expect(source).toContain('__wevuRoot_unref(label)')
    expect(source).toContain('__wevuRoot_computed(() =>')
    expect(source).toContain('__wevuRoot_ref(\'ROOT_EXPORT_GUARD\')')
    expect(source).toContain(`const rootExportGuardCount = ${WEVU_ROOT_HMR_EXPORTS.length}`)
  })
})
