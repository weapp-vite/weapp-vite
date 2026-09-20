import type { MutableCompilerContext } from '../context'
import type { NamedAutoRoute } from './autoRoutesPlugin/types'
import type { ConfigService } from './config/types'
import type { JsonService } from './jsonPlugin'
import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutoRoutesService } from './autoRoutesPlugin'
import { createRuntimeState } from './runtimeState'

const NAMED_ROUTES_MODULE_PREFIX = 'export const routes = JSON.parse('

function parseNamedRoutesModule(code: string): NamedAutoRoute[] {
  if (!code.startsWith(NAMED_ROUTES_MODULE_PREFIX) || !code.endsWith(');\n')) {
    throw new Error('Unexpected named auto-routes module')
  }
  const payloadLiteral = code.slice(NAMED_ROUTES_MODULE_PREFIX.length, -3)
  const serialized: unknown = JSON.parse(payloadLiteral)
  if (typeof serialized !== 'string') {
    throw new TypeError('Expected a serialized named auto-routes payload')
  }
  const routes: unknown = JSON.parse(serialized)
  if (!Array.isArray(routes)) {
    throw new TypeError('Expected a named auto-routes array')
  }
  return routes as NamedAutoRoute[]
}

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
    target: { aliasEntries?: ConfigService['aliasEntries'], web?: boolean } = {},
  ): MutableCompilerContext {
    const runtimeState = createRuntimeState()

    const configService = {
      aliasEntries: target.aliasEntries ?? [],
      absoluteSrcRoot: srcRoot,
      cwd: tempDir,
      inlineConfig: {
        resolve: {
          alias: target.aliasEntries ?? [],
        },
      },
      isDev: true,
      weappWebConfig: target.web ? { enabled: true } : undefined,
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

  it('restores routes from persistent cache after validating current topology', async () => {
    await fs.writeFile(path.join(srcRoot, 'pages', 'index', 'index.ts'), `
import { def\\u0069nePage as page } from 'wevu/\\u0072outer'
page({ name: 'cached-home', meta: { cached: true } })
`, 'utf8')
    const firstCtx = createContext({ enabled: true, persistentCache: true })
    const firstService = createAutoRoutesService(firstCtx)

    await firstService.ensureFresh()

    const cachePath = path.join(tempDir, '.weapp-vite', 'auto-routes.cache.json')
    expect(await fs.pathExists(cachePath)).toBe(true)

    const secondCtx = createContext({ enabled: true, persistentCache: true })
    const secondService = createAutoRoutesService(secondCtx)

    await secondService.ensureFresh()

    expect(secondService.getSnapshot()).toEqual({
      pages: ['pages/index/index'],
      entries: ['pages/index/index'],
      subPackages: [],
    })
    expect(parseNamedRoutesModule(secondService.getNamedModuleCode())).toEqual([{
      name: 'cached-home',
      path: '/pages/index/index',
      meta: { cached: true },
    }])
    const typedRouterContent = await fs.readFile(path.join(tempDir, '.weapp-vite', 'typed-router.d.ts'), 'utf8')
    expect(typedRouterContent).toContain('"cached-home": {')
    expect(typedRouterContent).toContain('"cached": boolean;')
  })

  it('writes and restores persistent cache from a custom relative path', async () => {
    const customCachePath = path.join(tempDir, '.cache', 'custom-auto-routes.json')

    const firstCtx = createContext({ enabled: true, persistentCache: '.cache/custom-auto-routes.json' })
    const firstService = createAutoRoutesService(firstCtx)

    await firstService.ensureFresh()

    expect(await fs.pathExists(customCachePath)).toBe(true)

    const secondCtx = createContext({ enabled: true, persistentCache: '.cache/custom-auto-routes.json' })
    const secondService = createAutoRoutesService(secondCtx)

    await secondService.ensureFresh()

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
    const oldPage = path.join(srcRoot, 'pages', 'index', 'index.ts')
    await fs.writeFile(oldPage, `
import { definePage } from 'wevu/router'
definePage({ name: 'stable-page', meta: { moved: true } })
`, 'utf8')
    const ctx = createContext()
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    const newPageDir = path.join(srcRoot, 'pages', 'renamed')
    const newPage = path.join(newPageDir, 'index.ts')
    await fs.ensureDir(newPageDir)
    await fs.move(oldPage, newPage)

    await service.handleFileChange(newPage, 'rename')

    const snapshot = service.getSnapshot()
    expect(snapshot.pages).toContain('pages/renamed/index')
    expect(snapshot.pages).not.toContain('pages/index/index')
    expect(parseNamedRoutesModule(service.getNamedModuleCode())).toEqual([{
      name: 'stable-page',
      path: '/pages/renamed/index',
      meta: { moved: true },
    }])

    const typedRouterPath = path.join(tempDir, '.weapp-vite', 'typed-router.d.ts')
    const typedRouterContent = await fs.readFile(typedRouterPath, 'utf8')
    expect(typedRouterContent).toContain('"pages/renamed/index"')
    expect(typedRouterContent).not.toContain('"pages/index/index"')
    expect(typedRouterContent).toContain('"stable-page": {')
    expect(typedRouterContent).toContain('path: "/pages/renamed/index";')
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

  it('ignores auto-routes generated file changes under route roots', async () => {
    const ctx = createContext({
      enabled: true,
      persistentCache: 'src/pages/index/auto-routes.cache.json',
    })
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    const before = service.getSnapshot()
    const inlineTempPath = path.join(srcRoot, 'pages', 'index', '.app.json.auto-routes-inline.ts')
    const customCachePath = path.join(srcRoot, 'pages', 'index', 'auto-routes.cache.json')
    await fs.writeFile(inlineTempPath, 'export default {}', 'utf8')
    await fs.writeFile(customCachePath, '{}', 'utf8')

    expect(service.isRouteFile(inlineTempPath)).toBe(false)
    expect(service.isRouteFile(customCachePath)).toBe(false)

    await service.handleFileChange(inlineTempPath, 'create')
    await service.handleFileChange(customCachePath, 'create')

    expect(service.getSnapshot()).toEqual(before)
  })

  it('propagates declaration diagnostics only for recognized pages', async () => {
    const componentPath = path.join(srcRoot, 'components', 'card', 'index.ts')
    await fs.ensureDir(path.dirname(componentPath))
    await fs.writeFile(componentPath, `
import { definePage } from 'wevu/router'
definePage({ name: getName() })
`, 'utf8')
    const pagePath = path.join(srcRoot, 'pages', 'index', 'index.ts')
    const service = createAutoRoutesService(createContext())

    await expect(service.ensureFresh()).resolves.toBeUndefined()

    await fs.writeFile(pagePath, `
import { definePage } from 'wevu/router'
definePage({ name: getName() })
`, 'utf8')
    await expect(service.handleFileChange(pagePath, 'update'))
      .rejects
      .toThrow(`${pagePath}:3`)
  })

  it('generates named route data and refreshes metadata-only declaration changes', async () => {
    const pagePath = path.join(srcRoot, 'pages', 'index', 'index.ts')
    await fs.writeFile(pagePath, `
import { definePage } from 'wevu/router'
definePage({
  name: 'home',
  meta: { title: 'Home', requiresAuth: false, tags: ['main'] },
})
`, 'utf8')
    const ctx = createContext()
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    expect(service.getSnapshot()).toEqual({
      pages: ['pages/index/index'],
      entries: ['pages/index/index'],
      subPackages: [],
    })
    expect(parseNamedRoutesModule(service.getNamedModuleCode())).toEqual([{
      name: 'home',
      path: '/pages/index/index',
      meta: { title: 'Home', requiresAuth: false, tags: ['main'] },
    }])
    expect(service.getNamedModuleCode()).not.toContain('import ')
    expect(service.isPageSource(pagePath)).toBe(true)

    const typedRouterPath = path.join(tempDir, '.weapp-vite', 'typed-router.d.ts')
    const initialTypes = await fs.readFile(typedRouterPath, 'utf8')
    expect(initialTypes).toContain('"home": {')
    expect(initialTypes).toContain('"title": string;')
    expect(initialTypes).toContain('"requiresAuth": boolean;')
    expect(initialTypes).toContain('"tags": Array<string>;')

    const initialSignature = service.getSignature()
    await fs.writeFile(pagePath, `
import { definePage } from 'wevu/router'
definePage({ name: 'home', meta: { title: 'Dashboard', rank: 2 } })
`, 'utf8')
    await expect(service.handleFileChange(pagePath, 'update')).resolves.toBe(true)

    expect(service.getSignature()).not.toBe(initialSignature)
    expect(parseNamedRoutesModule(service.getNamedModuleCode())).toEqual([{
      name: 'home',
      path: '/pages/index/index',
      meta: { title: 'Dashboard', rank: 2 },
    }])

    await fs.writeFile(pagePath, 'export default {}\n', 'utf8')
    await service.handleFileChange(pagePath, 'update')

    expect(parseNamedRoutesModule(service.getNamedModuleCode())).toEqual([])
    expect(await fs.readFile(typedRouterPath, 'utf8')).not.toContain('"home": {')
    expect(service.getSnapshot().entries).toEqual(['pages/index/index'])
  })

  it('diagnoses duplicate names with both declaration sources', async () => {
    const firstPage = path.join(srcRoot, 'pages', 'index', 'index.ts')
    const secondPage = path.join(srcRoot, 'pages', 'about', 'index.ts')
    await fs.writeFile(firstPage, `
import { definePage } from 'wevu/router'
definePage({ name: 'duplicate', meta: {} })
`, 'utf8')
    await fs.ensureDir(path.dirname(secondPage))
    await fs.writeFile(secondPage, `
import { definePage as page } from 'wevu/router'
page({ name: 'duplicate' })
`, 'utf8')
    const service = createAutoRoutesService(createContext())

    await expect(service.ensureFresh()).rejects.toThrow(
      /页面路由名称 "duplicate" 重复：src\/pages\/about\/index\.ts 与 src\/pages\/index\/index\.ts/,
    )
  })

  it('rejects duplicate names when multiple pages share one external declaration script', async () => {
    const initialScript = path.join(srcRoot, 'pages', 'index', 'index.ts')
    const firstPage = path.join(srcRoot, 'pages', 'index', 'index.vue')
    const secondPage = path.join(srcRoot, 'pages', 'about', 'index.vue')
    const externalScript = path.join(srcRoot, 'pageScripts', 'shared.ts')
    await fs.remove(initialScript)
    await fs.ensureDir(path.dirname(secondPage))
    await fs.ensureDir(path.dirname(externalScript))
    await fs.writeFile(firstPage, '<script setup lang="ts" src="../../pageScripts/shared.ts"></script>', 'utf8')
    await fs.writeFile(secondPage, '<script setup lang="ts" src="../../pageScripts/shared.ts"></script>', 'utf8')
    await fs.writeFile(externalScript, `
import { definePage } from 'wevu/router'
definePage({ name: 'shared-name' })
`, 'utf8')
    const service = createAutoRoutesService(createContext())

    await expect(service.ensureFresh()).rejects.toThrow(
      /页面路由名称 "shared-name" 重复：src\/pageScripts\/shared\.ts 与 src\/pageScripts\/shared\.ts/,
    )
  })

  it('emits declarations only for final build-scope entries', async () => {
    const mainPage = path.join(srcRoot, 'pages', 'index', 'index.ts')
    const subPage = path.join(srcRoot, 'packageA', 'pages', 'detail', 'index.ts')
    await fs.writeFile(mainPage, `
import { definePage } from 'wevu/router'
definePage({ name: 'main-page' })
`, 'utf8')
    await fs.ensureDir(path.dirname(subPage))
    await fs.writeFile(subPage, `
import { definePage } from 'wevu/router'
definePage({ name: 'package-detail', meta: { section: 'orders' } })
`, 'utf8')
    const service = createAutoRoutesService(createContext(true, {
      buildScope: {
        includeMainPackage: false,
        include: ['packageA'],
      },
      subPackages: {
        packageA: {},
      },
    }))

    await service.ensureFresh()

    expect(service.getSnapshot()).toEqual({
      pages: [],
      entries: ['packageA/pages/detail/index'],
      subPackages: [{ root: 'packageA', pages: ['pages/detail/index'] }],
    })
    expect(parseNamedRoutesModule(service.getNamedModuleCode())).toEqual([{
      name: 'package-detail',
      path: '/packageA/pages/detail/index',
      meta: { section: 'orders' },
    }])
    expect(service.isPageSource(subPage)).toBe(true)
    expect(service.isPageSource(mainPage)).toBe(false)
  })

  it('rejects a persistent cache when the discovered page topology changes', async () => {
    const firstService = createAutoRoutesService(createContext({ enabled: true, persistentCache: true }))
    await firstService.ensureFresh()

    const addedPage = path.join(srcRoot, 'pages', 'added', 'index.ts')
    await fs.ensureDir(path.dirname(addedPage))
    await fs.writeFile(addedPage, `
import { definePage } from 'wevu/router'
definePage({ name: 'added-page' })
`, 'utf8')

    const restoredService = createAutoRoutesService(createContext({ enabled: true, persistentCache: true }))
    await restoredService.ensureFresh()

    expect(restoredService.getSnapshot().entries).toContain('pages/added/index')
    expect(parseNamedRoutesModule(restoredService.getNamedModuleCode())).toEqual([{
      name: 'added-page',
      path: '/pages/added/index',
      meta: {},
    }])
    expect(await fs.readFile(path.join(tempDir, '.weapp-vite', 'typed-router.d.ts'), 'utf8')).toContain('meta: {};')
  })

  it('refreshes named routes and types when external script metadata changes', async () => {
    const pageScript = path.join(srcRoot, 'pages', 'index', 'index.ts')
    const pageVue = path.join(srcRoot, 'pages', 'index', 'index.vue')
    const externalScript = path.join(srcRoot, 'pageScripts', 'profile.ts')
    await fs.remove(pageScript)
    await fs.ensureDir(path.dirname(externalScript))
    await fs.writeFile(pageVue, '<script setup lang="ts" src="../../pageScripts/profile.ts"></script>', 'utf8')
    await fs.writeFile(externalScript, `
import { definePage } from 'wevu/router'
definePage({ name: 'profile', meta: { title: 'Profile' } })
`, 'utf8')
    const service = createAutoRoutesService(createContext())

    await service.ensureFresh()

    expect(parseNamedRoutesModule(service.getNamedModuleCode())).toEqual([{
      name: 'profile',
      path: '/pages/index/index',
      meta: { title: 'Profile' },
    }])
    expect([...service.getPageDeclarationOwners(externalScript)]).toEqual([pageVue])
    expect(service.isPageDeclarationSource(externalScript)).toBe(true)
    expect([...service.getWatchFiles()]).toContain(externalScript)
    expect([...service.getWatchDirectories()]).toContain(path.dirname(externalScript))

    await fs.writeFile(externalScript, `
import { definePage } from 'wevu/router'
definePage({ name: 'profile', meta: { title: 'Account', rank: 2 } })
`, 'utf8')
    await expect(service.handleFileChange(externalScript, 'update')).resolves.toBe(true)

    expect(parseNamedRoutesModule(service.getNamedModuleCode())).toEqual([{
      name: 'profile',
      path: '/pages/index/index',
      meta: { title: 'Account', rank: 2 },
    }])
    const typedRouterPath = path.join(tempDir, '.weapp-vite', 'typed-router.d.ts')
    const updatedTypes = await fs.readFile(typedRouterPath, 'utf8')
    expect(updatedTypes).toContain('"rank": number;')

    await fs.writeFile(externalScript, 'export default {}\n', 'utf8')
    await service.handleFileChange(externalScript, 'update')
    expect(parseNamedRoutesModule(service.getNamedModuleCode())).toEqual([])
    expect(await fs.readFile(typedRouterPath, 'utf8')).not.toContain('"profile": {')
  })

  it('resolves external declaration scripts through configured source aliases', async () => {
    const pageScript = path.join(srcRoot, 'pages', 'index', 'index.ts')
    const pageVue = path.join(srcRoot, 'pages', 'index', 'index.vue')
    const externalScript = path.join(srcRoot, 'pageScripts', 'aliased.ts')
    await fs.remove(pageScript)
    await fs.ensureDir(path.dirname(externalScript))
    await fs.writeFile(pageVue, '<script setup lang="ts" src="@/pageScripts/aliased.ts"></script>', 'utf8')
    await fs.writeFile(externalScript, `
import { definePage } from 'wevu/router'
definePage({ name: 'aliased-page', meta: { aliased: true } })
`, 'utf8')
    const service = createAutoRoutesService(createContext(true, {}, {
      aliasEntries: [{ find: '@', replacement: srcRoot }],
    }))

    await service.ensureFresh()

    expect(parseNamedRoutesModule(service.getNamedModuleCode())).toEqual([{
      name: 'aliased-page',
      path: '/pages/index/index',
      meta: { aliased: true },
    }])
    expect([...service.getPageDeclarationOwners(externalScript)]).toEqual([pageVue])
  })

  it('invalidates declaration cache when configured source aliases change', async () => {
    const pageScript = path.join(srcRoot, 'pages', 'index', 'index.ts')
    const pageVue = path.join(srcRoot, 'pages', 'index', 'index.vue')
    const firstRoot = path.join(srcRoot, 'pageScripts', 'first')
    const secondRoot = path.join(srcRoot, 'pageScripts', 'second')
    await fs.remove(pageScript)
    await fs.ensureDir(firstRoot)
    await fs.ensureDir(secondRoot)
    await fs.writeFile(pageVue, '<script setup lang="ts" src="@route/page.ts"></script>', 'utf8')
    await fs.writeFile(path.join(firstRoot, 'page.ts'), `
import { definePage } from 'wevu/router'
definePage({ name: 'alias-first' })
`, 'utf8')
    await fs.writeFile(path.join(secondRoot, 'page.ts'), `
import { definePage } from 'wevu/router'
definePage({ name: 'alias-second' })
`, 'utf8')
    const cacheConfig = { enabled: true, persistentCache: true }
    const firstService = createAutoRoutesService(createContext(cacheConfig, {}, {
      aliasEntries: [{ find: '@route', replacement: firstRoot }],
    }))
    await firstService.ensureFresh()

    const secondService = createAutoRoutesService(createContext(cacheConfig, {}, {
      aliasEntries: [{ find: '@route', replacement: secondRoot }],
    }))
    await secondService.ensureFresh()

    expect(parseNamedRoutesModule(secondService.getNamedModuleCode())[0]?.name).toBe('alias-second')
  })
  it('passes bare external declaration ids through the configured source resolver', async () => {
    const pageScript = path.join(srcRoot, 'pages', 'index', 'index.ts')
    const pageVue = path.join(srcRoot, 'pages', 'index', 'index.vue')
    const externalScript = path.join(srcRoot, 'pageScripts', 'bare.ts')
    await fs.remove(pageScript)
    await fs.ensureDir(path.dirname(externalScript))
    await fs.writeFile(pageVue, '<script setup lang="ts" src="page-script-entry"></script>', 'utf8')
    await fs.writeFile(externalScript, `
import { definePage } from 'wevu/router'
definePage({ name: 'bare-page' })
`, 'utf8')
    const service = createAutoRoutesService(createContext())
    service.setPageDeclarationSourceResolver(async (source, importer) => {
      expect(source).toBe('page-script-entry')
      expect(importer).toBe(pageVue)
      return externalScript
    })

    await service.ensureFresh()

    expect(parseNamedRoutesModule(service.getNamedModuleCode())).toEqual([{
      name: 'bare-page',
      path: '/pages/index/index',
      meta: {},
    }])
  })

  it('conservatively bypasses declaration cache for opaque source resolvers', async () => {
    const pageScript = path.join(srcRoot, 'pages', 'index', 'index.ts')
    const pageVue = path.join(srcRoot, 'pages', 'index', 'index.vue')
    const firstExternal = path.join(srcRoot, 'pageScripts', 'opaque-first.ts')
    const secondExternal = path.join(srcRoot, 'pageScripts', 'opaque-second.ts')
    await fs.remove(pageScript)
    await fs.ensureDir(path.dirname(firstExternal))
    await fs.writeFile(pageVue, '<script setup lang="ts" src="opaque-page"></script>', 'utf8')
    await fs.writeFile(firstExternal, `
import { definePage } from 'wevu/router'
definePage({ name: 'opaque-first' })
`, 'utf8')
    await fs.writeFile(secondExternal, `
import { definePage } from 'wevu/router'
definePage({ name: 'opaque-second' })
`, 'utf8')
    const cacheConfig = { enabled: true, persistentCache: true }
    const firstService = createAutoRoutesService(createContext(cacheConfig))
    firstService.setPageDeclarationSourceResolver(async () => firstExternal)
    await firstService.ensureFresh()

    const secondService = createAutoRoutesService(createContext(cacheConfig))
    secondService.setPageDeclarationSourceResolver(async () => secondExternal)
    await secondService.ensureFresh()

    expect(parseNamedRoutesModule(secondService.getNamedModuleCode())[0]?.name).toBe('opaque-second')
  })

  it('rejects preserved-mtime cache entries when external declaration content changes', async () => {
    const pageScript = path.join(srcRoot, 'pages', 'index', 'index.ts')
    const pageVue = path.join(srcRoot, 'pages', 'index', 'index.vue')
    const externalScript = path.join(srcRoot, 'pageScripts', 'cached.ts')
    const initialSource = `import { definePage } from 'wevu/router'
definePage({ name: 'cached-one', meta: { phase: 'one' } })
`
    const changedSource = `import { definePage } from 'wevu/router'
definePage({ name: 'cached-two', meta: { phase: 'two' } })
`
    await fs.remove(pageScript)
    await fs.ensureDir(path.dirname(externalScript))
    await fs.writeFile(pageVue, '<script setup lang="ts" src="../../pageScripts/cached.ts"></script>', 'utf8')
    await fs.writeFile(externalScript, initialSource, 'utf8')
    const firstService = createAutoRoutesService(createContext({ enabled: true, persistentCache: true }))
    await firstService.ensureFresh()
    const originalStat = await fs.stat(externalScript)

    await fs.writeFile(externalScript, changedSource, 'utf8')
    await fs.utimes(externalScript, originalStat.atime, originalStat.mtime)
    const restoredService = createAutoRoutesService(createContext({ enabled: true, persistentCache: true }))
    await restoredService.ensureFresh()

    expect(initialSource).toHaveLength(changedSource.length)
    expect(parseNamedRoutesModule(restoredService.getNamedModuleCode())).toEqual([{
      name: 'cached-two',
      path: '/pages/index/index',
      meta: { phase: 'two' },
    }])
  })

  it('keeps native precedence and rejects divergent configured Web source declarations', async () => {
    const pageScript = path.join(srcRoot, 'pages', 'index', 'index.ts')
    const pageVue = path.join(srcRoot, 'pages', 'index', 'index.vue')
    await fs.writeFile(pageScript, `
import { definePage } from 'wevu/router'
definePage({ name: 'mini-owner' })
`, 'utf8')
    await fs.writeFile(pageVue, `<script setup lang="ts">
import { definePage } from 'wevu/router'
definePage({ name: 'web-owner' })
</script>`, 'utf8')

    const miniService = createAutoRoutesService(createContext())
    await miniService.ensureFresh()
    expect(parseNamedRoutesModule(miniService.getNamedModuleCode())[0]?.name).toBe('mini-owner')

    const webContext = createContext(true, {}, { web: true })
    const webService = createAutoRoutesService(webContext)
    await expect(webService.ensureFresh()).rejects.toThrow(
      /页面声明不一致：.*pages\/index\/index\.ts 与 .*pages\/index\/index\.vue/,
    )
  })

  it('does not restore native-only cache after enabling Web sibling parity', async () => {
    const pageScript = path.join(srcRoot, 'pages', 'index', 'index.ts')
    const pageVue = path.join(srcRoot, 'pages', 'index', 'index.vue')
    await fs.writeFile(pageScript, `
import { definePage } from 'wevu/router'
definePage({ name: 'cached-native' })
`, 'utf8')
    await fs.writeFile(pageVue, `<script setup lang="ts">
import { definePage } from 'wevu/router'
definePage({ name: 'configured-web' })
</script>`, 'utf8')
    const cacheConfig = { enabled: true, persistentCache: true }
    const nativeService = createAutoRoutesService(createContext(cacheConfig))
    await nativeService.ensureFresh()

    const webService = createAutoRoutesService(createContext(cacheConfig, {}, { web: true }))
    await expect(webService.ensureFresh()).rejects.toThrow(
      /页面声明不一致：.*pages\/index\/index\.ts 与 .*pages\/index\/index\.vue/,
    )
  })

  it('recovers after a newly added invalid page is corrected without topology changes', async () => {
    const service = createAutoRoutesService(createContext())
    await service.ensureFresh()
    const addedPage = path.join(srcRoot, 'pages', 'recovery', 'index.ts')
    await fs.ensureDir(path.dirname(addedPage))
    await fs.writeFile(addedPage, `
import { definePage } from 'wevu/router'
definePage({ name: dynamicName })
`, 'utf8')

    await expect(service.handleFileChange(addedPage, 'create')).rejects.toThrow('name 必须是非空静态字符串')

    await fs.writeFile(addedPage, `
import { definePage } from 'wevu/router'
definePage({ name: 'recovered-page', meta: { ready: true } })
`, 'utf8')
    await expect(service.handleFileChange(addedPage, 'update')).resolves.toBe(true)
    expect(parseNamedRoutesModule(service.getNamedModuleCode())).toContainEqual({
      name: 'recovered-page',
      path: '/pages/recovery/index',
      meta: { ready: true },
    })
  })

  it('keeps legacy unannotated sibling pages when Web support is configured', async () => {
    const pageScript = path.join(srcRoot, 'pages', 'index', 'index.ts')
    const pageVue = path.join(srcRoot, 'pages', 'index', 'index.vue')
    await fs.writeFile(pageScript, 'export default {}\n', 'utf8')
    await fs.writeFile(pageVue, '<script setup lang="ts">const visible = true</script>', 'utf8')
    const service = createAutoRoutesService(createContext(true, {}, { web: true }))

    await expect(service.ensureFresh()).resolves.toBeUndefined()
    expect(service.getSnapshot().entries).toEqual(['pages/index/index'])
    expect(parseNamedRoutesModule(service.getNamedModuleCode())).toEqual([])
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
