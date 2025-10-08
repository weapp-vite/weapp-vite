import { beforeEach, describe, expect, it, vi } from 'vitest'

import { invalidateEntryForSidecar } from '@/plugins/utils/invalidateEntry'
import { findJsEntry, touch } from '@/utils/file'

vi.mock('@/utils/file', async () => {
  const actual = await vi.importActual<any>('@/utils/file')
  return {
    ...actual,
    findJsEntry: vi.fn(),
    touch: vi.fn(),
  }
})

describe('invalidateEntryForSidecar', () => {
  const findJsEntryMock = vi.mocked(findJsEntry)
  const touchMock = vi.mocked(touch)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('invalidates related script when json.ts sidecar is created', async () => {
    findJsEntryMock.mockResolvedValueOnce({
      path: '/project/src/pages/index/index.ts',
      predictions: [],
    })

    await invalidateEntryForSidecar('/project/src/pages/index/index.json.ts')

    expect(findJsEntryMock).toHaveBeenCalledWith('/project/src/pages/index/index')
    expect(touchMock).toHaveBeenCalledWith('/project/src/pages/index/index.ts')
  })

  it('invalidates related script when wxss sidecar is created', async () => {
    findJsEntryMock.mockResolvedValueOnce({
      path: '/project/src/pages/index/index.js',
      predictions: [],
    })

    await invalidateEntryForSidecar('/project/src/pages/index/index.wxss')

    expect(findJsEntryMock).toHaveBeenCalledWith('/project/src/pages/index/index')
    expect(touchMock).toHaveBeenCalledWith('/project/src/pages/index/index.js')
  })

  it('does nothing when no script entry is found', async () => {
    findJsEntryMock.mockResolvedValueOnce({
      predictions: [],
    })

    await invalidateEntryForSidecar('/project/src/pages/index/index.json')

    expect(touchMock).not.toHaveBeenCalled()
  })
})
