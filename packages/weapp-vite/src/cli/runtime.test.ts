import { describe, expect, it, vi } from 'vitest'
import { createInlineConfig, resolveRuntimeTargets } from './runtime'

const loggerInfoMock = vi.hoisted(() => vi.fn())
const loggerWarnMock = vi.hoisted(() => vi.fn())
const colorsMock = vi.hoisted(() => ({
  bold: vi.fn((value: string) => value),
  green: vi.fn((value: string) => value),
  yellow: vi.fn((value: string) => value),
}))

vi.mock('../logger', () => ({
  default: {
    info: loggerInfoMock,
    warn: loggerWarnMock,
  },
  colors: colorsMock,
}))

describe('cli runtime target resolution', () => {
  it('uses config-driven mini platform when cli platform is missing', () => {
    const targets = resolveRuntimeTargets({})

    expect(targets.entries.map(entry => entry.descriptor.id)).toEqual(['miniprogram'])
    expect(targets.platform).toBeUndefined()
    expect(targets.label).toBe('config')
  })

  it('resolves explicit mini platform from cli option', () => {
    const targets = resolveRuntimeTargets({ platform: 'alipay' })

    expect(targets.entries.map(entry => entry.descriptor.id)).toEqual(['miniprogram'])
    expect(targets.platform).toBe('alipay')
    expect(targets.label).toBe('alipay')
  })

  it('resolves h5 alias to web runtime target from cli option', () => {
    const targets = resolveRuntimeTargets({ platform: 'h5' })

    expect(targets.entries.map(entry => entry.descriptor.id)).toEqual(['web'])
    expect(targets.platform).toBeUndefined()
    expect(targets.label).toBe('web')
  })

  it('resolves combined mini and web runtime target from cli option', () => {
    const targets = resolveRuntimeTargets({ platform: 'all' })

    expect(targets.entries.map(entry => entry.descriptor.id)).toEqual(['miniprogram', 'web'])
    expect(targets.platform).toBeUndefined()
    expect(targets.label).toBe('weapp + web')
  })

  it('does not inject mini platform into inline config when platform is omitted', () => {
    expect(createInlineConfig(resolveRuntimeTargets({}))).toBeUndefined()
  })

  it('composes backend inline config in execution order', () => {
    const targets = resolveRuntimeTargets({ platform: 'all' })

    expect(createInlineConfig(targets, {
      host: '127.0.0.1',
      scope: 'main',
    })).toMatchObject({
      weapp: {
        buildScope: {
          includeMainPackage: true,
          include: [],
          __weappViteBuildScopeSource: true,
        },
      },
      build: {
        watch: {},
      },
      server: {
        host: '127.0.0.1',
        port: 0,
        watch: {
          usePolling: true,
          interval: 100,
        },
      },
    })
  })

  it('can skip runtime target logging when silent is enabled', async () => {
    const targets = resolveRuntimeTargets({ platform: 'weapp' })
    const { logRuntimeTarget } = await import('./runtime')

    loggerInfoMock.mockClear()
    loggerWarnMock.mockClear()
    logRuntimeTarget(targets, { silent: true })

    expect(loggerInfoMock).not.toHaveBeenCalled()
    expect(loggerWarnMock).not.toHaveBeenCalled()
  })

  it('logs resolved config platform when cli platform is omitted', async () => {
    const targets = resolveRuntimeTargets({})
    const { logRuntimeTarget } = await import('./runtime')

    loggerInfoMock.mockClear()
    loggerWarnMock.mockClear()
    logRuntimeTarget(targets, { resolvedConfigPlatform: 'alipay' })

    expect(loggerInfoMock).toHaveBeenCalledWith('目标平台：alipay')
    expect(loggerWarnMock).not.toHaveBeenCalled()
  })

  it('falls back to config path hint when config platform is unresolved', async () => {
    const targets = resolveRuntimeTargets({})
    const { logRuntimeTarget } = await import('./runtime')

    loggerInfoMock.mockClear()
    loggerWarnMock.mockClear()
    logRuntimeTarget(targets)

    expect(loggerInfoMock).toHaveBeenCalledWith('目标平台：使用配置文件中的 weapp.platform')
    expect(loggerWarnMock).not.toHaveBeenCalled()
  })
})
