import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { claimSidecarDelivery } from '../../../runtime/watch/sidecarDelivery'

import { invalidateEntryForSidecar } from './sidecar'

const touchMock = vi.hoisted(() => vi.fn(async () => {}))
const invalidateFileCacheMock = vi.hoisted(() => vi.fn<(file: string) => void>())
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

vi.mock('../cache', () => ({
  invalidateFileCache: invalidateFileCacheMock,
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
    runtimeState: {
      css: {
        transformedSidecarSource: new Map<string, { code: string, diskSource: string }>(),
        sidecarImports: new Set<string>(),
      },
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

  afterEach(() => {
    vi.restoreAllMocks()
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

  it.each(['update', 'delete'] as const)('drops cached CSS sidecar source when the file receives a %s event', async (event) => {
    const ctx = createContext()
    ctx.runtimeState.css.transformedSidecarSource.set('/project/src/shared/theme.css', {
      code: '.theme {}',
      diskSource: '.theme {}',
    })

    await invalidateEntryForSidecar(ctx, '/project/src/shared/theme.css', event)

    expect(ctx.runtimeState.css.transformedSidecarSource.has('/project/src/shared/theme.css')).toBe(false)
    expect(invalidateFileCacheMock).toHaveBeenCalledWith('/project/src/shared/theme.css')
  })

  it('invalidates reads before triggering the owner without mutating scan-owned style registration', async () => {
    const ctx = createContext()
    const style = '/project/src/pages/hmr/index.wxss'
    const owner = '/project/src/pages/hmr/index.ts'
    const otherStyle = '/project/src/components/counter/index.wxss'
    ctx.runtimeState.css.sidecarImports.add(style)
    ctx.runtimeState.css.sidecarImports.add(otherStyle)
    ctx.runtimeState.css.transformedSidecarSource.set(style, { code: '.compiled {}', diskSource: '.original {}' })
    findJsEntryMock.mockResolvedValueOnce({ path: owner, predictions: [owner] })
    let beforeTouch: { registered: boolean, transformed: boolean, invalidated: boolean } | undefined
    touchMock.mockImplementationOnce(async () => {
      beforeTouch = {
        registered: ctx.runtimeState.css.sidecarImports.has(style),
        transformed: ctx.runtimeState.css.transformedSidecarSource.has(style),
        invalidated: invalidateFileCacheMock.mock.calls.some(([file]) => file === style),
      }
    })

    await invalidateEntryForSidecar(ctx, style, 'delete')

    expect(beforeTouch).toEqual({ registered: true, transformed: false, invalidated: true })
    expect(touchMock).toHaveBeenCalledWith(owner)
    expect(ctx.runtimeState.css.sidecarImports.has(style)).toBe(true)
    expect(ctx.runtimeState.css.sidecarImports.has(otherStyle)).toBe(true)
  })

  it.each(['create', 'delete', 'update'] as const)('keeps cache invalidation but avoids synthetic script delivery for an owned %s', async (event) => {
    const ctx = createContext()
    const style = '/project/src/pages/hmr/index.wxss'
    ctx.runtimeState.css.transformedSidecarSource.set(style, { code: '.old {}', diskSource: '.old {}' })
    findJsEntryMock.mockResolvedValueOnce({ path: '/project/src/pages/hmr/index.ts', predictions: [] })
    const release = claimSidecarDelivery(ctx, file => file === style)
    try {
      await invalidateEntryForSidecar(ctx, style, event)
      expect(touchMock).not.toHaveBeenCalled()
      expect(invalidateFileCacheMock).toHaveBeenCalledWith(style)
      expect(ctx.runtimeState.css.transformedSidecarSource.has(style)).toBe(false)
      expect(loggerMock.success).not.toHaveBeenCalled()
    }
    finally {
      release()
    }
  })

  it('rechecks the active owner after asynchronous sidecar discovery', async () => {
    const ctx = createContext()
    const entry = Promise.withResolvers<{ path: undefined, predictions: string[] }>()
    findJsEntryMock.mockReturnValueOnce(entry.promise)
    collectAffectedScriptsAndImportersMock.mockResolvedValueOnce({ importers: new Set(), scripts: new Set(['/project/src/page.ts']) })
    const changing = invalidateEntryForSidecar(ctx, '/project/src/shared/theme.css', 'delete')
    const release = claimSidecarDelivery(ctx, () => true)
    try {
      entry.resolve({ path: undefined, predictions: [] })
      await changing
      expect(collectAffectedScriptsAndImportersMock).toHaveBeenCalled()
      expect(touchMock).not.toHaveBeenCalled()
    }
    finally {
      release()
    }
  })

  it('keeps fallback when an asynchronous discovery outlives a scope replacement', async () => {
    const ctx = createContext()
    const entry = Promise.withResolvers<{ path: undefined, predictions: string[] }>()
    findJsEntryMock.mockReturnValueOnce(entry.promise)
    collectAffectedScriptsAndImportersMock.mockResolvedValueOnce({ importers: new Set(), scripts: new Set(['/project/src/page.ts']) })
    const previous = claimSidecarDelivery(ctx, file => file.startsWith('/project/src/'))
    const changing = invalidateEntryForSidecar(ctx, '/external/theme.css', 'delete')
    const current = claimSidecarDelivery(ctx, file => file.startsWith('/project/src/'))
    previous()
    try {
      entry.resolve({ path: undefined, predictions: [] })
      await changing
      expect(touchMock).toHaveBeenCalledWith('/project/src/page.ts')
    }
    finally {
      current()
    }
  })

  it('does not revive synthetic delivery after its original generation closes', async () => {
    const ctx = createContext()
    const entry = Promise.withResolvers<{ path: undefined, predictions: string[] }>()
    findJsEntryMock.mockReturnValueOnce(entry.promise)
    collectAffectedScriptsAndImportersMock.mockResolvedValueOnce({ importers: new Set(), scripts: new Set(['/project/src/page.ts']) })
    const release = claimSidecarDelivery(ctx, () => true)
    const changing = invalidateEntryForSidecar(ctx, '/project/src/shared/theme.css', 'delete')
    release()
    entry.resolve({ path: undefined, predictions: [] })
    await changing
    expect(touchMock).not.toHaveBeenCalled()
  })
})
