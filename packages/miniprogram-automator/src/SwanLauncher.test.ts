/**
 * @file 百度智能小程序启动器测试。
 */
import { describe, expect, it, vi } from 'vitest'
import SwanLauncher, { toSmartappLaunchOptions } from './SwanLauncher'

describe('SwanLauncher', () => {
  it('delegates direct connection when the smartapp runtime exposes connect', async () => {
    const connect = vi.fn(async (options: unknown) => ({ provider: 'smartapp', options }))
    const launcher = new SwanLauncher({
      launch: vi.fn(),
      connect,
    })

    await expect(launcher.connect({
      wsEndpoint: 'ws://127.0.0.1:8888',
    })).resolves.toEqual({
      provider: 'smartapp',
      options: {
        wsEndpoint: 'ws://127.0.0.1:8888',
      },
    })
  })

  it('launches devtools through the TypeScript smartapp runtime', async () => {
    const launch = vi.fn(async (options: unknown) => ({ provider: 'smartapp', options }))
    const launcher = new SwanLauncher({ launch })

    await expect(launcher.launch({
      cliPath: '/Applications/swan-ide/cli',
      projectPath: '/tmp/swan-project',
    })).resolves.toEqual({
      provider: 'smartapp',
      options: {
        deviceType: 'simulator',
        devtoolsPath: '/Applications/swan-ide/cli',
        projectPath: '/tmp/swan-project',
      },
    })

    expect(launch).toHaveBeenCalledWith({
      deviceType: 'simulator',
      devtoolsPath: '/Applications/swan-ide/cli',
      projectPath: '/tmp/swan-project',
    })
  })

  it('keeps explicit smartapp launch options when provided', () => {
    expect(toSmartappLaunchOptions({
      platform: 'baidu',
      projectPath: '/tmp/swan-project',
      deviceType: 'android',
      connectType: 'usb',
    } as any)).toEqual({
      connectType: 'usb',
      deviceType: 'android',
      projectPath: '/tmp/swan-project',
    })
  })
})
