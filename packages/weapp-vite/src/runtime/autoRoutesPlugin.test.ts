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

  function createContext(autoRoutesEnabled: boolean = true): MutableCompilerContext {
    const runtimeState = createRuntimeState()

    const configService = {
      absoluteSrcRoot: srcRoot,
      cwd: tempDir,
      isDev: true,
      weappViteConfig: {
        autoRoutes: autoRoutesEnabled,
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

    const typedRouterPath = path.join(tempDir, 'typed-router.d.ts')
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

    const watchFiles = Array.from(service.getWatchFiles())
    expect(watchFiles).toEqual(expect.arrayContaining([
      path.join(srcRoot, 'pages', 'index', 'index.ts'),
    ]))

    const watchDirs = Array.from(service.getWatchDirectories())
    expect(watchDirs).toEqual(expect.arrayContaining([
      path.join(srcRoot, 'pages'),
      path.join(srcRoot, 'pages', 'index'),
    ]))

    expect(service.getModuleCode()).toContain('"pages/index/index"')
  })

  it('updates routes snapshot after handling file changes', async () => {
    const ctx = createContext()
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    const subPackagePage = path.join(srcRoot, 'packageA', 'pages', 'cat.ts')
    await fs.ensureDir(path.dirname(subPackagePage))
    await fs.writeFile(subPackagePage, '// subpackage page', 'utf8')

    await service.handleFileChange(subPackagePage)

    expect(service.isInitialized()).toBe(true)
    expect(service.isRouteFile(subPackagePage)).toBe(true)

    const typedRouterPath = path.join(tempDir, 'typed-router.d.ts')
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

    const watchFiles = Array.from(service.getWatchFiles())
    expect(watchFiles).toEqual(expect.arrayContaining([
      path.join(srcRoot, 'packageA', 'pages', 'cat.ts'),
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

    const watchFilesAfterCreate = Array.from(service.getWatchFiles())
    expect(watchFilesAfterCreate).toEqual(expect.arrayContaining([stylePath]))

    await fs.remove(stylePath)
    await service.handleFileChange(stylePath, 'delete')

    const watchFilesAfterDelete = Array.from(service.getWatchFiles())
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

    const typedRouterPath = path.join(tempDir, 'typed-router.d.ts')
    const typedRouterContent = await fs.readFile(typedRouterPath, 'utf8')
    expect(typedRouterContent).toContain('"pages/renamed/index"')
    expect(typedRouterContent).not.toContain('"pages/index/index"')
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
    const typedRouterPath = path.join(tempDir, 'typed-router.d.ts')
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
