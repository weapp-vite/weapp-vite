import { describe, expect, it, vi } from 'vitest'
import { createLoadHook } from './load'

describe('core lifecycle load hook injectWeapi', () => {
  it('injects wpi and replaces wx/my/platform global when replaceWx is enabled', async () => {
    const loadEntry = vi.fn(async () => ({
      code: 'App({})',
    }))

    const load = createLoadHook({
      ctx: {
        configService: {
          platform: 'alipay',
          weappViteConfig: {
            injectWeapi: {
              enabled: true,
              replaceWx: true,
            },
          },
          weappLibConfig: undefined,
          relativeAbsoluteSrcRoot: () => 'app',
        },
      },
      subPackageMeta: undefined,
      loadEntry,
      loadedEntrySet: new Set<string>(),
    } as any)

    const result = await load.call(
      {
        resolve: vi.fn(async (id: string) => {
          if (id === '@wevu/api') {
            return { id }
          }
          return null
        }),
      },
      '/project/src/app.ts',
    )

    const code = result && typeof result === 'object' && 'code' in result ? result.code : ''
    expect(code).toContain('__weappGlobal.wx = __weappInstance')
    expect(code).toContain('__weappGlobal.my = __weappInstance')
    expect(code).toContain('__weappGlobal[__weappPlatformKey] = __weappInstance')
    expect(code).toContain('Function(\'__weappApi\', \'wx = __weappApi; my = __weappApi;\')(__weappInstance)')
  })

  it('does not replace wx/my globals when replaceWx is omitted', async () => {
    const loadEntry = vi.fn(async () => ({
      code: 'App({})',
    }))

    const load = createLoadHook({
      ctx: {
        configService: {
          platform: 'alipay',
          weappViteConfig: {
            injectWeapi: {
              enabled: true,
            },
          },
          weappLibConfig: undefined,
          relativeAbsoluteSrcRoot: () => 'app',
        },
      },
      subPackageMeta: undefined,
      loadEntry,
      loadedEntrySet: new Set<string>(),
    } as any)

    const result = await load.call(
      {
        resolve: vi.fn(async (id: string) => {
          if (id === '@wevu/api') {
            return { id }
          }
          return null
        }),
      },
      '/project/src/app.ts',
    )

    const code = result && typeof result === 'object' && 'code' in result ? result.code : ''
    expect(code).toContain('__weappGlobal["wpi"] = __weappWpi')
    expect(code).not.toContain('__weappGlobal.wx = __weappInstance')
    expect(code).not.toContain('__weappGlobal.my = __weappInstance')
  })

  it('rewrites component wx/my access to injected global api when replaceWx is enabled', async () => {
    const loadEntry = vi.fn(async () => ({
      code: 'Component({ methods: { run() { return wx.setClipboardData({ data: "x" }) && my.showToast({ title: "ok" }) } } })',
    }))

    const sourceId = '/project/src/components/a.ts'
    const load = createLoadHook({
      ctx: {
        configService: {
          platform: 'alipay',
          weappViteConfig: {
            injectWeapi: {
              enabled: true,
              replaceWx: true,
            },
          },
          weappLibConfig: undefined,
          relativeAbsoluteSrcRoot: () => 'components/a',
        },
      },
      subPackageMeta: undefined,
      loadEntry,
      loadedEntrySet: new Set<string>([sourceId]),
    } as any)

    const result = await load.call(
      {
        resolve: vi.fn(async (id: string) => {
          if (id === '@wevu/api') {
            return { id }
          }
          return null
        }),
      },
      sourceId,
    )

    const code = result && typeof result === 'object' && 'code' in result ? result.code : ''
    expect(code).toContain('setClipboardData')
    expect(code).toContain('showToast')
    expect(code).toContain('typeof globalThis')
    expect(code).not.toContain('wx.setClipboardData')
    expect(code).not.toContain('my.showToast')
  })
})
