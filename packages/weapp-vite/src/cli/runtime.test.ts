import { describe, expect, it, vi } from 'vitest'
import { createInlineConfig, resolveRuntimeTargets } from './runtime'

const loggerInfoMock = vi.hoisted(() => vi.fn())

vi.mock('../logger', () => ({
  default: {
    info: loggerInfoMock,
    warn: vi.fn(),
  },
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
    logRuntimeTarget(targets, { silent: true })

    expect(loggerInfoMock).not.toHaveBeenCalled()
  })
})
