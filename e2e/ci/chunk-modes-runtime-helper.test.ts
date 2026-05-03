import { describe, expect, it, vi } from 'vitest'
import {
  chunkExtraCases,
  chunkMatrixCases,
  selectIdeRuntimeChunkExtraCases,
  selectIdeRuntimeChunkMatrixCases,
} from '../chunk-modes.matrix'
import { relaunchPage } from '../ide/chunk-modes.runtime.shared'

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, reject, resolve }
}

function createMockPage(path = 'pages/index/index') {
  return {
    path,
    $: vi.fn(async () => ({
      wxml: vi.fn(async () => '<page>shared chunk modes</page>'),
    })),
    waitFor: vi.fn(async () => {}),
  }
}

describe('chunk-modes runtime helper', () => {
  it('keeps the IDE runtime matrix to representative smoke cases', () => {
    expect(selectIdeRuntimeChunkMatrixCases(chunkMatrixCases).map(item => item.id)).toEqual([
      'duplicate-common-none-preserve',
      'duplicate-inline-mixed-inline',
      'hoist-common-mixed-inline',
    ])
    expect(selectIdeRuntimeChunkExtraCases(chunkExtraCases).map(item => item.id)).toEqual([
      'path-root-shared',
    ])
  })

  it('uses the already booted target page before calling relaunch', async () => {
    const page = createMockPage()
    const miniProgram = {
      currentPage: vi.fn(async () => page),
      reLaunch: vi.fn(),
    }

    await expect(relaunchPage(miniProgram, '/pages/index/index', 'shared chunk modes', 5)).resolves.toBe(page)
    expect(miniProgram.reLaunch).not.toHaveBeenCalled()
  })

  it('forces relaunch without reusing a potentially stale current page', async () => {
    const page = createMockPage()
    const miniProgram = {
      currentPage: vi.fn(async () => page),
      reLaunch: vi.fn(async () => page),
    }

    await expect(relaunchPage(miniProgram, '/pages/index/index', 'shared chunk modes', 5, {
      forceRelaunch: true,
    })).resolves.toBe(page)
    expect(miniProgram.reLaunch).toHaveBeenCalledWith('/pages/index/index')
    expect(miniProgram.reLaunch.mock.invocationCallOrder[0]).toBeLessThan(
      miniProgram.currentPage.mock.invocationCallOrder[0]!,
    )
  })

  it('returns null instead of relaunching when current-page-only startup is not ready', async () => {
    const page = createMockPage('pages/other/index')
    const miniProgram = {
      currentPage: vi.fn(async () => page),
      reLaunch: vi.fn(),
    }

    await expect(relaunchPage(miniProgram, '/pages/index/index', 'shared chunk modes', 5, {
      currentPageOnly: true,
    })).resolves.toBeNull()
    expect(miniProgram.reLaunch).not.toHaveBeenCalled()
  })

  it('waits for the patched reLaunch instead of starting a background retry', async () => {
    const page = createMockPage('packageA/pages/foo')
    const deferred = createDeferred<typeof page>()
    const miniProgram = {
      currentPage: vi.fn(async () => ({ ...page, path: 'pages/other/index' })),
      reLaunch: vi.fn(async () => deferred.promise),
    }

    const relaunchPromise = relaunchPage(miniProgram, '/packageA/pages/foo', 'shared chunk modes', 5)
    await new Promise(resolve => setTimeout(resolve, 320))

    expect(miniProgram.reLaunch).toHaveBeenCalledTimes(1)

    deferred.resolve(page)

    await expect(relaunchPromise).resolves.toBe(page)
    expect(miniProgram.currentPage).toHaveBeenCalled()
  })

  it('returns null after a session-fatal relaunch error so the caller can reopen devtools', async () => {
    const miniProgram = {
      currentPage: vi.fn(),
      reLaunch: vi.fn(async () => {
        throw new Error('Timeout in raw reLaunch /pages/index/index after 30000ms')
      }),
    }

    await expect(relaunchPage(miniProgram, '/packageA/pages/foo', 'shared chunk modes', 5)).resolves.toBeNull()
    expect(miniProgram.reLaunch).toHaveBeenCalledTimes(1)
  })
})
