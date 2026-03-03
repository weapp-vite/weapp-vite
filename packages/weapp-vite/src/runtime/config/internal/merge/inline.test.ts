import { describe, expect, it, vi } from 'vitest'
import { ensureConfigService, mergeInlineConfig, stripRollupOptions } from './inline'

describe('runtime config merge inline', () => {
  it('ensures configService exists before merge', () => {
    expect(() => ensureConfigService({} as any)).toThrow('合并配置前必须初始化 configService。')
    expect(() => ensureConfigService({ configService: {} } as any)).not.toThrow()
  })

  it('strips legacy rollupOptions from build config', () => {
    const config: any = {
      build: {
        target: 'esnext',
        rollupOptions: {
          input: 'src/main.ts',
        },
      },
    }

    stripRollupOptions(config)
    expect(config.build.target).toBe('esnext')
    expect(config.build.rollupOptions).toBeUndefined()
  })

  it('merges inline config and injects aliases after stripping rollupOptions', () => {
    const injectBuiltinAliases = vi.fn((config: any) => {
      config.resolve = {
        alias: {
          '@': '/project/src',
        },
      }
    })

    const result = mergeInlineConfig(
      {
        build: {
          target: 'esnext',
          rollupOptions: {
            input: 'src/main.ts',
          },
        },
      } as any,
      injectBuiltinAliases,
      {
        mode: 'development',
        build: {
          minify: false,
        },
      },
    )

    expect(result.mode).toBe('development')
    expect(result.build?.target).toBe('esnext')
    expect(result.build?.minify).toBe(false)
    expect((result.build as any).rollupOptions).toBeUndefined()
    expect(injectBuiltinAliases).toHaveBeenCalledTimes(1)
    expect((result.resolve as any)?.alias?.['@']).toBe('/project/src')
  })
})
