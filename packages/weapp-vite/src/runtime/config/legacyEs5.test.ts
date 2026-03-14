import { afterEach, describe, expect, it, vi } from 'vitest'

describe('legacyEs5 runtime transform', () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock('@swc/core')
  })

  it('transforms chunk with swc and normalizes source map', async () => {
    const transform = vi.fn(async () => ({
      code: 'transformed-code',
      map: '{"version":3,"mappings":""}',
    }))

    const { transformWithSwc } = await import('./legacyEs5')
    const importer = vi.fn(async () => ({
      transform,
    }))

    const transformed = await transformWithSwc(
      'const a = 1',
      { fileName: 'app.js' } as any,
      { sourcemap: true } as any,
      importer,
    )
    expect(transform).toHaveBeenCalled()
    expect(transformed.code).toBe('transformed-code')
    expect(transformed.map).toMatchObject({ version: 3 })

    const pluginResult = await transformWithSwc(
      'const b = 2',
      { fileName: 'chunk.js' } as any,
      { sourcemap: 'inline' } as any,
      importer,
    )
    expect(pluginResult.code).toBe('transformed-code')
  })

  it('throws installation hint when swc module is invalid', async () => {
    const { loadSwcTransformModule } = await import('./legacyEs5')

    await expect(loadSwcTransformModule(async () => ({}))).rejects.toThrow('已废弃的 `weapp.es5`')
  })
})
