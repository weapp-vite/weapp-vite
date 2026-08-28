import { describe, expect, it, vi } from 'vitest'
import {
  apiMock,
  createApiMock,
  createWpiMock,
  resetApiMock,
  wpiMock,
} from './index'

describe('api Vitest mock', () => {
  it('creates method mocks lazily and keeps stable references', () => {
    const mock = createApiMock()

    expect(Reflect.ownKeys(mock)).toEqual([])
    expect(mock.request).toBe(mock.request)
    expect(vi.isMockFunction(mock.request)).toBe(true)
    expect(mock.request.getMockName()).toBe('api.request')
    expect(Reflect.ownKeys(mock)).toEqual(['request'])
    expect(Reflect.get(mock, 'then')).toBeUndefined()
  })

  it('keeps factories isolated and resets only the selected mock', () => {
    const first = createApiMock()
    const second = createApiMock()
    const unrelated = vi.fn()

    first.showToast({ title: 'first' })
    second.showToast({ title: 'second' })
    unrelated()
    resetApiMock(first)

    expect(first.showToast).not.toHaveBeenCalled()
    expect(second.showToast).toHaveBeenCalledOnce()
    expect(unrelated).toHaveBeenCalledOnce()
  })

  it('wraps method overrides and preserves non-function overrides', () => {
    const requestTask = { abort: vi.fn() }
    const mock = createApiMock({
      platform: 'wx',
      request: () => requestTask as any,
    })

    expect(mock.platform).toBe('wx')
    expect(vi.isMockFunction(mock.request)).toBe(true)
    expect(mock.request({ url: 'https://example.com' })).toBe(requestTask)

    resetApiMock(mock)
    expect(mock.request({ url: 'https://example.com' })).toBe(requestTask)
  })

  it('shares the documented compatibility aliases', () => {
    expect(wpiMock).toBe(apiMock)
    expect(createWpiMock).toBe(createApiMock)
  })

  it('supports custom adapter methods without mocking value members', () => {
    interface CustomAdapter {
      readSync: (key: string) => number
    }

    const lazyMock = createApiMock<CustomAdapter>()
    const overrideMock = createApiMock<CustomAdapter>({
      readSync: key => key.length,
    })

    expect(vi.isMockFunction(lazyMock.readSync)).toBe(true)
    expect(vi.isMockFunction(overrideMock.readSync)).toBe(true)
    expect(overrideMock.readSync('token')).toBe(5)
    expect(lazyMock.platform).toBeUndefined()
    expect(lazyMock.raw).toBeUndefined()
  })
})
