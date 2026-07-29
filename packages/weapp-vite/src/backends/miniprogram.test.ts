import { describe, expect, it, vi } from 'vitest'
import { miniprogramBackend } from './miniprogram'

function createExecution(runWeb: boolean) {
  return {
    get: (id: string) => runWeb && id === 'web' ? {} : undefined,
  } as any
}

describe('miniprogram backend Web combinations', () => {
  it('creates no inline config when no platform, scope or Web execution is selected', () => {
    expect(miniprogramBackend.driver.createInlineConfig({
      execution: createExecution(false),
    })).toBeUndefined()
  })

  it('creates Web watch config for combined execution', () => {
    expect(miniprogramBackend.driver.createInlineConfig({
      execution: createExecution(true),
    })).toMatchObject({
      build: { watch: {} },
      server: {
        port: 0,
        watch: {
          usePolling: true,
          interval: 100,
        },
      },
    })
  })

  it('keeps mini-program platform and build scope when explicitly selected', () => {
    expect(miniprogramBackend.driver.createInlineConfig({
      execution: createExecution(true),
      platform: 'alipay',
      scope: 'subpackage:goods',
    })).toMatchObject({
      weapp: {
        platform: 'alipay',
        buildScope: {
          include: ['subpackage:goods'],
          includeMainPackage: true,
        },
      },
      server: {
        port: 0,
      },
    })
  })

  it('creates minimal configs for platform-only and scope-only execution', () => {
    expect(miniprogramBackend.driver.createInlineConfig({
      execution: createExecution(false),
      platform: 'weapp',
    })).toEqual({
      weapp: { platform: 'weapp' },
    })
    expect(miniprogramBackend.driver.createInlineConfig({
      execution: createExecution(false),
      scope: 'main',
    })).toMatchObject({
      weapp: {
        buildScope: {
          includeMainPackage: true,
        },
      },
    })
  })

  it('ignores the web platform marker and delegates config merging', () => {
    expect(miniprogramBackend.driver.createInlineConfig({
      execution: createExecution(false),
      platform: 'web',
    })).toBeUndefined()
    const merge = vi.fn((...configs: any[]) => configs)
    expect(miniprogramBackend.driver.mergeConfig({ merge }, { mode: 'test' })).toEqual([{ mode: 'test' }])
    expect(miniprogramBackend.driver.resolvePlatformAlias?.('wechat')).toBe('weapp')
  })

  it('delegates mini-program operations to compiler services', async () => {
    const build = vi.fn(async () => 'built')
    const close = vi.fn()
    const ctx = {
      buildService: { build },
      watcherService: { closeAll: close },
    } as any

    await expect(miniprogramBackend.driver.build(ctx, { mode: 'production' } as any)).resolves.toBe('built')
    await expect(miniprogramBackend.driver.dev(ctx, { mode: 'development' } as any)).resolves.toBe('built')
    miniprogramBackend.driver.close(ctx)

    expect(build).toHaveBeenCalledTimes(2)
    expect(close).toHaveBeenCalledTimes(1)
  })
})
