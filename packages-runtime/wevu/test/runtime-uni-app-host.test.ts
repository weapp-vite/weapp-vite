import { describe, expect, it, vi } from 'vitest'
import { createUniAppHost } from '@/runtime/uniAppHost'

describe('uni-app host compatibility', () => {
  it('inherits native APIs and fills locale, safe area insets and rpx conversion', () => {
    const navigateTo = vi.fn()
    const host = {
      getAppBaseInfo: () => ({ language: 'zh_TW' }),
      getSystemInfoSync: () => ({
        language: 'zh_CN',
        safeArea: { bottom: 780, left: 0, right: 390, top: 44 },
        screenHeight: 844,
        screenWidth: 390,
        windowHeight: 800,
        windowWidth: 390,
      }),
      getWindowInfo: () => ({
        safeArea: { bottom: 780, left: 0, right: 390, top: 44 },
        screenHeight: 844,
        screenWidth: 390,
        windowHeight: 800,
        windowWidth: 390,
      }),
      navigateTo,
    }

    const uni = createUniAppHost(host)

    expect(uni.navigateTo).toBe(navigateTo)
    expect(uni.getLocale()).toBe('zh-Hant')
    expect(uni.getSystemInfoSync().safeAreaInsets).toEqual({
      bottom: 64,
      left: 0,
      right: 0,
      top: 44,
    })
    expect(uni.getWindowInfo().safeAreaInsets.bottom).toBe(64)
    expect(uni.rpx2px(100)).toBe(52)
  })

  it('shares event listeners across independently created host adapters', () => {
    const first = createUniAppHost({})
    const second = createUniAppHost({})
    const persistent = vi.fn()
    const once = vi.fn()

    first.$on('change', persistent)
    first.$once('change', once)
    second.$emit('change', 1)
    second.$emit('change', 2)

    expect(persistent).toHaveBeenCalledTimes(2)
    expect(once).toHaveBeenCalledOnce()
    first.$off('change', persistent)
    second.$emit('change', 3)
    expect(persistent).toHaveBeenCalledTimes(2)
  })

  it('reuses one adapter so library extensions remain visible across modules', () => {
    const host = {}
    const first = createUniAppHost(host)
    first.$u = { color: { mainColor: '#303133' } }

    const second = createUniAppHost(host)

    expect(second).toBe(first)
    expect(second.$u.color.mainColor).toBe('#303133')
  })
})
