import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createTestCompilerContext, getFixture } from './utils'

describe('auto-routes', () => {
  it('collects routes from pages directory', async () => {
    const { ctx, dispose } = await createTestCompilerContext({
      cwd: getFixture('watch'),
      isDev: true,
    })
    const typedRouterPath = path.join(getFixture('watch'), 'typed-router.d.ts')

    try {
      const { autoRoutesService } = ctx
      await autoRoutesService.ensureFresh()

      expect(await fs.pathExists(typedRouterPath)).toBe(true)
      const typedRouterContent = await fs.readFile(typedRouterPath, 'utf8')
      expect(typedRouterContent).toContain('"pages/index/index"')

      const snapshot = autoRoutesService.getSnapshot()
      expect(snapshot.pages).toContain('pages/index/index')
      expect(snapshot.entries).toContain('packageA/pages/cat')

      const packageA = snapshot.subPackages.find(pkg => pkg.root === 'packageA')
      expect(packageA?.pages).toContain('pages/dog')

      const module = await import('../src/auto-routes')
      expect(module.pages).toBe(module.routes.pages)
      expect(module.entries).toBe(module.routes.entries)
      expect(module.subPackages).toBe(module.routes.subPackages)
      expect(module.pages).toContain('pages/index/index')
      expect(autoRoutesService.getModuleCode()).toContain('export { routes, pages, entries, subPackages };')
    }
    finally {
      await dispose()
      await fs.remove(typedRouterPath)
    }
  })

  it('collects routes for asset fixture', async () => {
    const { ctx, dispose } = await createTestCompilerContext({
      cwd: getFixture('asset'),
      isDev: true,
    })
    const typedRouterPath = path.join(getFixture('asset'), 'typed-router.d.ts')

    try {
      const { autoRoutesService } = ctx
      await autoRoutesService.ensureFresh()

      const snapshot = autoRoutesService.getSnapshot()
      expect(snapshot.pages).toContain('pages/index/index')

      const assetPackageA = snapshot.subPackages.find(pkg => pkg.root === 'packageA')
      expect(assetPackageA?.pages).toEqual(expect.arrayContaining(['pages/cat', 'pages/dog']))
    }
    finally {
      await dispose()
      await fs.remove(typedRouterPath)
    }
  })
})
