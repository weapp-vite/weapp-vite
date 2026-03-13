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
    vi.doMock('@swc/core', () => ({
      transform,
    }))

    const { transformWithSwc, createLegacyEs5Plugin } = await import('./legacyEs5')

    const transformed = await transformWithSwc(
      'const a = 1',
      { fileName: 'app.js' } as any,
      { sourcemap: true } as any,
    )
    expect(transform).toHaveBeenCalled()
    expect(transformed.code).toBe('transformed-code')
    expect(transformed.map).toMatchObject({ version: 3 })

    const plugin = createLegacyEs5Plugin() as any
    expect(await plugin.renderChunk('', { fileName: 'empty.js' }, { sourcemap: false })).toBeNull()
    const pluginResult = await plugin.renderChunk('const b = 2', { fileName: 'chunk.js' }, { sourcemap: 'inline' })
    expect(pluginResult.code).toBe('transformed-code')
  })

  it('throws installation hint when swc module is invalid', async () => {
    const { loadSwcTransformModule } = await import('./legacyEs5')

    await expect(loadSwcTransformModule(async () => ({}))).rejects.toThrow('未安装 `@swc/core`')
  })
})
