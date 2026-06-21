import { describe, expect, it } from 'vitest'
import { createMiniProgramLayoutHostRegistry, normalizeMiniProgramLayoutHostKeys } from './layoutHostRegistry'

describe('layout host registry', () => {
  it('normalizes layout host keys', () => {
    expect(normalizeMiniProgramLayoutHostKeys(['toast', '', 'toast', 'dialog'])).toEqual(['toast', 'dialog'])
    expect(normalizeMiniProgramLayoutHostKeys('toast')).toEqual(['toast'])
  })

  it('registers and resolves host bridges by page identity keys', () => {
    const registry = createMiniProgramLayoutHostRegistry<{ host: string }>()
    const bridge = { host: 'toast' }

    expect(registry.register('layout-toast', bridge, ['route:pages/index/index'])).toEqual(['layout-toast'])
    expect(registry.resolveBridge('layout-toast', ['route:pages/index/index'])).toBe(bridge)
    expect(registry.resolveHost('layout-toast', ['route:pages/index/index'], current => current.host)).toBe('toast')
  })

  it('unregisters a bridge from all page registries', () => {
    const registry = createMiniProgramLayoutHostRegistry<{ host: string }>()
    const bridge = { host: 'toast' }

    registry.register(['layout-toast', 'layout-message'], bridge, ['route:pages/index/index'])

    expect(registry.unregisterBridge(bridge)).toBe(true)
    expect(registry.resolveBridge('layout-toast', ['route:pages/index/index'])).toBeUndefined()
    expect(registry.resolveBridge('layout-message', ['route:pages/index/index'])).toBeUndefined()
  })

  it('waits for a host registered after first lookup', async () => {
    const registry = createMiniProgramLayoutHostRegistry<{ host: string }>()
    const bridge = { host: 'toast' }

    setTimeout(() => {
      registry.register('layout-toast', bridge, ['route:pages/index/index'])
    }, 0)

    await expect(registry.waitForHost(
      'layout-toast',
      () => ['route:pages/index/index'],
      current => current.host,
      {
        interval: 1,
        retries: 5,
      },
    )).resolves.toBe('toast')
  })
})
