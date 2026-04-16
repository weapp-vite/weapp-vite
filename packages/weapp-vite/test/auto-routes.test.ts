import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createTestCompilerContext, getFixture } from './utils'

describe('auto-routes', () => {
  it('collects routes from pages directory', async () => {
    const { ctx, dispose } = await createTestCompilerContext({
      cwd: getFixture('watch'),
      isDev: true,
    })
    const typedRouterPath = path.join(getFixture('watch'), '.weapp-vite/typed-router.d.ts')

    try {
      const { autoRoutesService } = ctx
      await autoRoutesService.ensureFresh()

      expect(await fs.pathExists(typedRouterPath)).toBe(true)
      const typedRouterContent = await fs.readFile(typedRouterPath, 'utf8')
      expect(typedRouterContent).toContain('"pages/index/index"')
      expect(typedRouterContent).toContain('import \'wevu/router\';')
      expect(typedRouterContent).toContain('declare module \'wevu/router\'')
      expect(typedRouterContent).toContain('WevuTypedRouterRouteMap')

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
      expect(module.wxRouter).toBeTruthy()
      expect(autoRoutesService.getModuleCode()).toContain('export { routes, pages, entries, subPackages, wxRouter };')
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
    const typedRouterPath = path.join(getFixture('asset'), '.weapp-vite/typed-router.d.ts')

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

  it('hydrates app.json.ts auto-routes imports with scanned routes', async () => {
    const fixtureRoot = getFixture('watch')
    const tempRoot = await fs.mkdtemp(path.join(path.dirname(fixtureRoot), '.tmp-auto-routes-app-json-'))
    await fs.copy(fixtureRoot, tempRoot, {
      filter: (src) => {
        const relative = path.relative(fixtureRoot, src).replaceAll('\\', '/')
        if (!relative) {
          return true
        }
        return !(
          relative === 'node_modules'
          || relative.startsWith('node_modules/')
          || relative === 'dist'
          || relative.startsWith('dist/')
          || relative === '.weapp-vite'
          || relative.startsWith('.weapp-vite/')
        )
      },
    })
    const appJsonPath = path.join(tempRoot, 'src/app.json.ts')

    await fs.writeFile(
      appJsonPath,
      [
        'import routes from \'weapp-vite/auto-routes\'',
        '',
        'export default {',
        '  pages: routes.pages,',
        '  subPackages: routes.subPackages,',
        '}',
        '',
      ].join('\n'),
      'utf8',
    )

    const { ctx, dispose } = await createTestCompilerContext({
      cwd: tempRoot,
      isDev: true,
    })

    try {
      const entry = await ctx.scanService.loadAppEntry()
      const routes = ctx.autoRoutesService.getReference()
      expect(routes.pages).toContain('pages/index/index')
      expect(entry.json.pages).toEqual(routes.pages)
      expect(entry.json.subPackages).toEqual(routes.subPackages)
    }
    finally {
      await dispose()
      await fs.remove(tempRoot)
    }
  })

  it('hydrates app.json.ts named auto-routes imports with scanned routes', async () => {
    const fixtureRoot = getFixture('watch')
    const tempRoot = await fs.mkdtemp(path.join(path.dirname(fixtureRoot), '.tmp-auto-routes-app-json-'))
    await fs.copy(fixtureRoot, tempRoot, {
      filter: (src) => {
        const relative = path.relative(fixtureRoot, src).replaceAll('\\', '/')
        if (!relative) {
          return true
        }
        return !(
          relative === 'node_modules'
          || relative.startsWith('node_modules/')
          || relative === 'dist'
          || relative.startsWith('dist/')
          || relative === '.weapp-vite'
          || relative.startsWith('.weapp-vite/')
        )
      },
    })
    const appJsonPath = path.join(tempRoot, 'src/app.json.ts')

    await fs.writeFile(
      appJsonPath,
      [
        'import { pages, subPackages } from \'weapp-vite/auto-routes\'',
        '',
        'export default {',
        '  pages,',
        '  subPackages,',
        '}',
        '',
      ].join('\n'),
      'utf8',
    )

    const { ctx, dispose } = await createTestCompilerContext({
      cwd: tempRoot,
      isDev: true,
    })

    try {
      const entry = await ctx.scanService.loadAppEntry()
      const routes = ctx.autoRoutesService.getReference()
      expect(routes.pages).toContain('pages/index/index')
      expect(entry.json.pages).toEqual(routes.pages)
      expect(entry.json.subPackages).toEqual(routes.subPackages)
    }
    finally {
      await dispose()
      await fs.remove(tempRoot)
    }
  })
})
