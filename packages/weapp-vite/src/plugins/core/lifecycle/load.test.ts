import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { parseSync } from 'oxc-parser'
import path from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import { createLoadHook, createOptionsHook } from './load'

const resolveWeappLibEntriesMock = vi.hoisted(() => vi.fn())
const findJsEntryMock = vi.hoisted(() => vi.fn())
const findVueEntryMock = vi.hoisted(() => vi.fn())

vi.mock('../../../runtime/lib', () => ({
  resolveWeappLibEntries: resolveWeappLibEntriesMock,
}))

vi.mock('../../../utils', async () => {
  const actual = await vi.importActual<typeof import('../../../utils')>('../../../utils')
  return {
    ...actual,
    findJsEntry: findJsEntryMock,
    findVueEntry: findVueEntryMock,
  }
})

describe('core lifecycle load hook injectWeapi', () => {
  it('injects abort globals for tanstack query projects during app load', async () => {
    const loadEntry = vi.fn(async () => ({
      code: 'App({})',
    }))

    const load = createLoadHook({
      ctx: {
        configService: {
          platform: 'weapp',
          packageJson: {
            dependencies: {
              '@tanstack/vue-query': '^5.0.0',
            },
          },
          weappViteConfig: {},
          weappLibConfig: undefined,
          relativeAbsoluteSrcRoot: () => 'app',
        },
      },
      subPackageMeta: undefined,
      loadEntry,
      loadedEntrySet: new Set<string>(),
    } as any)

    const result = await load.call({}, '/project/src/app.ts')
    const code = result && typeof result === 'object' && 'code' in result ? result.code : ''

    expect(code).toContain('installRequestGlobals')
    expect(code).toContain('"AbortController","AbortSignal"')
    expect(code).not.toContain('"XMLHttpRequest"')
    expect(code).not.toContain('"fetch"')
    expect(code).not.toContain('"WebSocket"')
  })

  it('injects request globals into existing app vue script without creating a duplicate script block', async () => {
    const sourceId = '/project/src/app.vue'
    const loadEntry = vi.fn(async () => ({
      code: [
        '<script setup lang="ts">',
        'defineAppJson({ pages: [] })',
        '</script>',
        '<script lang="ts">',
        'export default {}',
        '</script>',
      ].join('\n'),
    }))

    const load = createLoadHook({
      ctx: {
        configService: {
          platform: 'weapp',
          packageJson: {
            dependencies: {
              axios: '^1.0.0',
            },
          },
          weappViteConfig: {},
          weappLibConfig: undefined,
          relativeAbsoluteSrcRoot: () => 'app',
        },
      },
      subPackageMeta: undefined,
      loadEntry,
      loadedEntrySet: new Set<string>(),
    } as any)

    const result = await load.call({}, sourceId)
    const code = result && typeof result === 'object' && 'code' in result ? result.code : ''

    expect(code.match(/<script\b/g)?.length).toBe(2)
    expect(code).toContain('<script lang="ts">import { installRequestGlobals')
    expect(code).toContain('export default {}')
  })

  it('injects passive local bindings for manual installRequestGlobals usage without auto mode', async () => {
    const sourceId = '/project/src/app.ts'
    const loadEntry = vi.fn(async () => ({
      code: [
        'import { installRequestGlobals } from "@wevu/web-apis"',
        'installRequestGlobals()',
        'console.log(fetch, URL)',
      ].join('\n'),
    }))

    const load = createLoadHook({
      ctx: {
        configService: {
          platform: 'weapp',
          packageJson: {
            dependencies: {},
          },
          weappViteConfig: {},
          weappLibConfig: undefined,
          relativeAbsoluteSrcRoot: () => 'app',
        },
      },
      subPackageMeta: undefined,
      loadEntry,
      loadedEntrySet: new Set<string>(),
    } as any)

    const result = await load.call({}, sourceId)
    const code = result && typeof result === 'object' && 'code' in result ? result.code : ''

    expect(code).toContain('__weappViteRequestGlobalsPassiveBindings__')
    expect(code).toContain('function __weappViteExposeRequestGlobal__(name,value)')
    expect(code).toContain('var fetch = __weappViteExposeRequestGlobal__("fetch",typeof __weappViteRequestGlobalsActuals__["fetch"]==="function"')
    expect(code).toContain('installRequestGlobals()')
    expect(code).not.toContain('__weappViteInstallRequestGlobals')
  })

  it('injects request globals into lib entry components when enabled explicitly', async () => {
    const sourceId = '/project/src/components/lib-card.ts'
    const loadEntry = vi.fn(async () => ({ code: 'Component({})' }))
    const load = createLoadHook({
      ctx: {
        configService: {
          platform: 'weapp',
          packageJson: {
            dependencies: {},
          },
          weappViteConfig: {
            injectRequestGlobals: {
              enabled: true,
              targets: ['AbortController', 'AbortSignal'],
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
    const code = result && typeof result === 'object' && 'code' in result ? result.code : ''

    expect(code).toContain('installRequestGlobals')
    expect(code).toContain('Component({})')
  })

  it('injects request globals into page entries when auto mode is matched', async () => {
    const sourceId = '/project/src/pages/request/index.ts'
    const loadEntry = vi.fn(async () => ({ code: 'Page({})' }))
    const load = createLoadHook({
      ctx: {
        configService: {
          platform: 'weapp',
          packageJson: {
            dependencies: {
              axios: '^1.0.0',
            },
          },
          weappViteConfig: {},
          weappLibConfig: undefined,
          relativeAbsoluteSrcRoot: () => 'pages/request/index',
        },
      },
      subPackageMeta: undefined,
      loadEntry,
      loadedEntrySet: new Set<string>([sourceId]),
    } as any)

    const result = await load.call({}, sourceId)
    const code = result && typeof result === 'object' && 'code' in result ? result.code : ''

    expect(code).toContain('installRequestGlobals')
    expect(code).toContain('"fetch","Headers","Request","Response","AbortController","AbortSignal","XMLHttpRequest","WebSocket"')
    expect(code).toContain('Page({})')
  })

  it('injects websocket globals for socket.io-client projects during app load', async () => {
    const loadEntry = vi.fn(async () => ({
      code: 'App({})',
    }))

    const load = createLoadHook({
      ctx: {
        configService: {
          platform: 'weapp',
          packageJson: {
            dependencies: {
              'socket.io-client': '^4.8.3',
            },
          },
          weappViteConfig: {},
          weappLibConfig: undefined,
          relativeAbsoluteSrcRoot: () => 'app',
        },
      },
      subPackageMeta: undefined,
      loadEntry,
      loadedEntrySet: new Set<string>(),
    } as any)

    const result = await load.call({}, '/project/src/app.ts')
    const code = result && typeof result === 'object' && 'code' in result ? result.code : ''

    expect(code).toContain('installRequestGlobals')
    expect(code).toContain('"WebSocket"')
    expect(code).toContain('var fetch = __weappViteRequestGlobalsHost__.fetch')
    expect(code).toContain('var URL = __weappViteRequestGlobalsHost__.URL')
    expect(code).toContain('var WebSocket = __weappViteRequestGlobalsHost__.WebSocket')
  })

  it('injects request globals into declared page entries even when loadedEntrySet is empty', async () => {
    const sourceId = '/project/src/pages/request-globals/fetch.vue'
    const loadEntry = vi.fn(async () => ({ code: 'Page({})' }))
    const load = createLoadHook({
      ctx: {
        configService: {
          platform: 'weapp',
          packageJson: {
            dependencies: {
              axios: '^1.0.0',
            },
          },
          weappViteConfig: {},
          weappLibConfig: undefined,
          relativeAbsoluteSrcRoot: () => 'pages/request-globals/fetch',
        },
      },
      subPackageMeta: undefined,
      loadEntry,
      loadedEntrySet: new Set<string>(),
      entriesMap: new Map([
        ['pages/request-globals/fetch', { type: 'page', path: 'pages/request-globals/fetch' }],
      ]),
    } as any)

    const result = await load.call({}, sourceId)
    const code = result && typeof result === 'object' && 'code' in result ? result.code : ''

    expect(loadEntry).toHaveBeenCalledWith(sourceId, 'page')
    expect(code).toContain('installRequestGlobals')
    expect(code).toContain('Page({})')
  })

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

  it('treats plugin main entry as root app entry in pluginOnly mode', async () => {
    const sourceId = '/project/plugin/index.ts'
    const loadEntry = vi.fn(async () => ({ code: 'App({})' }))
    const load = createLoadHook({
      ctx: {
        scanService: {
          pluginJson: {
            main: 'index.js',
          },
        },
        configService: {
          pluginOnly: true,
          platform: 'weapp',
          weappViteConfig: {},
          weappLibConfig: undefined,
          relativeAbsoluteSrcRoot: () => 'index',
        },
      },
      subPackageMeta: undefined,
      loadEntry,
      loadedEntrySet: new Set<string>(),
    } as any)

    const result = await load.call({}, sourceId)

    expect(loadEntry).toHaveBeenCalledWith(sourceId, 'app')
    expect(result).toEqual({ code: 'App({})' })
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

  it('keeps babel as default ast engine for component load result', async () => {
    const sourceId = '/project/src/components/panel.ts'
    const rawResult = {
      code: 'Component({ methods: { run() { return foo.bar() } } })',
    }

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
          weappLibConfig: undefined,
          relativeAbsoluteSrcRoot: () => 'components/panel',
        },
      },
      subPackageMeta: undefined,
      loadEntry: vi.fn(async () => rawResult),
      loadedEntrySet: new Set<string>([sourceId]),
    } as any)

    const pluginContext = {
      resolve: vi.fn(async () => ({ id: '@wevu/api' })),
      parse: vi.fn((code: string) => parseSync(sourceId, code).program),
    }

    const result = await load.call(pluginContext, sourceId)

    expect(result).toEqual(rawResult)
    expect(pluginContext.parse).not.toHaveBeenCalled()
  })

  it('fast rejects without rolldown parse when ast engine is oxc and source has no platform api access', async () => {
    const sourceId = '/project/src/components/panel.ts'
    const rawResult = {
      code: 'Component({ methods: { run() { return foo.bar() } } })',
    }

    const load = createLoadHook({
      ctx: {
        configService: {
          platform: 'weapp',
          weappViteConfig: {
            ast: {
              engine: 'oxc',
            },
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

    const pluginContext = {
      resolve: vi.fn(async () => ({ id: '@wevu/api' })),
      parse: vi.fn((code: string) => parseSync(sourceId, code).program),
    }

    const result = await load.call(pluginContext, sourceId)

    expect(result).toEqual(rawResult)
    expect(pluginContext.parse).not.toHaveBeenCalled()
  })
})

describe('core lifecycle options hook', () => {
  it('builds input map from subPackageMeta entries', async () => {
    const optionsHook = createOptionsHook({
      ctx: {
        configService: {
          absoluteSrcRoot: '/project/src',
        },
        scanService: {},
        buildService: {},
      },
      subPackageMeta: {
        entries: ['pages/a/index', 'pages/b/index'],
      },
      pendingIndependentBuilds: [],
    } as any)

    const options: Record<string, any> = {}
    await optionsHook(options)

    expect(options.input).toEqual({
      'pages/a/index': '/project/src/pages/a/index',
      'pages/b/index': '/project/src/pages/b/index',
    })
  })

  it('loads lib entries when weapp lib mode is enabled', async () => {
    resolveWeappLibEntriesMock.mockResolvedValueOnce([
      {
        name: 'card',
        input: '/project/src/components/card.ts',
        relativeBase: 'components/card',
        outputBase: 'lib/card',
      },
    ])

    const runtimeState = {
      lib: {
        enabled: false,
        entries: new Map(),
      },
    }

    const configService = {
      absoluteSrcRoot: '/project/src',
      weappLibConfig: {
        enabled: true,
      },
      options: {},
    }

    const optionsHook = createOptionsHook({
      ctx: {
        runtimeState,
        configService,
        scanService: {},
        buildService: {},
      },
      subPackageMeta: undefined,
      pendingIndependentBuilds: [],
    } as any)

    const options: Record<string, any> = {}
    await optionsHook(options)

    expect(options.input).toEqual({
      card: '/project/src/components/card.ts',
    })
    expect(runtimeState.lib.enabled).toBe(true)
    expect(runtimeState.lib.entries.size).toBe(1)
    expect(configService.options.weappLibOutputMap.get('components/card')).toBe('lib/card')
  })

  it('handles app entry and independent subpackage builds when lib mode is disabled', async () => {
    const runtimeState = {
      lib: {
        enabled: true,
        entries: new Map([['/project/src/old.ts', { input: '/project/src/old.ts' }]]),
      },
    }
    const configService = {
      absoluteSrcRoot: '/project/src',
      weappLibConfig: {
        enabled: false,
      },
      isDev: false,
      currentSubPackageRoot: 'pkgA',
      options: {
        weappLibOutputMap: new Map([['legacy', 'legacy']]),
      },
    }
    const pkgAMeta = { root: 'pkgA' }

    const scanService = {
      loadAppEntry: vi.fn(async () => ({ path: '/project/src/app.ts' })),
      loadSubPackages: vi.fn(),
      drainIndependentDirtyRoots: vi.fn(() => ['pkgA', 'pkg-missing']),
      independentSubPackageMap: new Map([
        ['pkgA', pkgAMeta],
      ]),
    }

    const buildService = {
      buildIndependentBundle: vi.fn(async () => {
        configService.currentSubPackageRoot = 'changed'
        return { ok: true }
      }),
    }

    const state = {
      ctx: {
        runtimeState,
        configService,
        scanService,
        buildService,
      },
      subPackageMeta: undefined,
      pendingIndependentBuilds: [],
    } as any

    const optionsHook = createOptionsHook(state)
    const options: Record<string, any> = {}
    await optionsHook(options)

    expect(options.input).toEqual({
      app: '/project/src/app.ts',
    })
    expect(runtimeState.lib.enabled).toBe(false)
    expect(runtimeState.lib.entries.size).toBe(0)
    expect(configService.options.weappLibOutputMap).toBeUndefined()
    expect(configService.options.currentSubPackageRoot).toBe('pkgA')
    expect(state.pendingIndependentBuilds).toHaveLength(1)
    expect(buildService.buildIndependentBundle).toHaveBeenCalledWith('pkgA', pkgAMeta)
  })

  it('uses plugin main entry as root input in pluginOnly mode', async () => {
    findJsEntryMock.mockResolvedValueOnce({
      path: '/project/plugin/index.ts',
      predictions: ['/project/plugin/index.ts'],
    })
    findVueEntryMock.mockResolvedValueOnce(undefined)

    const runtimeState = {
      lib: {
        enabled: false,
        entries: new Map(),
      },
    }
    const configService = {
      absoluteSrcRoot: '/project/src',
      weappLibConfig: {
        enabled: false,
      },
      pluginOnly: true,
      isDev: false,
      options: {},
    }

    const scanService = {
      pluginJson: {
        main: 'index.js',
      },
      pluginJsonPath: '/project/plugin/plugin.json',
      loadAppEntry: vi.fn(async () => ({ path: '/project/src/app.ts' })),
      loadSubPackages: vi.fn(),
      drainIndependentDirtyRoots: vi.fn(() => []),
      independentSubPackageMap: new Map(),
    }

    const state = {
      ctx: {
        runtimeState,
        configService,
        scanService,
        buildService: {
          buildIndependentBundle: vi.fn(),
        },
      },
      subPackageMeta: undefined,
      pendingIndependentBuilds: [],
    } as any

    const optionsHook = createOptionsHook(state)
    const options: Record<string, any> = {}
    await optionsHook(options)

    expect(options.input).toEqual({
      index: '/project/plugin/index.ts',
    })
    expect(scanService.loadSubPackages).not.toHaveBeenCalled()
  })
})
