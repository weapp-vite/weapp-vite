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
            subPackages: [{ root: 'packages/order', pages: ['index'] }],
            preloadRule: {
              '/pages/index': {
                packages: ['packages/order'],
              },
            },
          },
        })),
      },
    } as any

    const result = await analyzePreloadRules(ctx, new Date('2026-08-17T00:00:00.000Z'))

    expect(result).toMatchObject({
      generatedAt: '2026-08-17T00:00:00.000Z',
      platform: 'weapp',
      uncoveredPages: [],
      suggestions: [{
        page: 'pages/index/index',
        packages: ['packages/order'],
        alreadyConfigured: ['packages/order'],
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
        return `<template><navigator url="/packages/order/index" /></template>\n<script setup>router.push('/packages/order/index')</script>`
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
})
