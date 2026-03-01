import type { Plugin } from 'vite'
import path from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import { autoRoutes } from './autoRoutes'

function createPlugin() {
  const ensureFresh = vi.fn(async () => {})
  const getModuleCode = vi.fn(() => 'export const pages = ["pages/home/index"]')
  const ctx = {
    autoRoutesService: {
      ensureFresh,
      getModuleCode,
      getWatchFiles: () => [],
      getWatchDirectories: () => [],
      isRouteFile: () => false,
      handleFileChange: vi.fn(async () => {}),
    },
    configService: {
      cwd: '/virtual/project',
      absoluteSrcRoot: '/virtual/project/src',
      packageInfo: {
        rootPath: '/virtual/weapp-vite',
      },
    },
  } as any

  const [plugin] = autoRoutes(ctx) as Plugin[]
  return {
    plugin,
    ensureFresh,
    getModuleCode,
    packageRoot: ctx.configService.packageInfo.rootPath,
  }
}

describe('auto-routes plugin alias fallback', () => {
  it('maps aliased auto-routes source id to virtual module', async () => {
    const { plugin, packageRoot } = createPlugin()
    const aliasedId = path.resolve(packageRoot, 'src/auto-routes.ts')

    plugin.configResolved?.({
      command: 'build',
    } as any)

    const resolved = await plugin.resolveId?.call({}, aliasedId)
    expect(resolved).toBe('\0weapp-vite:auto-routes')
  })

  it('returns virtual auto-routes code when load receives aliased source id', async () => {
    const { plugin, ensureFresh, getModuleCode, packageRoot } = createPlugin()
    const aliasedId = path.resolve(packageRoot, 'src/auto-routes.ts')
    const addWatchFile = vi.fn()

    plugin.configResolved?.({
      command: 'serve',
    } as any)

    const loaded = await plugin.load?.call({ addWatchFile } as any, aliasedId)
    expect(ensureFresh).toHaveBeenCalled()
    expect(getModuleCode).toHaveBeenCalled()
    expect(loaded).toEqual({
      code: 'export const pages = ["pages/home/index"]',
      map: { mappings: '' },
    })
  })
})
