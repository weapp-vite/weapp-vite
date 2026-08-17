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
        subPackages: [{ root: 'packages/order', pages: ['index'] }],
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
          script: 'router.push({ path: \'/packages/order/index?id=1\' }); router.push(getOrderPath(id))',
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
})
