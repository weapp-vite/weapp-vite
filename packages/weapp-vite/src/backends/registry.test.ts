import type { PlatformBackend } from './types'
import { describe, expect, it, vi } from 'vitest'
import { resolveBackendExecution } from '.'
import { PlatformBackendRegistry } from './registry'

function createBackend(id: string, aliases: readonly string[] = []): PlatformBackend {
  return {
    descriptor: {
      id,
      aliases,
      runtime: id === 'web' ? 'web' : 'miniprogram',
      capabilities: {
        build: true,
        dev: true,
        ide: id !== 'web',
        analyze: true,
        npm: id !== 'web',
        workers: id !== 'web',
        lib: id !== 'web',
      },
    },
    driver: {
      createInlineConfig: () => undefined,
      mergeConfig: () => undefined,
      build: vi.fn(),
      dev: vi.fn(),
      close: vi.fn(),
    },
  }
}

describe('platform backend registry', () => {
  it('rejects duplicate backend ids and aliases', () => {
    const registry = new PlatformBackendRegistry()
    registry.register(createBackend('mini', ['wx']))

    expect(() => registry.register(createBackend('mini'))).toThrow('平台后端 id "mini" 已注册。')
    expect(() => registry.register(createBackend('other', ['WX']))).toThrow('平台后端别名 "wx" 已由 "mini" 注册。')
    expect(() => registry.register(createBackend('reserved', ['both']))).toThrow('平台后端别名 "both" 为保留目标。')
  })

  it('rejects empty ids while ignoring empty and repeated aliases', () => {
    const registry = new PlatformBackendRegistry()
    expect(() => registry.register(createBackend(' '))).toThrow('平台后端 id 不能为空')
    expect(() => registry.register(createBackend('mini', ['', 'wx', 'WX']))).not.toThrow()
    expect(registry.get(' MINI ')).toBeDefined()
    expect(registry.getExecutionOrder()).toHaveLength(1)
    expect(registry.getExecutionOrder('ide')).toHaveLength(1)
    expect(registry.getExecutionOrder('npm')).toHaveLength(1)
  })

  it('resolves shared mini-program aliases without duplicating platform data', () => {
    const execution = resolveBackendExecution('douyin')

    expect(execution.kind).toBe('miniprogram')
    expect(execution.get('miniprogram')?.platform).toBe('tt')
    expect(execution.label).toBe('tt')
  })

  it('uses config-driven miniprogram as the default target', () => {
    const execution = resolveBackendExecution()

    expect(execution.label).toBe('config')
    expect(execution.entries.map(entry => entry.descriptor.id)).toEqual(['miniprogram'])
    expect(execution.get('miniprogram')?.platform).toBeUndefined()
  })

  it.each(['all', 'both'])('selects all backends in registration order for %s', (target) => {
    const execution = resolveBackendExecution(target)

    expect(execution.kind).toBe('all')
    expect(execution.entries.map(entry => entry.descriptor.id)).toEqual(['miniprogram', 'web'])
    expect(execution.select('build').map(entry => entry.descriptor.id)).toEqual(['miniprogram', 'web'])
  })

  it('exposes declarative capabilities for backend filtering', () => {
    const execution = resolveBackendExecution('all')

    expect(execution.has('build')).toBe(true)
    expect(execution.select('ide').map(entry => entry.descriptor.id)).toEqual(['miniprogram'])
    expect(execution.select('npm').map(entry => entry.descriptor.id)).toEqual(['miniprogram'])
    expect(execution.select('workers').map(entry => entry.descriptor.id)).toEqual(['miniprogram'])
    expect(execution.select('lib').map(entry => entry.descriptor.id)).toEqual(['miniprogram'])
    expect(execution.get('missing')).toBeUndefined()
    expect(execution.has('workers')).toBe(true)
  })

  it('falls back to the configured default platform for unknown input', () => {
    const warn = vi.fn()
    const execution = resolveBackendExecution('unknown', {
      fallbackMiniPlatform: 'alipay',
      warn,
    })

    expect(execution.get('miniprogram')?.platform).toBe('alipay')
    expect(warn).toHaveBeenCalledWith('未识别的平台 "unknown"，已回退到 alipay')
  })

  it('reports a missing fallback backend and supports runtime-only fallback labels', () => {
    const registry = new PlatformBackendRegistry()
    registry.register(createBackend('mini', ['wx']))
    expect(() => registry.resolve('wx', { fallbackBackendId: 'missing' })).toThrow('默认平台后端 "missing" 未注册')

    const fallback = registry.resolve('unknown', { fallbackBackendId: 'mini' })
    expect(fallback.label).toBe('miniprogram')
    expect(fallback.entries[0]?.platform).toBeUndefined()
    expect(registry.resolve(null, { fallbackBackendId: 'mini' }).raw).toBeUndefined()
  })

  it('resolves combined and aliased backends without optional platform resolvers', () => {
    const registry = new PlatformBackendRegistry()
    registry.register(createBackend('mini', ['wx']))
    registry.register(createBackend('web', ['h5']))

    const combined = registry.resolve('both', { fallbackBackendId: 'mini' })
    expect(combined.entries).toHaveLength(2)
    expect(combined.entries[1]?.platform).toBeUndefined()
    const web = registry.resolve(' H5 ', { fallbackBackendId: 'mini' })
    expect(web.kind).toBe('web')
    expect(web.label).toBe('web')
  })

  it('uses resolver fallbacks for combined and direct backend targets', () => {
    const registry = new PlatformBackendRegistry()
    const mini = createBackend('mini', ['wx'])
    const web = createBackend('web')
    mini.driver.resolvePlatformAlias = vi.fn(() => undefined)
    web.driver.resolvePlatformAlias = vi.fn(input => input === 'web' ? 'web' : undefined)
    registry.register(mini)
    registry.register(web)

    const combined = registry.resolve('all', { fallbackBackendId: 'mini' })
    expect(combined.entries[1]?.platform).toBe('web')
    const direct = registry.resolve('web', { fallbackBackendId: 'mini' })
    expect(direct.label).toBe('web')
  })
})
