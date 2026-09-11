import type {
  WechatNetworkStatusResult,
  WechatNetworkTypeResult,
  WechatQueryHost,
} from './wechat'
import { describe, expect, it, vi } from 'vitest'
import { createWechatQueryHost } from './wechat'

interface NativeGeneralCallbackResult {
  readonly errMsg: string
}

interface NativeWechatQueryHost extends Omit<WechatQueryHost, 'offNetworkStatusChange'> {
  offNetworkStatusChange: (
    listener?: (result: NativeGeneralCallbackResult) => void,
  ) => void
}

function createHostFixture() {
  let initialSuccess: ((result: WechatNetworkTypeResult) => void) | undefined
  let networkListener: ((result: WechatNetworkStatusResult) => void) | undefined
  let showListener: (() => void) | undefined
  let hideListener: (() => void) | undefined
  const host: NativeWechatQueryHost = {
    getNetworkType: vi.fn((options) => {
      initialSuccess = options.success
    }),
    onNetworkStatusChange: vi.fn((listener) => {
      networkListener = listener
    }),
    offNetworkStatusChange: vi.fn(),
    onAppShow: vi.fn((listener) => {
      showListener = listener
    }),
    offAppShow: vi.fn(),
    onAppHide: vi.fn((listener) => {
      hideListener = listener
    }),
    offAppHide: vi.fn(),
  }
  return {
    host,
    getInitialSuccess: () => initialSuccess,
    getNetworkListener: () => networkListener,
    getShowListener: () => showListener,
    getHideListener: () => hideListener,
  }
}

describe('createWechatQueryHost', () => {
  it('delivers the initial network snapshot', () => {
    const fixture = createHostFixture()
    const queryHost = createWechatQueryHost(fixture.host)
    const states: boolean[] = []
    const unsubscribe = queryHost.subscribeOnline(online => states.push(online))

    fixture.getInitialSuccess()?.({ networkType: 'none' })
    expect(states).toEqual([false])

    unsubscribe()
    fixture.getInitialSuccess()?.({ networkType: 'wifi' })
    expect(states).toEqual([false])
  })

  it('drops a stale initial network snapshot after a newer event', () => {
    const fixture = createHostFixture()
    const queryHost = createWechatQueryHost(fixture.host)
    const states: boolean[] = []
    const unsubscribe = queryHost.subscribeOnline(online => states.push(online))
    const networkListener = fixture.getNetworkListener()
    const initialSuccess = fixture.getInitialSuccess()

    expect(networkListener).toBeTypeOf('function')
    expect(initialSuccess).toBeTypeOf('function')
    networkListener?.({ isConnected: false, networkType: 'none' })
    initialSuccess?.({ networkType: 'wifi' })

    expect(states).toEqual([false])
    unsubscribe()
    unsubscribe()
    expect(fixture.host.offNetworkStatusChange).toHaveBeenCalledOnce()
    expect(fixture.host.offNetworkStatusChange).toHaveBeenCalledWith(networkListener)

    networkListener?.({ isConnected: true, networkType: 'wifi' })
    expect(states).toEqual([false])
  })

  it('forwards app visibility and releases both listeners', () => {
    const fixture = createHostFixture()
    const queryHost = createWechatQueryHost(fixture.host)
    const states: boolean[] = []
    const unsubscribe = queryHost.subscribeForeground(foreground => states.push(foreground))
    const showListener = fixture.getShowListener()
    const hideListener = fixture.getHideListener()

    showListener?.()
    hideListener?.()
    showListener?.()
    expect(states).toEqual([true, false, true])

    unsubscribe()
    expect(fixture.host.offAppShow).toHaveBeenCalledWith(showListener)
    expect(fixture.host.offAppHide).toHaveBeenCalledWith(hideListener)
    hideListener?.()
    expect(states).toEqual([true, false, true])
  })
})
