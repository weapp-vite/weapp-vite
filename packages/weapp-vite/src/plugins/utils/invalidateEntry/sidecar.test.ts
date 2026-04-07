import { beforeEach, describe, expect, it, vi } from 'vitest'

import { invalidateEntryForSidecar } from './sidecar'

const touchMock = vi.hoisted(() => vi.fn(async () => {}))
const findJsEntryMock = vi.hoisted(() => vi.fn(async () => ({ path: undefined, predictions: [] })))
const findVueEntryMock = vi.hoisted(() => vi.fn(async () => undefined))
const collectAffectedScriptsAndImportersMock = vi.hoisted(() => vi.fn(async () => ({
  importers: new Set<string>(),
  scripts: new Set<string>(),
})))
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  success: vi.fn(),
}))

vi.mock('../../../utils/file', () => ({
  findJsEntry: findJsEntryMock,
  findVueEntry: findVueEntryMock,
  touch: touchMock,
}))

vi.mock('./cssGraph', () => ({
  collectAffectedScriptsAndImporters: collectAffectedScriptsAndImportersMock,
}))

vi.mock('../../../logger', () => ({
  default: loggerMock,
}))

function createContext() {
  return {
    configService: {
      relativeCwd: (value: string) => value.replace('/project/', ''),
    },
    wxmlService: {
      getImporters: vi.fn((value: string) => {
        if (value === '/project/src/shared/card.wxml') {
          return new Set([
            '/project/src/pages/home/index.wxml',
            '/project/src/pages/dashboard/index.vue',
          ])
        }
        if (value === '/project/src/shared/helper.wxs') {
          return new Set([
            '/project/src/pages/dashboard/index.vue',
          ])
        }
        return new Set<string>()
      }),
    },
  } as any
}

describe('invalidateEntryForSidecar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findJsEntryMock.mockResolvedValue({ path: undefined, predictions: [] })
    findVueEntryMock.mockResolvedValue(undefined)
    collectAffectedScriptsAndImportersMock.mockResolvedValue({
      importers: new Set<string>(),
      scripts: new Set<string>(),
    })
  })

  it('skips touching direct script entries for template update sidecars', async () => {
    const ctx = createContext()
    findJsEntryMock.mockResolvedValueOnce({
      path: '/project/src/pages/hmr/index.ts',
      predictions: ['/project/src/pages/hmr/index.ts'],
    })

    await invalidateEntryForSidecar(ctx, '/project/src/pages/hmr/index.wxml', 'update')

    expect(touchMock).not.toHaveBeenCalledWith('/project/src/pages/hmr/index.ts')
    expect(loggerMock.info).not.toHaveBeenCalled()
    expect(loggerMock.success).not.toHaveBeenCalled()
  })

  it('touches all template importers for standalone imported wxml files', async () => {
    const ctx = createContext()

    await invalidateEntryForSidecar(ctx, '/project/src/shared/card.wxml', 'update')

    expect(touchMock).toHaveBeenCalledWith('/project/src/pages/home/index.wxml')
    expect(touchMock).toHaveBeenCalledWith('/project/src/pages/dashboard/index.vue')
    expect(loggerMock.success).toHaveBeenCalledWith(
      '[sidecar:update] src/shared/card.wxml -> 刷新 src/pages/home/index.wxml, src/pages/dashboard/index.vue',
    )
  })

  it('touches vue importers for standalone wxs sidecars', async () => {
    const ctx = createContext()

    await invalidateEntryForSidecar(ctx, '/project/src/shared/helper.wxs', 'update')

    expect(touchMock).toHaveBeenCalledWith('/project/src/pages/dashboard/index.vue')
    expect(findJsEntryMock).not.toHaveBeenCalledWith('/project/src/shared/helper')
  })
})
