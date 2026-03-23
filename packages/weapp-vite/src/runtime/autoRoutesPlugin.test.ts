import type { MutableCompilerContext } from '../context'
import type { ConfigService } from './config/types'
import type { JsonService } from './jsonPlugin'
import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutoRoutesService } from './autoRoutesPlugin'
import { createRuntimeState } from './runtimeState'

describe('createAutoRoutesService', () => {
  let tempDir: string
  let srcRoot: string

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'weapp-auto-routes-'))
    srcRoot = path.join(tempDir, 'src')

    await fs.ensureDir(path.join(srcRoot, 'pages', 'index'))
    await fs.writeFile(
      path.join(srcRoot, 'pages', 'index', 'index.ts'),
      '// initial page',
      'utf8',
    )
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    vi.restoreAllMocks()
  })

  function createContext(
    autoRoutesEnabled: boolean | Record<string, any> = true,
    weappViteConfigOverrides: Record<string, any> = {},
  ): MutableCompilerContext {
    const runtimeState = createRuntimeState()

    const configService = {
      absoluteSrcRoot: srcRoot,
      cwd: tempDir,
      isDev: true,
      weappViteConfig: {
        autoRoutes: autoRoutesEnabled,
        ...weappViteConfigOverrides,
      },
    } as unknown as ConfigService

    const jsonService = {
      read: vi.fn(),
      resolve: vi.fn(),
      cache: runtimeState.json.cache,
    } as unknown as JsonService

    return {
      runtimeState,
      configService,
      jsonService,
    }
  }

  it('scans routes and exposes snapshot references', async () => {
    const ctx = createContext()
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    expect(service.isInitialized()).toBe(true)

    const typedRouterPath = path.join(tempDir, '.weapp-vite', 'typed-router.d.ts')
    expect(await fs.pathExists(typedRouterPath)).toBe(true)
    const typedRouterContent = await fs.readFile(typedRouterPath, 'utf8')
    expect(typedRouterContent).toContain('"pages/index/index"')

    const snapshot = service.getSnapshot()
    expect(snapshot.pages).toEqual(['pages/index/index'])
    expect(snapshot.entries).toEqual(['pages/index/index'])
    expect(snapshot.subPackages).toEqual([])

    const reference = service.getReference()
    expect(reference.pages).toBe(ctx.runtimeState.autoRoutes.routes.pages)
    expect(reference.entries).toBe(ctx.runtimeState.autoRoutes.routes.entries)

    const watchFiles = [...service.getWatchFiles()]
    expect(watchFiles).toEqual(expect.arrayContaining([
      path.join(srcRoot, 'pages', 'index', 'index.ts'),
    ]))

    const watchDirs = [...service.getWatchDirectories()]
    expect(watchDirs).toEqual(expect.arrayContaining([
      path.join(srcRoot, 'pages'),
      path.join(srcRoot, 'pages', 'index'),
    ]))

    expect(service.getModuleCode()).toContain('"pages/index/index"')
  })

  it('updates routes snapshot after handling file changes', async () => {
    const ctx = createContext(true, {
      subPackages: {
        packageA: {},
      },
    })
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    const subPackagePage = path.join(srcRoot, 'packageA', 'pages', 'cat.ts')
    await fs.ensureDir(path.dirname(subPackagePage))
    await fs.writeFile(subPackagePage, '// subpackage page', 'utf8')

    await service.handleFileChange(subPackagePage)

    expect(service.isInitialized()).toBe(true)
    expect(service.isRouteFile(subPackagePage)).toBe(true)

    const typedRouterPath = path.join(tempDir, '.weapp-vite', 'typed-router.d.ts')
    const updatedTypedRouterContent = await fs.readFile(typedRouterPath, 'utf8')
    expect(updatedTypedRouterContent).toContain('"packageA/pages/cat"')

    const snapshot = service.getSnapshot()
    expect(snapshot.entries).toEqual(expect.arrayContaining([
      'pages/index/index',
      'packageA/pages/cat',
    ]))

    expect(snapshot.pages).toEqual(expect.arrayContaining([
      'pages/index/index',
    ]))

    const packageA = snapshot.subPackages.find(pkg => pkg.root === 'packageA')
    expect(packageA?.pages).toEqual(['pages/cat'])

    const watchFiles = [...service.getWatchFiles()]
    expect(watchFiles).toEqual(expect.arrayContaining([
      path.join(srcRoot, 'packageA', 'pages', 'cat.ts'),
    ]))
  })

  it('does not treat subpackage entry files as pages when the subpackage already has a pages directory', async () => {
    await fs.ensureDir(path.join(srcRoot, 'packageB', 'pages'))
    await fs.writeFile(path.join(srcRoot, 'packageB', 'pages', 'apple.ts'), '// subpackage page', 'utf8')
    await fs.writeFile(path.join(srcRoot, 'packageB', 'index.ts'), '// subpackage entry', 'utf8')

    const ctx = createContext(true, {
      subPackages: {
        packageB: {},
      },
    })
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    expect(service.getSnapshot()).toEqual({
      pages: ['pages/index/index'],
      entries: ['pages/index/index', 'packageB/pages/apple'],
      subPackages: [
        {
          root: 'packageB',
          pages: ['pages/apple'],
        },
      ],
    })
  })

  it('restores routes from persistent cache without rescanning directories', async () => {
    const firstCtx = createContext({ enabled: true, persistentCache: true })
    const firstService = createAutoRoutesService(firstCtx)

    await firstService.ensureFresh()

    const cachePath = path.join(tempDir, '.weapp-vite', 'auto-routes.cache.json')
    expect(await fs.pathExists(cachePath)).toBe(true)

    const readdirSpy = vi.spyOn(fs, 'readdir')
    readdirSpy.mockClear()

    const secondCtx = createContext({ enabled: true, persistentCache: true })
    const secondService = createAutoRoutesService(secondCtx)

    await secondService.ensureFresh()

    expect(readdirSpy).not.toHaveBeenCalled()
    expect(secondService.getSnapshot()).toEqual({
      pages: ['pages/index/index'],
      entries: ['pages/index/index'],
      subPackages: [],
    })
  })

  it('writes and restores persistent cache from a custom relative path', async () => {
    const customCachePath = path.join(tempDir, '.cache', 'custom-auto-routes.json')

    const firstCtx = createContext({ enabled: true, persistentCache: '.cache/custom-auto-routes.json' })
    const firstService = createAutoRoutesService(firstCtx)

    await firstService.ensureFresh()

    expect(await fs.pathExists(customCachePath)).toBe(true)

    const readdirSpy = vi.spyOn(fs, 'readdir')
    readdirSpy.mockClear()

    const secondCtx = createContext({ enabled: true, persistentCache: '.cache/custom-auto-routes.json' })
    const secondService = createAutoRoutesService(secondCtx)

    await secondService.ensureFresh()

    expect(readdirSpy).not.toHaveBeenCalled()
    expect(secondService.getSnapshot()).toEqual({
      pages: ['pages/index/index'],
      entries: ['pages/index/index'],
      subPackages: [],
    })
  })

  it('supports custom include rules for main package and configured subpackages', async () => {
    await fs.ensureDir(path.join(srcRoot, 'views', 'home'))
    await fs.writeFile(path.join(srcRoot, 'views', 'home', 'index.ts'), '// main view', 'utf8')
    await fs.ensureDir(path.join(srcRoot, 'pkgA', 'screens', 'detail'))
    await fs.writeFile(path.join(srcRoot, 'pkgA', 'screens', 'detail', 'index.ts'), '// subpackage view', 'utf8')

    const ctx = createContext(
      {
        enabled: true,
        include: ['views/**', 'pkgA/screens/**'],
      },
      {
        subPackages: {
          pkgA: {},
        },
      },
    )
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    expect(service.getSnapshot()).toEqual({
      pages: ['views/home/index'],
      entries: ['pkgA/screens/detail/index', 'views/home/index'],
      subPackages: [
        {
          root: 'pkgA',
          pages: ['screens/detail/index'],
        },
      ],
    })
  })

  it('does not treat nested components pages directory as default route root', async () => {
    await fs.ensureDir(path.join(srcRoot, 'components', 'pages', 'card'))
    await fs.writeFile(path.join(srcRoot, 'components', 'pages', 'card', 'index.ts'), '// component', 'utf8')

    const ctx = createContext()
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    expect(service.getSnapshot()).toEqual({
      pages: ['pages/index/index'],
      entries: ['pages/index/index'],
      subPackages: [],
    })
  })

  it('matches and handles route changes from Windows-style absolute paths', async () => {
    const ctx = createContext(true, {
      subPackages: {
        packageB: {},
      },
    })
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    const subPackagePage = path.join(srcRoot, 'packageB', 'pages', 'dog.ts')
    await fs.ensureDir(path.dirname(subPackagePage))
    await fs.writeFile(subPackagePage, '// subpackage page', 'utf8')

    const windowsStylePath = subPackagePage.replace(/\//g, '\\')
    expect(service.isRouteFile(windowsStylePath)).toBe(true)

    await service.handleFileChange(windowsStylePath, 'create')

    const snapshot = service.getSnapshot()
    expect(snapshot.entries).toEqual(expect.arrayContaining([
      'pages/index/index',
      'packageB/pages/dog',
    ]))
  })

  it('reacts to style file additions and deletions', async () => {
    const ctx = createContext()
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    const stylePath = path.join(srcRoot, 'pages', 'index', 'index.wxss')
    await fs.writeFile(stylePath, '.page {}', 'utf8')

    expect(service.isRouteFile(stylePath)).toBe(true)

    await service.handleFileChange(stylePath, 'create')

    const watchFilesAfterCreate = [...service.getWatchFiles()]
    expect(watchFilesAfterCreate).toEqual(expect.arrayContaining([stylePath]))

    await fs.remove(stylePath)
    await service.handleFileChange(stylePath, 'delete')

    const watchFilesAfterDelete = [...service.getWatchFiles()]
    expect(watchFilesAfterDelete).not.toContain(stylePath)
  })

  it('rebuilds routes after rename events', async () => {
    const ctx = createContext()
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    const oldPage = path.join(srcRoot, 'pages', 'index', 'index.ts')
    const newPageDir = path.join(srcRoot, 'pages', 'renamed')
    const newPage = path.join(newPageDir, 'index.ts')
    await fs.ensureDir(newPageDir)
    await fs.move(oldPage, newPage)

    await service.handleFileChange(newPage, 'rename')

    const snapshot = service.getSnapshot()
    expect(snapshot.pages).toContain('pages/renamed/index')
    expect(snapshot.pages).not.toContain('pages/index/index')

    const typedRouterPath = path.join(tempDir, '.weapp-vite', 'typed-router.d.ts')
    const typedRouterContent = await fs.readFile(typedRouterPath, 'utf8')
    expect(typedRouterContent).toContain('"pages/renamed/index"')
    expect(typedRouterContent).not.toContain('"pages/index/index"')
  })

  it('rebuilds routes after file rename via delete and create events', async () => {
    const ctx = createContext()
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    const oldPage = path.join(srcRoot, 'pages', 'index', 'index.ts')
    const newPageDir = path.join(srcRoot, 'pages', 'moved-file')
    const newPage = path.join(newPageDir, 'index.ts')
    await fs.ensureDir(newPageDir)
    await fs.copy(oldPage, newPage)
    await fs.remove(oldPage)

    await service.handleFileChange(oldPage, 'delete')
    await service.handleFileChange(newPage, 'create')

    const snapshot = service.getSnapshot()
    expect(snapshot.pages).toContain('pages/moved-file/index')
    expect(snapshot.pages).not.toContain('pages/index/index')

    const typedRouterPath = path.join(tempDir, '.weapp-vite', 'typed-router.d.ts')
    const typedRouterContent = await fs.readFile(typedRouterPath, 'utf8')
    expect(typedRouterContent).toContain('"pages/moved-file/index"')
    expect(typedRouterContent).not.toContain('"pages/index/index"')
  })

  it('rebuilds routes after directory rename via delete and create events', async () => {
    const ctx = createContext()
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    const oldDir = path.join(srcRoot, 'pages', 'index')
    const oldPage = path.join(oldDir, 'index.ts')
    const newDir = path.join(srcRoot, 'pages', 'renamed-dir')
    const newPage = path.join(newDir, 'index.ts')
    await fs.ensureDir(newDir)
    await fs.copy(oldPage, newPage)
    await fs.remove(oldDir)

    await service.handleFileChange(oldPage, 'delete')
    await service.handleFileChange(newPage, 'create')

    const snapshot = service.getSnapshot()
    expect(snapshot.pages).toContain('pages/renamed-dir/index')
    expect(snapshot.pages).not.toContain('pages/index/index')
  })

  it('ignores non-route file changes', async () => {
    const ctx = createContext()
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    const before = service.getSnapshot()
    const utilPath = path.join(srcRoot, 'utils', 'format.ts')
    await fs.ensureDir(path.dirname(utilPath))
    await fs.writeFile(utilPath, 'export const noop = () => {}\n', 'utf8')
    await service.handleFileChange(utilPath, 'create')

    const after = service.getSnapshot()
    expect(after).toEqual(before)
    expect(service.isRouteFile(utilPath)).toBe(false)
  })

  it('no-ops when feature is disabled', async () => {
    const ctx = createContext(false)
    const service = createAutoRoutesService(ctx)
    const spy = vi.spyOn(fs, 'readdir')

    await service.ensureFresh()

    expect(service.isEnabled()).toBe(false)
    expect(spy).not.toHaveBeenCalled()
    const typedRouterPath = path.join(tempDir, '.weapp-vite', 'typed-router.d.ts')
    expect(await fs.pathExists(typedRouterPath)).toBe(false)
    expect(service.isInitialized()).toBe(true)
    expect(service.getSnapshot()).toEqual({
      pages: [],
      entries: [],
      subPackages: [],
    })

    const pagePath = path.join(srcRoot, 'pages', 'index', 'index.ts')
    expect(service.isRouteFile(pagePath)).toBe(false)
    await service.handleFileChange(pagePath)
    expect(service.getSnapshot()).toEqual({
      pages: [],
      entries: [],
      subPackages: [],
    })
  })
})
