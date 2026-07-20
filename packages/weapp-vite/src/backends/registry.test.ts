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
})
