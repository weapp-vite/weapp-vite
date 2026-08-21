import { beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzePreloadRules } from './preload'

const readFileMock = vi.hoisted(() => vi.fn())
const findTemplateEntryMock = vi.hoisted(() => vi.fn())
const findJsEntryMock = vi.hoisted(() => vi.fn())
const findVueEntryMock = vi.hoisted(() => vi.fn())

vi.mock('@weapp-core/shared/fs', () => ({
  fs: {
    readFile: readFileMock,
  },
}))

vi.mock('../utils', () => ({
  findTemplateEntry: findTemplateEntryMock,
  findJsEntry: findJsEntryMock,
  findVueEntry: findVueEntryMock,
}))

describe('analyzePreloadRules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findTemplateEntryMock.mockImplementation(async (base: string) => ({
      path: `${base}.wxml`,
    }))
    findJsEntryMock.mockImplementation(async (base: string) => ({
      path: `${base}.js`,
    }))
    findVueEntryMock.mockResolvedValue(undefined)
    readFileMock.mockImplementation(async (filename: string) => {
      if (filename.endsWith('pages/index/index.wxml')) {
        return '<navigator url="/packages/order/index?id=1" />'
      }
      if (filename.endsWith('pages/index/index.js')) {
        return 'wx.navigateTo({ url: \'/packages/order/index\' })'
      }
      return '<view />'
    })
  })

  it('parses native page sources and marks configured targets', async () => {
    const ctx = {
      configService: {
        absoluteSrcRoot: '/project/src',
        platform: 'weapp',
      },
      scanService: {
        loadAppEntry: vi.fn(async () => ({
          json: {
            pages: ['pages/index/index'],
            subPackages: [{ root: 'packages/order', name: 'orders', pages: ['index'] }],
            preloadRule: {
              '/pages/index': {
                packages: ['orders'],
              },
            },
          },
        })),
      },
    } as any

    const result = await analyzePreloadRules(ctx, {
      now: new Date('2026-08-17T00:00:00.000Z'),
      packageAnalysis: {
        packages: [{
          id: 'packages/order',
          label: '分包 packages/order',
          type: 'subPackage',
          files: [{ file: 'packages/order/index.js', type: 'chunk', from: 'main', size: 1024 }],
        }],
        modules: [],
        subPackages: [],
      },
    })

    expect(result).toMatchObject({
      generatedAt: '2026-08-17T00:00:00.000Z',
      platform: 'weapp',
      uncoveredPages: [],
      suggestions: [{
        page: 'pages/index/index',
        packages: ['packages/order'],
        alreadyConfigured: ['packages/order'],
      }],
      budgets: [{
        sourcePackage: '__main__',
        sourceType: 'main',
        limitBytes: 2 * 1024 * 1024,
        estimatedBytes: 1024,
        remainingBytes: 2 * 1024 * 1024 - 1024,
        status: 'ok',
        unknownPackages: [],
        targets: [{
          packageRoot: 'packages/order',
          bytes: 1024,
          configured: true,
          suggested: true,
        }],
      }],
    })
    expect(result.suggestions[0]?.evidence).toEqual([
      {
        target: 'packages/order/index',
        packageRoot: 'packages/order',
        source: 'template',
      },
      {
        target: 'packages/order/index',
        packageRoot: 'packages/order',
        source: 'script',
      },
    ])
  })

  it('separates Vue template and script blocks before scanning', async () => {
    findVueEntryMock.mockImplementation(async (base: string) => {
      if (base.endsWith('pages/index/index')) {
        return `${base}.vue`
      }
      return undefined
    })
    readFileMock.mockImplementation(async (filename: string) => {
      if (filename.endsWith('pages/index/index.vue')) {
        return `<template><navigator url="/packages/order/index" /></template>\n<script setup>const router = useRouter(); router.push('/packages/order/index')</script>`
      }
      return '<view />'
    })

    const ctx = {
      configService: {
        absoluteSrcRoot: '/project/src',
        platform: 'weapp',
      },
      scanService: {
        loadAppEntry: vi.fn(async () => ({
          json: {
            pages: ['pages/index/index'],
            subPackages: [{ root: 'packages/order', pages: ['index'] }],
          },
        })),
      },
    } as any

    const result = await analyzePreloadRules(ctx)

    expect(result.suggestions[0]?.evidence).toEqual([
      {
        target: 'packages/order/index',
        packageRoot: 'packages/order',
        source: 'template',
      },
      {
        target: 'packages/order/index',
        packageRoot: 'packages/order',
        source: 'script',
      },
    ])
  })

  it('aggregates the shared preload limit by source package', async () => {
    readFileMock.mockImplementation(async (filename: string) => {
      if (filename.endsWith('.wxml')) {
        return '<view />'
      }
      if (filename.endsWith('pages/index/index.js')) {
        return 'wx.navigateTo({ url: \'/packages/order/index\' })'
      }
      if (filename.endsWith('pages/home/index.js')) {
        return 'wx.navigateTo({ url: \'/packages/profile/index\' })'
      }
      return ''
    })

    const ctx = {
      configService: {
        absoluteSrcRoot: '/project/src',
        platform: 'weapp',
      },
      scanService: {
        loadAppEntry: vi.fn(async () => ({
          json: {
            pages: ['pages/index/index', 'pages/home/index'],
            subPackages: [
              { root: 'packages/order', pages: ['index'] },
              { root: 'packages/profile', pages: ['index'] },
            ],
          },
        })),
      },
    } as any

    const result = await analyzePreloadRules(ctx, {
      packageAnalysis: {
        packages: [
          {
            id: 'packages/order',
            label: '分包 packages/order',
            type: 'subPackage',
            files: [{ file: 'packages/order/index.js', type: 'chunk', from: 'main', size: 1_200_000 }],
          },
          {
            id: 'packages/profile',
            label: '分包 packages/profile',
            type: 'subPackage',
            files: [{ file: 'packages/profile/index.js', type: 'chunk', from: 'main', size: 1_100_000 }],
          },
        ],
        modules: [],
        subPackages: [],
      },
    })

    expect(result.budgets).toMatchObject([{
      sourcePackage: '__main__',
      estimatedBytes: 2_300_000,
      status: 'exceeded',
      unknownPackages: [],
    }])
    expect(result.budgets[0]?.targets.map(target => target.packageRoot)).toEqual([
      'packages/order',
      'packages/profile',
    ])
  })
})
