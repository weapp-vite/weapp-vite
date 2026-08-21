import { describe, expect, it } from 'vitest'
import { createPreloadBudgets } from './budget'

function createPackage(id: string, size: number) {
  return {
    id,
    label: id,
    type: id === '__main__' ? 'main' : 'subPackage',
    files: [{ file: `${id}/index.js`, type: 'chunk', from: 'main', size }],
  }
}

describe('createPreloadBudgets', () => {
  it('deduplicates configured aliases and suggestions at the exact shared limit', () => {
    const appJson = {
      pages: ['pages/index/index'],
      subPackages: [
        { root: 'packages/order', name: 'orders', pages: ['index'] },
        { root: 'packages/profile', pages: ['index'] },
      ],
    }
    const result = {
      pages: [{ route: 'pages/index/index' }],
      suggestions: [
        {
          page: 'pages/index/index',
          packageRoot: 'packages/order',
          target: 'packages/order/index',
          source: 'script',
        },
        {
          page: 'pages/index/index',
          packageRoot: 'packages/order',
          target: 'packages/order/index',
          source: 'template',
        },
      ],
      uncovered: [],
    }

    expect(createPreloadBudgets(
      appJson,
      result as any,
      {
        '/pages/index': {
          packages: ['orders', 'packages/profile'],
        },
      },
      {
        packages: [
          createPackage('packages/order', 1024 * 1024),
          createPackage('packages/profile', 1024 * 1024),
        ],
        modules: [],
        subPackages: [],
      } as any,
    )).toEqual([expect.objectContaining({
      estimatedBytes: 2 * 1024 * 1024,
      remainingBytes: 0,
      sourcePackage: '__main__',
      sourceType: 'main',
      status: 'ok',
      targets: [
        {
          bytes: 1024 * 1024,
          configured: true,
          packageRoot: 'packages/order',
          suggested: true,
        },
        {
          bytes: 1024 * 1024,
          configured: true,
          packageRoot: 'packages/profile',
          suggested: false,
        },
      ],
      unknownPackages: [],
    })])
  })

  it('separates source packages and reports exceeded and unknown targets', () => {
    const appJson = {
      pages: ['pages/index/index'],
      subPackages: [{
        root: 'packages/independent',
        independent: true,
        pages: ['index'],
      }],
    }
    const result = {
      pages: [
        { route: 'pages/index/index' },
        { route: 'packages/independent/index', packageRoot: 'packages/independent', independent: true },
      ],
      suggestions: [
        {
          page: 'pages/index/index',
          packageRoot: 'packages/large',
          target: 'packages/large/index',
          source: 'script',
        },
        {
          page: 'packages/independent/index',
          packageRoot: '__APP__',
          target: 'pages/index/index',
          source: 'script',
        },
        {
          page: 'packages/independent/index',
          packageRoot: 'packages/missing',
          target: 'packages/missing/index',
          source: 'template',
        },
      ],
      uncovered: [],
    }

    expect(createPreloadBudgets(
      appJson,
      result as any,
      {},
      {
        packages: [
          createPackage('__main__', 512),
          createPackage('packages/large', 2 * 1024 * 1024 + 1),
        ],
        modules: [],
        subPackages: [],
      } as any,
    )).toEqual([
      expect.objectContaining({
        estimatedBytes: 2 * 1024 * 1024 + 1,
        sourcePackage: '__main__',
        status: 'exceeded',
      }),
      expect.objectContaining({
        estimatedBytes: 512,
        remainingBytes: undefined,
        sourcePackage: 'packages/independent',
        sourceType: 'independent',
        status: 'unknown',
        unknownPackages: ['packages/missing'],
      }),
    ])
  })
})
