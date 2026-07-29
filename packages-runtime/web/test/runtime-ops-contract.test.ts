import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  hideKeyboardBridge,
  nextTickBridge,
  pageScrollToBridge,
} from '../src/runtime/polyfill/runtimeOps'

const routeScroll = vi.hoisted(() => ({
  getPageContainer: vi.fn(),
  recordActiveEntryScrollPosition: vi.fn(),
}))

vi.mock('../src/runtime/polyfill/routeRuntime/scroll', () => routeScroll)

describe('runtime operation adapter contract', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('ignores invalid nextTick callbacks and schedules valid callbacks', async () => {
    expect(nextTickBridge()).toBeUndefined()
    expect(nextTickBridge('invalid' as any)).toBeUndefined()
    const callback = vi.fn()
    nextTickBridge(callback)
    expect(callback).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('hides keyboards across missing and partial document capabilities', async () => {
    vi.stubGlobal('document', undefined)
    await expect(hideKeyboardBridge()).resolves.toMatchObject({ errMsg: 'hideKeyboard:ok' })
    vi.stubGlobal('document', { activeElement: null })
    await hideKeyboardBridge()
    vi.stubGlobal('document', { activeElement: {} })
    await hideKeyboardBridge()

    const blur = vi.fn()
    vi.stubGlobal('document', { activeElement: { blur } })
    await hideKeyboardBridge()
    expect(blur).toHaveBeenCalledTimes(1)
  })

  it('scrolls the page container immediately and normalizes invalid offsets', async () => {
    const container = { scrollTop: 100 }
    routeScroll.getPageContainer.mockReturnValue(container)

    await expect(pageScrollToBridge({ duration: 0, scrollTop: Number.NaN })).resolves.toMatchObject({
      errMsg: 'pageScrollTo:ok',
    })
    expect(container.scrollTop).toBe(0)
    expect(routeScroll.recordActiveEntryScrollPosition).toHaveBeenCalledTimes(1)

    await pageScrollToBridge({ duration: -1, scrollTop: -20 })
    expect(container.scrollTop).toBe(0)
  })

  it('uses window scrolling after a positive duration and tolerates missing windows', async () => {
    vi.useFakeTimers()
    routeScroll.getPageContainer.mockReturnValue(undefined)
    const scrollTo = vi.fn()
    vi.stubGlobal('window', { scrollTo })

    const result = pageScrollToBridge({ duration: 25, scrollTop: 80 })
    expect(scrollTo).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(25)
    await expect(result).resolves.toMatchObject({ errMsg: 'pageScrollTo:ok' })
    expect(scrollTo).toHaveBeenCalledWith(0, 80)

    vi.stubGlobal('window', {})
    await pageScrollToBridge({ duration: 0, scrollTop: 10 })
    vi.stubGlobal('window', undefined)
    await pageScrollToBridge({ duration: 0, scrollTop: 10 })
  })
})
