import type { MutableCompilerContext } from '../context'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createWebServicePlugin } from './webPlugin'

const buildMock = vi.hoisted(() => vi.fn(async () => 'build-result'))
const createServerMock = vi.hoisted(() => vi.fn())

vi.mock('vite', () => {
  return {
    build: buildMock,
    createServer: createServerMock,
  }
})

function createCtx(overrides: Partial<MutableCompilerContext['configService']> = {}) {
  const configService = {
    isDev: true,
    weappWebConfig: {
      enabled: true,
    },
    mergeWeb: vi.fn(() => ({ root: '/web-root' })),
    ...overrides,
  } as any

  return {
    configService,
  } as MutableCompilerContext
}

beforeEach(() => {
  buildMock.mockReset()
  buildMock.mockResolvedValue('build-result')
  createServerMock.mockReset()
})

describe('runtime webPlugin', () => {
  it('throws when configService is missing', () => {
    expect(() => createWebServicePlugin({} as MutableCompilerContext)).toThrow('启动 Web 服务前必须初始化 configService。')
  })

  it('starts dev server only in enabled dev mode and caches the server instance', async () => {
    const server = {
      listen: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    }
    createServerMock.mockResolvedValue(server)
    const ctx = createCtx({
      isDev: true,
      weappWebConfig: {
        enabled: true,
      },
      mergeWeb: vi.fn(() => ({ root: '/web-root' })),
    })
    createWebServicePlugin(ctx)

    expect(ctx.webService?.isEnabled()).toBe(true)

    const first = await ctx.webService?.startDevServer()
    const second = await ctx.webService?.startDevServer()

    expect(first).toBe(server)
    expect(second).toBe(server)
    expect(createServerMock).toHaveBeenCalledTimes(1)
    expect(server.listen).toHaveBeenCalledTimes(1)
    expect(server.listen).toHaveBeenCalledWith(undefined)

    await ctx.webService?.close()
    expect(server.close).toHaveBeenCalledTimes(1)
    expect(ctx.webService?.devServer).toBeUndefined()
  })

  it('passes configured dev server port through to listen', async () => {
    const server = {
      listen: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    }
    createServerMock.mockResolvedValue(server)
    const ctx = createCtx({
      mergeWeb: vi.fn(() => ({
        root: '/web-root',
        server: {
          port: 0,
        },
      })),
    })
    createWebServicePlugin(ctx)

    await ctx.webService?.startDevServer()

    expect(server.listen).toHaveBeenCalledWith(0)
  })

  it('skips starting dev server when disabled, non-dev, or mergeWeb returns undefined', async () => {
    const disabledCtx = createCtx({
      weappWebConfig: {
        enabled: false,
      },
    })
    createWebServicePlugin(disabledCtx)
    expect(await disabledCtx.webService?.startDevServer()).toBeUndefined()

    const prodCtx = createCtx({
      isDev: false,
    })
    createWebServicePlugin(prodCtx)
    expect(await prodCtx.webService?.startDevServer()).toBeUndefined()

    const noConfigCtx = createCtx({
      mergeWeb: vi.fn(() => undefined),
    })
    createWebServicePlugin(noConfigCtx)
    expect(await noConfigCtx.webService?.startDevServer()).toBeUndefined()

    expect(createServerMock).not.toHaveBeenCalled()
  })

  it('builds web output only when enabled and mergeWeb is available', async () => {
    const enabledCtx = createCtx()
    createWebServicePlugin(enabledCtx)

    await expect(enabledCtx.webService?.build()).resolves.toBe('build-result')
    expect(buildMock).toHaveBeenCalledTimes(1)

    const disabledCtx = createCtx({
      weappWebConfig: {
        enabled: false,
      },
    })
    createWebServicePlugin(disabledCtx)
    await expect(disabledCtx.webService?.build()).resolves.toBeUndefined()

    const noConfigCtx = createCtx({
      mergeWeb: vi.fn(() => undefined),
    })
    createWebServicePlugin(noConfigCtx)
    await expect(noConfigCtx.webService?.build()).resolves.toBeUndefined()
  })

  it('closes web service from closeBundle only in non-dev mode', async () => {
    const prodCtx = createCtx({
      isDev: false,
    })
    const prodPlugin = createWebServicePlugin(prodCtx)
    const prodCloseSpy = vi.spyOn(prodCtx.webService!, 'close')
    await prodPlugin.closeBundle?.()
    expect(prodCloseSpy).toHaveBeenCalledTimes(1)

    const devCtx = createCtx({
      isDev: true,
    })
    const devPlugin = createWebServicePlugin(devCtx)
    const devCloseSpy = vi.spyOn(devCtx.webService!, 'close')
    await devPlugin.closeBundle?.()
    expect(devCloseSpy).not.toHaveBeenCalled()
  })
})
