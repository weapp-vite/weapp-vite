import { describe, expect, it } from 'vitest'
import {
  applyBuildScopeToAppConfig,
  applyBuildScopeToAutoRoutes,
  applyBuildScopeToSubPackageRoots,
  createBuildScopeConfigFromCli,
  resolveBuildScope,
  resolveBuildScopeFromCli,
} from './buildScope'

describe('buildScope', () => {
  it('normalizes cli scope with main package enabled by default', () => {
    expect(resolveBuildScopeFromCli('main, packages/order, packages\\user')).toEqual({
      enabled: true,
      includeMainPackage: true,
      subPackageRoots: ['packages/order', 'packages/user'],
      source: 'cli',
    })

    expect(createBuildScopeConfigFromCli('packages/order')).toMatchObject({
      includeMainPackage: true,
      include: ['packages/order'],
    })
  })

  it('allows config to disable main package explicitly', () => {
    expect(resolveBuildScope({
      includeMainPackage: false,
      include: ['packages/order'],
    })).toEqual({
      enabled: true,
      includeMainPackage: false,
      subPackageRoots: ['packages/order'],
      source: 'config',
    })
  })

  it('filters app config pages, subpackages and preload rules by scope', () => {
    const appConfig = {
      pages: ['pages/home/index'],
      subPackages: [
        { root: 'packages/order', pages: ['pages/list/index'] },
        { root: 'packages/user', pages: ['pages/profile/index'] },
      ],
      preloadRule: {
        'pages/home/index': {
          network: 'all',
          packages: ['packages/order', 'packages/user'],
        },
        'packages/user/pages/profile/index': {
          packages: ['packages/order'],
        },
      },
    }

    applyBuildScopeToAppConfig(appConfig, resolveBuildScope({
      include: ['packages/order'],
    }))

    expect(appConfig.pages).toEqual(['pages/home/index'])
    expect(appConfig.subPackages).toEqual([
      { root: 'packages/order', pages: ['pages/list/index'] },
    ])
    expect(appConfig).not.toHaveProperty('subpackages')
    expect(appConfig.preloadRule).toEqual({
      'pages/home/index': {
        network: 'all',
        packages: ['packages/order'],
      },
    })
  })

  it('can build only a target subpackage when main package is disabled', () => {
    const appConfig = {
      pages: ['pages/home/index'],
      subpackages: [
        { root: 'packages/order', pages: ['pages/list/index'] },
        { root: 'packages/user', pages: ['pages/profile/index'] },
      ],
      preloadRule: {
        'pages/home/index': {
          packages: ['packages/order'],
        },
        'packages/order/pages/list/index': {
          packages: ['packages/user'],
        },
      },
    }

    applyBuildScopeToAppConfig(appConfig, resolveBuildScope({
      includeMainPackage: false,
      include: ['packages/order'],
    }))

    expect(appConfig.pages).toEqual([])
    expect(appConfig.subPackages).toEqual([
      { root: 'packages/order', pages: ['pages/list/index'] },
    ])
    expect(appConfig.preloadRule).toBeUndefined()
  })

  it('filters auto-routes module snapshot by build scope', () => {
    const scopedRoutes = applyBuildScopeToAutoRoutes({
      pages: ['pages/home/index'],
      entries: [
        'pages/home/index',
        'packages/order/pages/list/index',
        'packages/user/pages/profile/index',
      ],
      subPackages: [
        { root: 'packages/order', pages: ['pages/list/index'] },
        { root: 'packages/user', pages: ['pages/profile/index'] },
      ],
    }, resolveBuildScope({ include: ['packages/order'] }))

    expect(scopedRoutes).toEqual({
      pages: ['pages/home/index'],
      entries: [
        'pages/home/index',
        'packages/order/pages/list/index',
      ],
      subPackages: [
        { root: 'packages/order', pages: ['pages/list/index'] },
      ],
    })
  })

  it('filters auto-routes subpackage roots before candidate matching', () => {
    expect(applyBuildScopeToSubPackageRoots(
      ['packages/order', 'packages/user'],
      resolveBuildScope({ include: ['packages/order'] }),
    )).toEqual(['packages/order'])
  })
})
