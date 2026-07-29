import { describe, expect, it, vi } from 'vitest'
import { webBackend } from './web'

describe('web backend', () => {
  it('creates an optional host config', () => {
    expect(webBackend.driver.createInlineConfig({
      execution: {} as any,
    })).toBeUndefined()
    expect(webBackend.driver.createInlineConfig({
      execution: {} as any,
      host: '127.0.0.1',
    })).toEqual({
      server: {
        host: '127.0.0.1',
      },
    })
  })

  it('delegates merge, build, dev and close to the Web service/context', async () => {
    const merge = vi.fn((...configs: any[]) => ({ configs }))
    const build = vi.fn(async () => 'built')
    const startDevServer = vi.fn(async () => 'server')
    const close = vi.fn(async () => {})
    const ctx = {
      webService: {
        build,
        startDevServer,
        close,
      },
    } as any

    expect(webBackend.driver.mergeConfig({ merge }, { root: '/web' })).toEqual({
      configs: [{ root: '/web' }],
    })
    await expect(webBackend.driver.build(ctx)).resolves.toBe('built')
    await expect(webBackend.driver.dev(ctx)).resolves.toBe('server')
    await webBackend.driver.close(ctx)
    expect(build).toHaveBeenCalledTimes(1)
    expect(startDevServer).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('normalizes every Web alias to the web runtime', () => {
    expect(webBackend.driver.resolvePlatformAlias?.('web')).toBe('web')
    expect(webBackend.driver.resolvePlatformAlias?.('h5')).toBe('web')
    expect(webBackend.descriptor.capabilities).toEqual({
      build: true,
      dev: true,
      ide: false,
      analyze: true,
      npm: false,
      workers: false,
      lib: false,
    })
  })
})
