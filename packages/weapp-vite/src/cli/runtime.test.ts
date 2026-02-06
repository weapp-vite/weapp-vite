import { describe, expect, it } from 'vitest'
import { createInlineConfig, resolveRuntimeTargets } from './runtime'

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
})
