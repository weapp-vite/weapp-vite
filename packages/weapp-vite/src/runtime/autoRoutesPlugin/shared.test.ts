import path from 'pathe'
import { describe, expect, it } from 'vitest'
import {
  isAliasedAutoRoutesId,
  isAutoRoutesPagesRelatedPath,
  resolveAutoRoutesAliasTargets,
  resolveAutoRoutesBasePath,
  resolveAutoRoutesMatcherContext,
  resolveAutoRoutesPath,
  shouldAutoRoutesFullRescan,
} from './shared'

describe('auto routes shared helpers', () => {
  it('resolves relative and windows-style route paths inside src root', () => {
    expect(resolveAutoRoutesPath('src/pages/home/index.vue?vue&type=script', {
      cwd: '/project',
      absoluteSrcRoot: '/project/src',
    })).toEqual({
      absolutePath: '/project/src/pages/home/index.vue',
      relativePath: 'pages/home/index.vue',
    })

    expect(resolveAutoRoutesPath('C:\\project\\src\\pages\\home\\index.ts', {
      cwd: 'C:/project',
      absoluteSrcRoot: 'C:/project/src',
    })).toEqual({
      absolutePath: 'C:/project/src/pages/home/index.ts',
      relativePath: 'pages/home/index.ts',
    })
  })

  it('returns undefined when candidate is empty or outside src root', () => {
    expect(resolveAutoRoutesPath('?vue', {
      cwd: '/project',
      absoluteSrcRoot: '/project/src',
    })).toBeUndefined()

    expect(resolveAutoRoutesPath('/project/components/card/index.ts', {
      cwd: '/project',
      absoluteSrcRoot: '/project/src',
    })).toBeUndefined()
  })

  it('resolves extensionless auto-routes base paths', () => {
    expect(resolveAutoRoutesBasePath('/project/src/pages/home/index.vue?vue&type=script', {
      cwd: '/project',
      absoluteSrcRoot: '/project/src',
    })).toEqual({
      base: '/project/src/pages/home/index',
      relativeBase: 'pages/home/index',
    })

    expect(resolveAutoRoutesBasePath('/project/components/card/index.ts', {
      cwd: '/project',
      absoluteSrcRoot: '/project/src',
    })).toBeUndefined()
  })

  it('resolves alias targets for source and dist entries', () => {
    const targets = resolveAutoRoutesAliasTargets('/virtual/weapp-vite')
    expect([...targets]).toEqual([
      '/virtual/weapp-vite/src/auto-routes.ts',
      '/virtual/weapp-vite/auto-routes.ts',
      '/virtual/weapp-vite/dist/auto-routes.mjs',
      '/virtual/weapp-vite/dist/auto-routes.js',
    ])
    expect(resolveAutoRoutesAliasTargets()).toEqual(new Set())
  })

  it('matches normalized auto-routes alias ids', () => {
    const targets = resolveAutoRoutesAliasTargets('/virtual/weapp-vite')
    expect(isAliasedAutoRoutesId('/virtual/weapp-vite/src/auto-routes.ts', targets)).toBe(true)
    expect(isAliasedAutoRoutesId('C:\\virtual\\weapp-vite\\dist\\auto-routes.js', new Set([
      'C:/virtual/weapp-vite/dist/auto-routes.js',
    ]))).toBe(true)
    expect(isAliasedAutoRoutesId('/virtual/project/src/pages/index.ts', targets)).toBe(false)
  })

  it('resolves matcher context from config and runtime subpackages', () => {
    const resolved = resolveAutoRoutesMatcherContext({
      configService: {
        weappViteConfig: {
          autoRoutes: {
            include: ['views/**'],
          },
          subPackages: {
            pkgA: {},
          },
          npm: {
            subPackages: {
              npmPkg: {},
            },
          },
        },
      },
      runtimeState: {
        scan: {
          appEntry: {
            json: {
              subPackages: [{ root: 'pkgB' }],
              subpackages: [{ root: 'pkgC' }],
            },
          },
        },
      },
    } as any)

    expect(resolved.autoRoutesConfig.include).toEqual(['views/**'])
    expect(resolved.subPackageRoots).toEqual(['pkgA', 'npmPkg', 'pkgB', 'pkgC'])
    expect(resolved.matcher.matches('views/home/index')).toBe(true)
    expect(resolved.matcher.matches('pages/home/index')).toBe(false)
  })

  it('matches default pages paths and subpackage roots', () => {
    expect(isAutoRoutesPagesRelatedPath('/project/src/pages/home/index.ts', {
      cwd: '/project',
      absoluteSrcRoot: '/project/src',
      subPackageRoots: ['pkgA'],
    })).toBe(true)

    expect(isAutoRoutesPagesRelatedPath('/project/src/pkgA/detail/index.ts', {
      cwd: '/project',
      absoluteSrcRoot: '/project/src',
      subPackageRoots: ['pkgA'],
    })).toBe(true)

    expect(isAutoRoutesPagesRelatedPath('/project/src/components/card/index.ts', {
      cwd: '/project',
      absoluteSrcRoot: '/project/src',
      subPackageRoots: ['pkgA'],
    })).toBe(false)
  })

  it('matches custom include patterns and watch roots', () => {
    expect(isAutoRoutesPagesRelatedPath('/project/src/views/home/index.ts', {
      cwd: '/project',
      absoluteSrcRoot: '/project/src',
      include: ['views/**'],
    })).toBe(true)

    expect(isAutoRoutesPagesRelatedPath('/project/src/views', {
      cwd: '/project',
      absoluteSrcRoot: '/project/src',
      include: ['views/**'],
    })).toBe(true)

    expect(isAutoRoutesPagesRelatedPath('/project/src/pkgA/screens', {
      cwd: '/project',
      absoluteSrcRoot: '/project/src',
      include: ['pkgA/screens/**'],
    })).toBe(true)
  })

  it('does not match nested pages-looking directories outside configured watch roots', () => {
    expect(isAutoRoutesPagesRelatedPath('/project/src/components/pages/card/index.ts', {
      cwd: '/project',
      absoluteSrcRoot: '/project/src',
    })).toBe(false)

    expect(isAutoRoutesPagesRelatedPath(path.resolve('/project', 'views/home/index.ts'), {
      cwd: '/project',
      absoluteSrcRoot: '/project/src',
      include: ['pkgA/screens/**'],
    })).toBe(false)
  })

  it('marks create delete and rename events for full rescan', () => {
    expect(shouldAutoRoutesFullRescan('create')).toBe(true)
    expect(shouldAutoRoutesFullRescan('delete')).toBe(true)
    expect(shouldAutoRoutesFullRescan('rename')).toBe(true)
    expect(shouldAutoRoutesFullRescan('update')).toBe(false)
    expect(shouldAutoRoutesFullRescan()).toBe(false)
  })
})
