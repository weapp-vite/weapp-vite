import { WEVU_WEB_APIS_NETWORK_DEFAULTS_KEY } from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'

function clearNetworkDefaults() {
  delete (globalThis as Record<string, unknown>)[WEVU_WEB_APIS_NETWORK_DEFAULTS_KEY]
}

describe('mini-program network defaults', () => {
  afterEach(() => {
    clearNetworkDefaults()
    vi.resetModules()
  })

  it('shares defaults across independently loaded runtime modules', async () => {
    const firstRuntime = await import('./networkDefaults')
    firstRuntime.setMiniProgramNetworkDefaults({
      request: {
        enableChunked: true,
        timeout: 4_800,
      },
    })

    vi.resetModules()
    const secondRuntime = await import('./networkDefaults')

    expect(secondRuntime.resolveRequestMiniProgramOptions()).toEqual({
      enableChunked: true,
      timeout: 4_800,
    })

    secondRuntime.resetMiniProgramNetworkDefaults()
    expect(firstRuntime.getMiniProgramNetworkDefaults()).toEqual({
      request: {},
      socket: {},
    })
  })
})
