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

    expect(targets.runMini).toBe(true)
    expect(targets.runWeb).toBe(false)
    expect(targets.mpPlatform).toBeUndefined()
    expect(targets.label).toBe('config')
  })

  it('resolves explicit mini platform from cli option', () => {
    const targets = resolveRuntimeTargets({ platform: 'alipay' })

    expect(targets.runMini).toBe(true)
    expect(targets.runWeb).toBe(false)
    expect(targets.mpPlatform).toBe('alipay')
    expect(targets.label).toBe('alipay')
  })

  it('resolves web runtime target from cli option', () => {
    const targets = resolveRuntimeTargets({ platform: 'h5' })

    expect(targets.runMini).toBe(false)
    expect(targets.runWeb).toBe(true)
    expect(targets.mpPlatform).toBeUndefined()
    expect(targets.label).toBe('h5')
  })

  it('does not inject mini platform into inline config when platform is omitted', () => {
    expect(createInlineConfig(undefined)).toBeUndefined()
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
