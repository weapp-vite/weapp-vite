import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
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
    expect(code).toContain('const __weappRawApi = ((typeof my !== \'undefined\' && my)')
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

  it('loads css wxss requests from the real wxss path and registers watch file', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-load-'))
    const realWxss = path.join(tempDir, 'index.wxss')
    await writeFile(realWxss, '.page{color:red;}', 'utf8')

    const load = createLoadHook({
      ctx: {
        configService: {
          isDev: true,
          weappViteConfig: {},
          relativeAbsoluteSrcRoot: () => 'pages/index/index',
        },
      },
      subPackageMeta: undefined,
      loadEntry: vi.fn(),
      loadedEntrySet: new Set<string>(),
    } as any)

    const addWatchFile = vi.fn()
    const result = await load.call(
      {
        addWatchFile,
      },
      `${path.join(tempDir, 'index.css')}?wxss`,
    )

    expect(addWatchFile).toHaveBeenCalled()
    expect(result).toEqual({ code: '.page{color:red;}' })
  })

  it('returns null for css wxss request when real file reading fails', async () => {
    const load = createLoadHook({
      ctx: {
        configService: {
          isDev: true,
          weappViteConfig: {},
          relativeAbsoluteSrcRoot: () => 'pages/index/index',
        },
      },
      subPackageMeta: undefined,
      loadEntry: vi.fn(),
      loadedEntrySet: new Set<string>(),
    } as any)

    const result = await load.call(
      {
        addWatchFile: vi.fn(),
      },
      '/tmp/missing-load-style.css?wxss',
    )

    expect(result).toBeNull()
  })

  it('returns component load result immediately when file is registered as lib entry', async () => {
    const sourceId = '/project/src/components/lib-card.ts'
    const loadEntry = vi.fn(async () => ({ code: 'Component({})' }))
    const load = createLoadHook({
      ctx: {
        configService: {
          platform: 'weapp',
          weappViteConfig: {
            injectWeapi: {
              enabled: true,
              replaceWx: true,
            },
          },
          weappLibConfig: {
            enabled: true,
          },
          relativeAbsoluteSrcRoot: () => 'components/lib-card',
        },
        runtimeState: {
          lib: {
            entries: new Map([[sourceId, { input: sourceId }]]),
          },
        },
      },
      subPackageMeta: undefined,
      loadEntry,
      loadedEntrySet: new Set<string>(),
    } as any)

    const result = await load.call({}, sourceId)
    expect(loadEntry).toHaveBeenCalledWith(sourceId, 'component')
    expect(result).toEqual({ code: 'Component({})' })
  })

  it('returns app load result when injectWeapi is disabled or weapi is unavailable', async () => {
    const sourceId = '/project/src/app.ts'

    const disabledLoadEntry = vi.fn(async () => ({ code: 'App({})' }))
    const disabledLoad = createLoadHook({
      ctx: {
        configService: {
          platform: 'weapp',
          weappViteConfig: {
            injectWeapi: {
              enabled: false,
            },
          },
          weappLibConfig: undefined,
          relativeAbsoluteSrcRoot: () => 'app',
        },
      },
      subPackageMeta: undefined,
      loadEntry: disabledLoadEntry,
      loadedEntrySet: new Set<string>(),
    } as any)

    const disabledResult = await disabledLoad.call({}, sourceId)
    expect(disabledResult).toEqual({ code: 'App({})' })

    const unavailableLoadEntry = vi.fn(async () => ({ code: 'App({})' }))
    const unavailableLoad = createLoadHook({
      ctx: {
        configService: {
          platform: 'weapp',
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
      loadEntry: unavailableLoadEntry,
      loadedEntrySet: new Set<string>(),
    } as any)

    const unavailableResult = await unavailableLoad.call(
      {
        resolve: vi.fn(async () => null),
      },
      sourceId,
    )
    expect(unavailableResult).toEqual({ code: 'App({})' })
  })

  it('returns app result when loadEntry output is non-object', async () => {
    const sourceId = '/project/src/app.ts'
    const loadEntry = vi.fn(async () => 'AppRawCode')
    const load = createLoadHook({
      ctx: {
        configService: {
          platform: 'weapp',
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
        resolve: vi.fn(async () => ({ id: '@wevu/api' })),
      },
      sourceId,
    )

    expect(result).toBe('AppRawCode')
  })

  it('returns component result when replaceWx is disabled or weapi resolve fails', async () => {
    const sourceId = '/project/src/components/panel.ts'
    const rawResult = {
      code: 'Component({ methods: { run() { return wx.getSystemInfoSync() } } })',
    }

    const noReplaceLoad = createLoadHook({
      ctx: {
        configService: {
          platform: 'weapp',
          weappViteConfig: {
            injectWeapi: {
              enabled: true,
              replaceWx: false,
            },
          },
          weappLibConfig: undefined,
          relativeAbsoluteSrcRoot: () => 'components/panel',
        },
      },
      subPackageMeta: undefined,
      loadEntry: vi.fn(async () => rawResult),
      loadedEntrySet: new Set<string>([sourceId]),
    } as any)

    const noReplaceResult = await noReplaceLoad.call({}, sourceId)
    expect(noReplaceResult).toEqual(rawResult)

    const unavailableLoad = createLoadHook({
      ctx: {
        configService: {
          platform: 'weapp',
          weappViteConfig: {
            injectWeapi: {
              enabled: true,
              replaceWx: true,
            },
          },
          weappLibConfig: undefined,
          relativeAbsoluteSrcRoot: () => 'components/panel',
        },
      },
      subPackageMeta: undefined,
      loadEntry: vi.fn(async () => rawResult),
      loadedEntrySet: new Set<string>([sourceId]),
    } as any)

    const unavailableResult = await unavailableLoad.call(
      {
        resolve: vi.fn(async () => null),
      },
      sourceId,
    )

    expect(unavailableResult).toEqual(rawResult)
  })
})
