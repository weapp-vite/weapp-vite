import { describe, expect, it, vi } from 'vitest'
import {
  createSetDataHighFrequencyWarningMonitor,
  resolveHighFrequencyWarningOptions,
} from '@/runtime/register/setDataFrequencyWarning'

describe('runtime: setData high frequency warning', () => {
  it('resolves default and disabled configs', () => {
    const defaults = resolveHighFrequencyWarningOptions(undefined)
    expect(defaults.enabled).toBe(false)
    expect(defaults.devOnly).toBe(true)
    expect(defaults.sampleWindowMs).toBe(1000)
    expect(defaults.maxCalls).toBe(30)
    expect(defaults.coolDownMs).toBe(5000)
    expect(defaults.warnOnPageScroll).toBe(true)
    expect(defaults.pageScrollCoolDownMs).toBe(2000)

    const enabled = resolveHighFrequencyWarningOptions(true)
    expect(enabled.enabled).toBe(true)

    const disabled = resolveHighFrequencyWarningOptions(false)
    expect(disabled.enabled).toBe(false)
  })

  it('warns when call count exceeds threshold', () => {
    let now = 0
    const warn = vi.fn()
    const monitor = createSetDataHighFrequencyWarningMonitor({
      option: {
        devOnly: false,
        sampleWindowMs: 1000,
        maxCalls: 3,
        coolDownMs: 0,
      },
      targetLabel: 'page:pages/index/index',
      now: () => now,
      logger: warn,
    })

    expect(monitor).toBeTypeOf('function')
    monitor?.()
    now += 100
    monitor?.()
    now += 100
    monitor?.()
    now += 100
    monitor?.()

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('[wevu:setData]')
    expect(warn.mock.calls[0][0]).toContain('page:pages/index/index')
  })

  it('respects warning cooldown', () => {
    let now = 0
    const warn = vi.fn()
    const monitor = createSetDataHighFrequencyWarningMonitor({
      option: {
        devOnly: false,
        sampleWindowMs: 1000,
        maxCalls: 1,
        coolDownMs: 500,
      },
      targetLabel: 'component:DemoCard',
      now: () => now,
      logger: warn,
    })

    monitor?.()
    now += 10
    monitor?.()
    now += 10
    monitor?.()
    expect(warn).toHaveBeenCalledTimes(1)

    now += 600
    monitor?.()
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('warns when setData is called inside onPageScroll hook', () => {
    let now = 0
    const warn = vi.fn()
    let inPageScrollHook = true
    const monitor = createSetDataHighFrequencyWarningMonitor({
      option: {
        devOnly: false,
        maxCalls: 999,
        warnOnPageScroll: true,
        pageScrollCoolDownMs: 200,
      },
      targetLabel: 'page:pages/list/index',
      isInPageScrollHook: () => inPageScrollHook,
      now: () => now,
      logger: warn,
    })

    monitor?.()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('onPageScroll')

    now += 100
    monitor?.()
    expect(warn).toHaveBeenCalledTimes(1)

    now += 200
    monitor?.()
    expect(warn).toHaveBeenCalledTimes(2)

    inPageScrollHook = false
    now += 300
    monitor?.()
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('returns undefined monitor when disabled', () => {
    const monitor = createSetDataHighFrequencyWarningMonitor({
      option: false,
      targetLabel: 'page:pages/index/index',
    })
    expect(monitor).toBeUndefined()
  })
})
