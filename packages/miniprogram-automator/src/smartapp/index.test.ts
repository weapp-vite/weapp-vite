/**
 * @file 百度智能小程序 TypeScript runtime 测试。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SmartappUnsupportedError } from './errors'
import { SmartappAutomator } from './index'

const connectionCreate = vi.hoisted(() => vi.fn())

vi.mock('../Connection', () => ({
  default: {
    create: connectionCreate,
  },
}))

describe('SmartappAutomator TypeScript runtime', () => {
  beforeEach(() => {
    connectionCreate.mockReset()
  })

  it('reports the devtools simulator as a lightweight device target', async () => {
    await expect(SmartappAutomator.devices('simulator')).resolves.toEqual({
      devtools: { status: 0 },
    })
  })

  it('launches a simulator device without loading vendored drivers', async () => {
    const device = await SmartappAutomator.launch({
      deviceType: 'simulator',
    })

    expect(device.type).toBe('devtools')
    expect(device.connectType).toBe('usb')
    await expect(device.close()).resolves.toBeUndefined()
  })

  it('keeps unsupported native device actions explicit', async () => {
    const device = await SmartappAutomator.launch({
      deviceType: 'android',
      connectType: 'usb',
    })

    await expect(device.tap()).rejects.toBeInstanceOf(SmartappUnsupportedError)
  })

  it('connects an existing smartapp devtools websocket session', async () => {
    connectionCreate.mockResolvedValue({
      close: vi.fn(),
      off: vi.fn(),
      on: vi.fn(),
      send: vi.fn(),
    })

    const device = await SmartappAutomator.connect({
      wsEndpoint: 'ws://127.0.0.1:9420',
    })

    expect(connectionCreate).toHaveBeenCalledWith('ws://127.0.0.1:9420')
    expect(device.type).toBe('devtools')
  })
})
