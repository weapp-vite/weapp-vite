import { describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtimeState'
import { createHmrProfileMetricsPlugin } from './hmrProfileMetricsPlugin'

describe('hmrProfileMetricsPlugin', () => {
  it('tracks write tail duration into hmr profile', () => {
    const nowSpy = vi.spyOn(performance, 'now')
    nowSpy
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(28)

    const ctx = {
      configService: {
        isDev: true,
      },
      runtimeState: createRuntimeState(),
    } as any
    const plugin = createHmrProfileMetricsPlugin(ctx)

    plugin.generateBundle?.call({} as any, {} as any, {} as any, true)
    plugin.writeBundle?.call({} as any, {} as any, {} as any)

    expect(ctx.runtimeState.build.hmr.profile.writeMs).toBe(18)
    nowSpy.mockRestore()
  })
})
