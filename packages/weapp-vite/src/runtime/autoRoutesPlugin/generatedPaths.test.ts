import { describe, expect, it } from 'vitest'
import {
  isAutoRoutesGeneratedFileName,
  isAutoRoutesGeneratedPath,
  isAutoRoutesGeneratedRelativePath,
  resolveAutoRoutesManagedOutputPaths,
} from './generatedPaths'

describe('auto routes generated path guards', () => {
  it('detects generated file name patterns', () => {
    expect(isAutoRoutesGeneratedFileName('.app.json.auto-routes-inline.ts')).toBe(true)
    expect(isAutoRoutesGeneratedFileName('auto-routes.cache.json')).toBe(true)
    expect(isAutoRoutesGeneratedFileName('typed-router.d.ts')).toBe(true)
    expect(isAutoRoutesGeneratedFileName('index.vue')).toBe(false)
  })

  it('detects generated relative paths under src roots', () => {
    expect(isAutoRoutesGeneratedRelativePath('pages/home/.app.json.auto-routes-inline.ts')).toBe(true)
    expect(isAutoRoutesGeneratedRelativePath('.weapp-vite/typed-router.d.ts')).toBe(true)
    expect(isAutoRoutesGeneratedRelativePath('pages/home/index.vue')).toBe(false)
  })

  it('detects configured auto-routes managed output paths', () => {
    const managedOutputPaths = resolveAutoRoutesManagedOutputPaths({
      configService: {
        cwd: '/project',
        configFilePath: '/project/configs/vite.config.ts',
        weappViteConfig: {
          autoRoutes: {
            persistentCache: 'pages/home/auto-routes.cache.json',
          },
        },
      } as any,
    })

    expect(managedOutputPaths).toEqual(new Set([
      '/project/configs/.weapp-vite/typed-router.d.ts',
      '/project/configs/.weapp-vite/auto-routes.cache.json',
      '/project/configs/pages/home/auto-routes.cache.json',
    ]))
  })

  it('keeps managed custom cache paths out of pages watch even when they live under include roots', () => {
    expect(isAutoRoutesGeneratedPath('/project/src/pages/home/auto-routes.cache.json', {
      cwd: '/project',
      absoluteSrcRoot: '/project/src',
      managedOutputPaths: ['/project/src/pages/home/auto-routes.cache.json'],
    })).toBe(true)

    expect(isAutoRoutesGeneratedPath('/project/src/pages/home/index.ts', {
      cwd: '/project',
      absoluteSrcRoot: '/project/src',
      managedOutputPaths: ['/project/src/pages/home/auto-routes.cache.json'],
    })).toBe(false)
  })
})
