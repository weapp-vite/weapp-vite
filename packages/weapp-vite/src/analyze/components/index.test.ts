import type { RolldownOutput } from 'rolldown'
import { describe, expect, it } from 'vitest'
import { analyzeComponentUsage, collectAnalyzeComponentJsonConfigs } from './index'

describe('analyze component usage', () => {
  it('tracks nested component usage from subpackage pages', () => {
    const result = analyzeComponentUsage({
      subPackages: [{ root: 'pkgA', independent: false }],
      jsonConfigs: [
        {
          file: 'app.json',
          config: {
            pages: ['pages/home/index'],
            subPackages: [{ root: 'pkgA', pages: ['pages/detail/index'] }],
          },
        },
        {
          file: 'pkgA/pages/detail/index.json',
          config: {
            usingComponents: {
              card: '/components/detail-card',
            },
          },
        },
        {
          file: 'components/detail-card.json',
          config: {
            usingComponents: {
              inner: './inner',
            },
          },
        },
        {
          file: 'components/inner.json',
          config: {},
        },
      ],
    })

    expect(result).toMatchObject([
      {
        component: 'components/detail-card',
        componentPackage: '__main__',
        totalUsageCount: 1,
        pageUsageCount: 1,
        pages: [{ page: 'pkgA/pages/detail/index', packageId: 'pkgA', usageCount: 1 }],
        suggestions: [{ kind: 'move-to-subpackage', targetPackage: 'pkgA' }],
      },
      {
        component: 'components/inner',
        componentPackage: '__main__',
        totalUsageCount: 1,
        pageUsageCount: 1,
        pages: [{ page: 'pkgA/pages/detail/index', packageId: 'pkgA', usageCount: 1 }],
        suggestions: [{ kind: 'move-to-subpackage', targetPackage: 'pkgA' }],
      },
    ])
  })

  it('suggests shared package strategy for main package components used by multiple subpackages', () => {
    const result = analyzeComponentUsage({
      subPackages: [
        { root: 'pkgA', independent: false },
        { root: 'pkgB', independent: false },
      ],
      jsonConfigs: [
        {
          file: 'app.json',
          config: {
            subPackages: [
              { root: 'pkgA', pages: ['pages/a'] },
              { root: 'pkgB', pages: ['pages/b'] },
            ],
          },
        },
        {
          file: 'pkgA/pages/a.json',
          config: { usingComponents: { shared: '/components/shared' } },
        },
        {
          file: 'pkgB/pages/b.json',
          config: { usingComponents: { shared: '/components/shared' } },
        },
        {
          file: 'components/shared.json',
          config: {},
        },
      ],
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      component: 'components/shared',
      totalUsageCount: 2,
      pageUsageCount: 2,
      suggestions: [{ kind: 'shared-subpackage-or-placeholder' }],
    })
  })

  it('does not suggest migration when cross-package references are covered by componentPlaceholder', () => {
    const result = analyzeComponentUsage({
      subPackages: [{ root: 'pkgA', independent: false }],
      jsonConfigs: [
        {
          file: 'app.json',
          config: {
            subPackages: [{ root: 'pkgA', pages: ['pages/detail/index'] }],
          },
        },
        {
          file: 'pkgA/pages/detail/index.json',
          config: {
            usingComponents: {
              shared: '/components/shared',
            },
            componentPlaceholder: {
              shared: 'view',
            },
          },
        },
        {
          file: 'components/shared.json',
          config: {},
        },
      ],
    })

    expect(result).toMatchObject([
      {
        component: 'components/shared',
        totalUsageCount: 1,
        suggestions: [],
      },
    ])
  })

  it('normalizes windows separators before resolving packages and relative components', () => {
    const result = analyzeComponentUsage({
      subPackages: [{ root: 'pkgA', independent: false }],
      jsonConfigs: [
        {
          file: 'app.json',
          config: {
            subPackages: [{ root: 'pkgA', pages: ['pages/detail/index'] }],
          },
        },
        {
          file: 'pkgA\\pages\\detail\\index.json',
          config: {
            usingComponents: {
              local: './local-card',
            },
          },
        },
        {
          file: 'pkgA\\pages\\detail\\local-card.json',
          config: {},
        },
      ],
    })

    expect(result).toMatchObject([
      {
        component: 'pkgA/pages/detail/local-card',
        componentPackage: 'pkgA',
        pages: [{ page: 'pkgA/pages/detail/index', packageId: 'pkgA', usageCount: 1 }],
        suggestions: [],
      },
    ])
  })

  it('collects json configs from rolldown assets', () => {
    const configs = collectAnalyzeComponentJsonConfigs({
      output: [
        {
          type: 'asset',
          fileName: 'pages/index.json',
          source: '{"usingComponents":{}}',
        },
        {
          type: 'asset',
          fileName: 'pages/index.wxml',
          source: '<view />',
        },
      ],
    } as unknown as RolldownOutput)

    expect(configs).toEqual([
      {
        file: 'pages/index',
        config: {
          usingComponents: {},
        },
      },
    ])
  })
})
