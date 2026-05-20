import { describe, expect, it } from 'vitest'
import { isAutoSetDataPickEnabledWithPreset, isWevuMinifyEnabled, resolveWevuDefaultsWithPreset, resolveWevuPreset } from './wevuPreset'

describe('wevu performance preset', () => {
  it('resolves preset name', () => {
    expect(resolveWevuPreset({ wevu: { preset: 'performance' } } as any)).toBe('performance')
    expect(resolveWevuPreset({} as any)).toBeUndefined()
  })

  it('enables auto setData pick by preset when explicit value is absent', () => {
    expect(isAutoSetDataPickEnabledWithPreset({
      wevu: {
        preset: 'performance',
      },
    } as any)).toBe(true)
  })

  it('keeps explicit autoSetDataPick override higher than preset', () => {
    expect(isAutoSetDataPickEnabledWithPreset({
      wevu: {
        preset: 'performance',
        autoSetDataPick: false,
      },
    } as any)).toBe(false)
  })

  it('merges performance defaults and keeps user overrides', () => {
    const resolved = resolveWevuDefaultsWithPreset({
      wevu: {
        preset: 'performance',
        defaults: {
          app: {
            setData: {
              strategy: 'diff',
            },
          },
          component: {
            setData: {
              includeComputed: false,
            },
          },
        },
      },
    } as any)

    expect(resolved?.app?.setData?.suspendWhenHidden).toBe(true)
    expect(resolved?.app?.setData?.diagnostics).toBe('fallback')
    expect(resolved?.app?.setData?.strategy).toBe('diff')
    expect(resolved?.app?.setData?.highFrequencyWarning).toBeTruthy()
    expect(resolved?.component?.setData?.strategy).toBe('patch')
    expect(resolved?.component?.setData?.diagnostics).toBe('fallback')
    expect(resolved?.component?.setData?.includeComputed).toBe(false)
  })

  it('defaults wevu minify by mode and respects explicit flag', () => {
    expect(isWevuMinifyEnabled({} as any, true)).toBe(false)
    expect(isWevuMinifyEnabled({} as any, false)).toBe(true)
    expect(isWevuMinifyEnabled({
      wevu: {
        minify: true,
      },
    } as any, true)).toBe(true)
    expect(isWevuMinifyEnabled({
      wevu: {
        minify: false,
      },
    } as any, false)).toBe(false)
  })
})
