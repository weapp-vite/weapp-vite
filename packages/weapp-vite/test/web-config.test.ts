import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { resolveWeappWebConfig } from '@/runtime/config/web'

describe('resolveWeappWebConfig', () => {
  it('returns undefined when feature disabled', () => {
    const cwd = path.resolve(process.cwd(), 'virtual/project')
    const result = resolveWeappWebConfig({
      cwd,
      srcRoot: 'src',
      config: {
        enable: false,
      },
    })
    expect(result).toBeUndefined()
  })

  it('falls back to srcRoot when srcDir not provided', () => {
    const cwd = path.resolve(process.cwd(), 'virtual/project')
    const result = resolveWeappWebConfig({
      cwd,
      srcRoot: 'miniprogram',
      config: {
        enable: true,
      },
    })
    expect(result).toBeDefined()
    expect(result?.root).toBe(cwd)
    expect(result?.srcDir).toBe('miniprogram')
    expect(result?.pluginOptions.srcDir).toBe('miniprogram')
    expect(result?.outDir).toBe(path.resolve(cwd, 'dist/web'))
  })

  it('resolves custom root/srcDir/outDir and preserves plugin options', () => {
    const cwd = path.resolve(process.cwd(), 'virtual/project')
    const root = 'examples/web'
    const absoluteSrc = path.resolve(cwd, 'custom-src')
    const result = resolveWeappWebConfig({
      cwd,
      srcRoot: 'src',
      config: {
        enable: true,
        root,
        srcDir: absoluteSrc,
        outDir: 'build/web',
        pluginOptions: {
          wxss: {
            pxPerRpx: 2,
          },
        },
      },
    })
    expect(result).toBeDefined()
    expect(result?.root).toBe(path.resolve(cwd, root))
    expect(result?.srcDir).toBe(path.relative(result!.root, absoluteSrc))
    expect(result?.outDir).toBe(path.resolve(result!.root, 'build/web'))
    expect(result?.pluginOptions.wxss).toEqual({ pxPerRpx: 2 })
    expect(result?.pluginOptions.srcDir).toBe(result?.srcDir)
  })
})
