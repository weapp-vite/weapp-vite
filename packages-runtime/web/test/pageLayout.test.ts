import { describe, expect, it, vi } from 'vitest'
import { setPageLayout } from '../src/runtime/pageLayout'

const getCurrentPageInstance = vi.hoisted(() => vi.fn())

vi.mock('../src/runtime/polyfill/routeRuntime', () => ({
  getCurrentPageInstance,
}))

describe('setPageLayout', () => {
  it('delegates to the current page layout setter', () => {
    const setter = vi.fn()
    getCurrentPageInstance.mockReturnValue({
      __wevuSetPageLayout: setter,
    })

    setPageLayout('compact', { title: '商品' })

    expect(setter).toHaveBeenCalledWith('compact', { title: '商品' })
  })

  it('throws when called outside a page context', () => {
    getCurrentPageInstance.mockReturnValue(undefined)
    expect(() => setPageLayout(false)).toThrow('未找到当前 Web 页面实例')
  })

  it('throws when a page does not expose the setter', () => {
    getCurrentPageInstance.mockReturnValue({})
    expect(() => setPageLayout('default')).toThrow('未找到当前 Web 页面实例')
  })
})
