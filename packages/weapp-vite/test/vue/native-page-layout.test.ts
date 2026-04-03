import { afterEach, describe, expect, it, vi } from 'vitest'
import { setPageLayout } from '../../src/plugins/vue/nativePageLayout'

describe('native page layout runtime', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls the current native page layout setter', () => {
    const pageSetter = vi.fn()
    vi.stubGlobal('getCurrentPages', () => [
      {
        __wevuSetPageLayout: pageSetter,
      },
    ])

    setPageLayout('admin', {
      title: 'Issue 389',
    })

    expect(pageSetter).toHaveBeenCalledWith('admin', {
      title: 'Issue 389',
    })
  })

  it('supports disabling layout on the current native page', () => {
    const pageSetter = vi.fn()
    vi.stubGlobal('getCurrentPages', () => [
      {
        __wevuSetPageLayout: pageSetter,
      },
    ])

    setPageLayout(false)

    expect(pageSetter).toHaveBeenCalledWith(false, undefined)
  })

  it('throws when no native page setter is available', () => {
    vi.stubGlobal('getCurrentPages', () => [])

    expect(() => setPageLayout('default')).toThrowError(
      'setPageLayout() 未找到当前页面实例。请在页面生命周期、事件回调或当前页面上下文中调用。',
    )
  })
})
