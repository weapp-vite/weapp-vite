import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  cssCodeCache,
  invalidateSharedStyleCache,
  processCssWithCache,
  renderSharedStyleEntry,
} from './preprocessor'

const statMock = vi.hoisted(() => vi.fn())
const readFileMock = vi.hoisted(() => vi.fn())
const preprocessCSSMock = vi.hoisted(() => vi.fn())
const cssPostProcessMock = vi.hoisted(() => vi.fn())

vi.mock('@weapp-core/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@weapp-core/shared')>()
  return {
    ...actual,
    fs: {
      ...actual.fs,
      stat: statMock,
      readFile: readFileMock,
    },
  }
})

vi.mock('vite', () => ({
  preprocessCSS: preprocessCSSMock,
}))

vi.mock('../../../postcss', () => ({
  cssPostProcess: cssPostProcessMock,
}))

function createEntry(overrides: Record<string, unknown> = {}) {
  return {
    source: 'subpackages/pkg/shared.scss',
    absolutePath: '/project/src/subpackages/pkg/shared.scss',
    ...overrides,
  } as any
}

describe('css shared preprocessor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateSharedStyleCache()
  })

  it('caches css post process result by platform and code', async () => {
    cssPostProcessMock.mockResolvedValue('processed-css')

    const weappConfig = { platform: 'weapp' } as any
    const alipayConfig = { platform: 'alipay' } as any

    expect(await processCssWithCache('view{}', weappConfig)).toBe('processed-css')
    expect(await processCssWithCache('view{}', weappConfig)).toBe('processed-css')
    expect(cssPostProcessMock).toHaveBeenCalledTimes(1)

    cssPostProcessMock.mockResolvedValue('processed-alipay')
    expect(await processCssWithCache('view{}', alipayConfig)).toBe('processed-alipay')
    expect(cssPostProcessMock).toHaveBeenCalledTimes(2)
  })

  it('returns raw style content and reads from cache when resolved config is absent', async () => {
    const entry = createEntry()
    statMock.mockResolvedValue({
      mtimeMs: 1,
      size: 12,
    })
    readFileMock.mockResolvedValue('page { color: red; }')

    const first = await renderSharedStyleEntry(entry, {} as any)
    const second = await renderSharedStyleEntry(entry, {} as any)

    expect(first).toEqual({
      css: 'page { color: red; }',
      dependencies: [],
    })
    expect(second).toEqual({
      css: 'page { color: red; }',
      dependencies: [],
    })
    expect(readFileMock).toHaveBeenCalledTimes(1)
    expect(preprocessCSSMock).not.toHaveBeenCalled()
  })

  it('normalizes and dedupes dependencies when preprocess is enabled', async () => {
    const entry = createEntry()
    statMock.mockResolvedValue({
      mtimeMs: 2,
      size: 99,
    })
    readFileMock.mockResolvedValue('@import "./base.scss";')
    preprocessCSSMock.mockResolvedValue({
      code: 'processed-content',
      deps: [
        './base.scss',
        './base.scss',
        '/project/src/shared/tokens.scss',
      ],
    })

    const result = await renderSharedStyleEntry(entry, {} as any, {} as any)
    expect(result).toEqual({
      css: 'processed-content',
      dependencies: [
        '/project/src/subpackages/pkg/base.scss',
        '/project/src/shared/tokens.scss',
      ],
    })

    result.dependencies.push('mutated')
    const cached = await renderSharedStyleEntry(entry, {} as any, {} as any)
    expect(cached.dependencies).toEqual([
      '/project/src/subpackages/pkg/base.scss',
      '/project/src/shared/tokens.scss',
    ])
    expect(preprocessCSSMock).toHaveBeenCalledTimes(1)
  })

  it('reprocesses shared style when file stats changed', async () => {
    const entry = createEntry()
    statMock
      .mockResolvedValueOnce({
        mtimeMs: 3,
        size: 10,
      })
      .mockResolvedValueOnce({
        mtimeMs: 4,
        size: 11,
      })
    readFileMock
      .mockResolvedValueOnce('.a { color: red; }')
      .mockResolvedValueOnce('.a { color: blue; }')
    preprocessCSSMock
      .mockResolvedValueOnce({
        code: 'v1',
        deps: [],
      })
      .mockResolvedValueOnce({
        code: 'v2',
        deps: [],
      })

    expect(await renderSharedStyleEntry(entry, {} as any, {} as any)).toEqual({
      css: 'v1',
      dependencies: [],
    })
    expect(await renderSharedStyleEntry(entry, {} as any, {} as any)).toEqual({
      css: 'v2',
      dependencies: [],
    })
    expect(preprocessCSSMock).toHaveBeenCalledTimes(2)
  })

  it('wraps fs and preprocess errors with subpackage source context', async () => {
    const entry = createEntry({
      source: 'subpackages/order/common.scss',
    })

    statMock.mockRejectedValueOnce(new Error('ENOENT'))
    await expect(renderSharedStyleEntry(entry, {} as any, {} as any)).rejects.toThrow(
      '[分包] 编译共享样式 `subpackages/order/common.scss` 失败：ENOENT',
    )

    statMock.mockResolvedValueOnce({
      mtimeMs: 7,
      size: 21,
    })
    readFileMock.mockResolvedValueOnce('body {}')
    preprocessCSSMock.mockRejectedValueOnce(new Error('invalid syntax'))

    await expect(renderSharedStyleEntry(entry, {} as any, {} as any)).rejects.toThrow(
      '[分包] 编译共享样式 `subpackages/order/common.scss` 失败：invalid syntax',
    )
  })

  it('clears local caches when invalidating shared style cache', () => {
    cssCodeCache.set('temp', 'temp-value')
    expect(cssCodeCache.get('temp')).toBe('temp-value')

    expect(() => invalidateSharedStyleCache()).not.toThrow()
    expect(cssCodeCache.get('temp')).toBeUndefined()
  })
})
