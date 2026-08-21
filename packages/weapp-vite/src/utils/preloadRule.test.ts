import { describe, expect, it } from 'vitest'
import {
  applyPreloadRulesToAppJson,
  collectPreloadPages,
  suggestPreloadRules,
} from './preloadRule'

describe('preloadRule helpers', () => {
  it('collects main and subpackage page routes', () => {
    expect(collectPreloadPages({
      pages: ['pages/index/index'],
      subPackages: [{ root: 'packages/order', pages: ['index', 'detail'] }],
    })).toEqual([
      { route: 'pages/index/index' },
      { route: 'packages/order/index', packageRoot: 'packages/order' },
      { route: 'packages/order/detail', packageRoot: 'packages/order' },
    ])
  })

  it('merges the most specific route rule without replacing manual app rules', () => {
    const appJson = {
      pages: ['pages/index/index', 'pages/admin/index'],
      subPackages: [{ root: 'packages/order', pages: ['index'] }],
      preloadRule: {
        'pages/admin/index': {
          packages: ['packages/manual'],
          network: 'all',
        },
      },
    }

    applyPreloadRulesToAppJson(appJson, {
      'pages/**': {
        preload: {
          packages: ['packages/fallback'],
        },
      },
      'pages/admin/**': {
        preload: {
          packages: ['packages/admin'],
          network: 'wifi',
        },
      },
      'packages/order/**': {
        preload: {
          packages: ['packages/order-related'],
        },
      },
    }, 'weapp')

    expect(appJson.preloadRule).toEqual({
      'pages/admin/index': {
        packages: ['packages/manual'],
        network: 'all',
      },
      'pages/index/index': {
        packages: ['packages/fallback'],
      },
      'packages/order/index': {
        packages: ['packages/order-related'],
      },
    })
  })

  it('accepts route-rule shorthand and normalizes package roots', () => {
    const appJson = {
      pages: ['pages/home/index'],
    }

    applyPreloadRulesToAppJson(appJson, {
      '/home': {
        preload: {
          packages: ['/packages/order/', 'packages/order'],
          network: 'wifi',
        },
      },
    }, 'weapp')

    expect(appJson.preloadRule).toEqual({
      'pages/home/index': {
        packages: ['packages/order'],
        network: 'wifi',
      },
    })
  })

  it('rejects preload rules that normalize to an empty package root', () => {
    expect(() => applyPreloadRulesToAppJson({ pages: ['pages/index/index'] }, {
      'pages/**': {
        preload: { packages: ['/'] },
      },
    }, 'weapp')).toThrow('必须包含有效的分包 root')
  })

  it('does not emit the WeChat-only field for another target platform', () => {
    const appJson = {
      pages: ['pages/index/index'],
    }
    applyPreloadRulesToAppJson(appJson, {
      'pages/index/index': {
        preload: { packages: ['packages/order'] },
      },
    }, 'alipay')
    expect(appJson).toEqual({ pages: ['pages/index/index'] })
  })

  it('reports static cross-package template and script navigation', () => {
    const result = suggestPreloadRules(
      {
        pages: ['pages/index/index'],
        subPackages: [
          { root: 'packages/order', pages: ['index'] },
          { root: 'packages/profile', pages: ['index'] },
        ],
      },
      new Map([
        ['pages/index/index', {
          template: '<navigator url="/packages/order/index" />',
          script: 'wx.navigateTo({ url: \'/packages/order/index\' })',
        }],
        ['packages/order/index', { template: '<view />' }],
      ]),
    )

    expect(result.suggestions).toEqual([
      {
        page: 'pages/index/index',
        packageRoot: 'packages/order',
        target: 'packages/order/index',
        source: 'template',
      },
      {
        page: 'pages/index/index',
        packageRoot: 'packages/order',
        target: 'packages/order/index',
        source: 'script',
      },
    ])
    expect(result.uncovered).toEqual([])
  })

  it('normalizes query strings and supports router path calls while skipping dynamic targets', () => {
    const result = suggestPreloadRules(
      {
        pages: ['pages/index/index'],
        subPackages: [{ root: 'packages/order', pages: ['index'] }],
      },
      new Map([
        ['pages/index/index', {
          script: 'const router = useRouter(); router.push({ path: \'/packages/order/index?id=1\' }); router.push(getOrderPath(id))',
        }],
      ]),
    )

    expect(result.suggestions).toEqual([{
      page: 'pages/index/index',
      packageRoot: 'packages/order',
      target: 'packages/order/index',
      source: 'script',
    }])
  })

  it('only reports host navigation and proven router bindings', () => {
    const result = suggestPreloadRules(
      {
        pages: ['pages/index/index'],
        subPackages: [{ root: 'packages/order', pages: ['index'] }],
      },
      new Map([
        ['pages/index/index', {
          script: [
            'const values = []; values.push(\'/packages/order/index\')',
            'history.replace({ path: \'/packages/order/index\' })',
            'push(\'/packages/order/index\')',
            'const appRouter = useRouter()',
            'function shadowed(appRouter) { appRouter.push(\'/packages/profile/index\') }',
            'appRouter.push(\'/packages/order/index\')',
          ].join(';'),
        }],
      ]),
    )

    expect(result.suggestions).toEqual([{
      page: 'pages/index/index',
      packageRoot: 'packages/order',
      target: 'packages/order/index',
      source: 'script',
    }])
  })

  it('tracks imported factory aliases and rejects locally shadowed factories', () => {
    const result = suggestPreloadRules(
      {
        pages: ['pages/index/index'],
        subPackages: [
          { root: 'packages/order', pages: ['index'] },
          { root: 'packages/profile', pages: ['index'] },
        ],
      },
      new Map([
        ['pages/index/index', {
          script: [
            'import { useRouter as useAppRouter } from \'wevu/router\'',
            'import { useNativeRouter as useNative } from \'wevu\'',
            'const appRouter = useAppRouter()',
            'const nativeRouter = useNative()',
            'appRouter.push(\'/packages/order/index\')',
            'nativeRouter.navigateTo({ url: \'/packages/profile/index\' })',
            'function ignored(useAppRouter) {',
            '  const shadowedRouter = useAppRouter()',
            '  shadowedRouter.push(\'/packages/profile/index\')',
            '}',
            'function useRouter() { return { push() {} } }',
            'const localRouter = useRouter()',
            'localRouter.push(\'/packages/profile/index\')',
          ].join('\n'),
        }],
      ]),
    )

    expect(result.suggestions).toEqual([
      {
        page: 'pages/index/index',
        packageRoot: 'packages/order',
        target: 'packages/order/index',
        source: 'script',
      },
      {
        page: 'pages/index/index',
        packageRoot: 'packages/profile',
        target: 'packages/profile/index',
        source: 'script',
      },
    ])
  })

  it('suggests preloading the main package from an independent subpackage', () => {
    const result = suggestPreloadRules(
      {
        pages: ['pages/index/index'],
        subPackages: [{
          root: 'packages/independent',
          independent: true,
          pages: ['index'],
        }],
      },
      new Map([
        ['packages/independent/index', {
          script: 'wx.reLaunch({ url: \'/pages/index/index\' })',
        }],
      ]),
    )

    expect(result.suggestions).toEqual([{
      page: 'packages/independent/index',
      packageRoot: '__APP__',
      target: 'pages/index/index',
      source: 'script',
    }])
  })

  it('parses navigation options regardless of property order and resolves relative routes', () => {
    const result = suggestPreloadRules(
      {
        pages: ['pages/home/index'],
        subPackages: [{ root: 'packages/order', pages: ['index'] }],
      },
      new Map([
        ['pages/home/index', {
          template: '<view url="/packages/order/index" /><navigator-button url="/packages/order/index" /><navigator :url="dynamic" /><navigator url="../../packages/order/index" />',
          script: 'wx.navigateTo({ animationType: \'fade\', url: \'/packages/order/index\' })',
        }],
      ]),
    )

    expect(result.suggestions).toEqual([
      {
        page: 'pages/home/index',
        packageRoot: 'packages/order',
        target: 'packages/order/index',
        source: 'template',
      },
      {
        page: 'pages/home/index',
        packageRoot: 'packages/order',
        target: 'packages/order/index',
        source: 'script',
      },
    ])
  })

  it('supports destructured router factories while rejecting shadowed and reassigned bindings', () => {
    const result = suggestPreloadRules(
      {
        pages: ['pages/index/index'],
        subPackages: [
          { root: 'packages/order', pages: ['index'] },
          { root: 'packages/profile', pages: ['index'] },
        ],
      },
      new Map([
        ['pages/index/index', {
          script: [
            'import { createRouter as createAppRouter } from \'vue-router\'',
            'import { useNativeRouter } from \'wevu\'',
            'const { push: openPage } = createAppRouter()',
            'const { navigateTo: openNative } = useNativeRouter()',
            'openPage({ path: \'/packages/order/index\' })',
            'openNative({ url: \'/packages/profile/index\' })',
            'let mutableRouter = createAppRouter()',
            'mutableRouter = history',
            'mutableRouter.push(\'/packages/profile/index\')',
            'function local(wx) { wx.navigateTo({ url: \'/packages/profile/index\' }) }',
            'const values = []; values.push(\'/packages/profile/index\')',
          ].join('\n'),
        }],
      ]),
    )

    expect(result.suggestions).toEqual([
      {
        page: 'pages/index/index',
        packageRoot: 'packages/order',
        target: 'packages/order/index',
        source: 'script',
      },
      {
        page: 'pages/index/index',
        packageRoot: 'packages/profile',
        target: 'packages/profile/index',
        source: 'script',
      },
    ])
  })
})
