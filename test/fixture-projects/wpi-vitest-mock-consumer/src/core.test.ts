import { api, createApi, wpi } from '@weapp-core/api'
import { apiMock, wpiMock } from '@weapp-core/api/vitest'
import { describe, expect, it, vi } from 'vitest'

const unrelatedMock = vi.fn()
unrelatedMock()

describe('@weapp-core/api Vitest setup', () => {
  it('replaces only the API singletons before static imports run', () => {
    expect(api).toBe(apiMock)
    expect(wpi).toBe(wpiMock)
    expect(typeof createApi).toBe('function')

    wpiMock.showToast({ title: 'core' })
    expect(wpiMock.showToast).toHaveBeenCalledOnce()
  })

  it('resets its own mocks without clearing unrelated Vitest mocks', () => {
    expect(wpiMock.showToast).not.toHaveBeenCalled()
    expect(unrelatedMock).toHaveBeenCalledOnce()
  })
})
