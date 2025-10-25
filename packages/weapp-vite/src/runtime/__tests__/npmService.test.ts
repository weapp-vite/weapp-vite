import type { MutableCompilerContext } from '../../context'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtimeState'

describe('npmService bundleBuild', () => {
  const buildMock = vi.fn().mockResolvedValue(undefined)
  let createNpmServicePlugin: (ctx: MutableCompilerContext) => unknown

  beforeEach(async () => {
    vi.resetModules()
    vi.doMock('tsdown', () => ({
      build: buildMock,
    }))
    const npmModule = await import('../npmPlugin')
    createNpmServicePlugin = npmModule.createNpmServicePlugin
    buildMock.mockClear()
  })

  function createContext(isDev: boolean) {
    const ctx = {
      runtimeState: createRuntimeState(),
    } as MutableCompilerContext
    ctx.configService = {
      weappViteConfig: {},
      isDev,
    } as unknown as MutableCompilerContext['configService']
    return ctx
  }

  it('enables minify and targets es6 in dev mode', async () => {
    const ctx = createContext(true)
    createNpmServicePlugin(ctx)
    await ctx.npmService!.bundleBuild({
      entry: { index: '/tmp/index.js' },
      name: 'pkg',
      outDir: '/tmp/out',
    })
    expect(buildMock).toHaveBeenCalledWith(expect.objectContaining({
      minify: true,
      target: 'es6',
    }))
  })

  it('keeps minify enabled in production', async () => {
    const ctx = createContext(false)
    createNpmServicePlugin(ctx)
    await ctx.npmService!.bundleBuild({
      entry: { index: '/tmp/index.js' },
      name: 'pkg',
      outDir: '/tmp/out',
    })
    expect(buildMock).toHaveBeenCalledWith(expect.objectContaining({
      minify: true,
      target: 'es6',
    }))
  })
})
