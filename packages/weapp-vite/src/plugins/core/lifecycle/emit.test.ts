import { describe, expect, it } from 'vitest'
import { createGenerateBundleHook } from './emit'

describe('core lifecycle emit hook injectWeapi', () => {
  it('auto injects request globals only when an entry chunk actually reaches matching network libs', async () => {
    const state = {
      ctx: {
        scanService: {
          subPackageMap: new Map(),
        },
        configService: {
          isDev: false,
          packageJson: {
            dependencies: {
              axios: '^1.0.0',
            },
          },
          weappViteConfig: {},
        },
      },
      subPackageMeta: undefined,
      entriesMap: new Map(),
      resolvedEntryMap: new Map([
        ['/project/src/app.ts', { entry: 'app', type: 'app' }],
        ['/project/src/pages/other.ts', { entry: 'pages/other', type: 'page' }],
      ]),
      pendingIndependentBuilds: [],
      moduleImporters: new Map(),
      entryModuleIds: new Set(),
      hmrState: {
        didEmitAllEntries: false,
        hasBuiltOnce: false,
      },
      hmrSharedChunksMode: 'auto',
      hmrSharedChunkImporters: new Map(),
    } as any

    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'app.js': {
        type: 'chunk',
        fileName: 'app.js',
        code: 'App({})',
        isEntry: true,
        facadeModuleId: '/project/src/app.ts',
        moduleIds: ['/project/src/app.ts'],
        imports: ['common.js'],
        dynamicImports: [],
      },
      'pages/other.js': {
        type: 'chunk',
        fileName: 'pages/other.js',
        code: 'Page({})',
        isEntry: true,
        facadeModuleId: '/project/src/pages/other.ts',
        moduleIds: ['/project/src/pages/other.ts'],
        imports: [],
        dynamicImports: [],
      },
      'common.js': {
        type: 'chunk',
        fileName: 'common.js',
        code: 'module.exports = {}',
        isEntry: false,
        moduleIds: ['/project/node_modules/.pnpm/axios@1.14.0/node_modules/axios/index.js'],
        imports: [],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['app.js'].code).toContain('weapp-vite/runtime/requestGlobals')
    expect(bundle['pages/other.js'].code).not.toContain('weapp-vite/runtime/requestGlobals')
  })

  it('does not auto inject request globals when matching deps are installed but not present in final bundle', async () => {
    const state = {
      ctx: {
        scanService: {
          subPackageMap: new Map(),
        },
        configService: {
          isDev: false,
          packageJson: {
            dependencies: {
              axios: '^1.0.0',
            },
          },
          weappViteConfig: {},
        },
      },
      subPackageMeta: undefined,
      entriesMap: new Map(),
      resolvedEntryMap: new Map([
        ['/project/src/app.ts', { entry: 'app', type: 'app' }],
      ]),
      pendingIndependentBuilds: [],
      moduleImporters: new Map(),
      entryModuleIds: new Set(),
      hmrState: {
        didEmitAllEntries: false,
        hasBuiltOnce: false,
      },
      hmrSharedChunksMode: 'auto',
      hmrSharedChunkImporters: new Map(),
    } as any

    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'app.js': {
        type: 'chunk',
        fileName: 'app.js',
        code: 'App({})',
        isEntry: true,
        facadeModuleId: '/project/src/app.ts',
        moduleIds: ['/project/src/app.ts'],
        imports: ['common.js'],
        dynamicImports: [],
      },
      'common.js': {
        type: 'chunk',
        fileName: 'common.js',
        code: 'module.exports = {}',
        isEntry: false,
        moduleIds: ['/project/src/shared/request.ts'],
        imports: [],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['app.js'].code).not.toContain('weapp-vite/runtime/requestGlobals')
  })

  it('always injects request globals for explicit config', async () => {
    const state = {
      ctx: {
        scanService: {
          subPackageMap: new Map(),
        },
        configService: {
          isDev: false,
          packageJson: {
            dependencies: {},
          },
          weappViteConfig: {
            injectRequestGlobals: {
              enabled: true,
              targets: ['fetch'],
            },
          },
        },
      },
      subPackageMeta: undefined,
      entriesMap: new Map(),
      resolvedEntryMap: new Map([
        ['/project/src/app.ts', { entry: 'app', type: 'app' }],
      ]),
      pendingIndependentBuilds: [],
      moduleImporters: new Map(),
      entryModuleIds: new Set(),
      hmrState: {
        didEmitAllEntries: false,
        hasBuiltOnce: false,
      },
      hmrSharedChunksMode: 'auto',
      hmrSharedChunkImporters: new Map(),
    } as any

    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'app.js': {
        type: 'chunk',
        fileName: 'app.js',
        code: 'App({})',
        isEntry: true,
        facadeModuleId: '/project/src/app.ts',
        moduleIds: ['/project/src/app.ts'],
        imports: [],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['app.js'].code).toContain('__weappViteInstallRequestGlobals({ targets: ["fetch"] })')
  })

  it('rewrites bundle chunk wx/my access to global wpi', async () => {
    const state = {
      ctx: {
        scanService: {
          subPackageMap: new Map(),
        },
        configService: {
          isDev: false,
          weappViteConfig: {
            injectWeapi: {
              enabled: true,
              replaceWx: true,
            },
          },
        },
      },
      subPackageMeta: {
        subPackage: {
          root: 'pkg',
        },
      },
      entriesMap: new Map(),
      pendingIndependentBuilds: [],
      moduleImporters: new Map(),
      entryModuleIds: new Set(),
      hmrState: {
        didEmitAllEntries: false,
        hasBuiltOnce: false,
      },
      hmrSharedChunksMode: 'auto',
      hmrSharedChunkImporters: new Map(),
    } as any

    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'components/HelloWorld.js': {
        type: 'chunk',
        fileName: 'components/HelloWorld.js',
        code: 'const run = () => wx.showToast({ title: "ok" })',
        imports: [],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    const code = bundle['components/HelloWorld.js'].code
    expect(code).toContain('showToast')
    expect(code).toContain('typeof globalThis')
    expect(code).not.toContain('wx.showToast')
  })

  it('keeps local wx bindings untouched', async () => {
    const state = {
      ctx: {
        scanService: {
          subPackageMap: new Map(),
        },
        configService: {
          isDev: false,
          weappViteConfig: {
            injectWeapi: {
              enabled: true,
              replaceWx: true,
            },
          },
        },
      },
      subPackageMeta: {
        subPackage: {
          root: 'pkg',
        },
      },
      entriesMap: new Map(),
      pendingIndependentBuilds: [],
      moduleImporters: new Map(),
      entryModuleIds: new Set(),
      hmrState: {
        didEmitAllEntries: false,
        hasBuiltOnce: false,
      },
      hmrSharedChunksMode: 'auto',
      hmrSharedChunkImporters: new Map(),
    } as any

    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'components/HelloWorld.js': {
        type: 'chunk',
        fileName: 'components/HelloWorld.js',
        code: 'const wx = createMock(); const run = () => wx.showToast({ title: "ok" })',
        imports: [],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['components/HelloWorld.js'].code).toContain('const wx = createMock()')
    expect(bundle['components/HelloWorld.js'].code).not.toContain('typeof globalThis')
  })

  it('rewrites alipay npm requires to node_modules by default', async () => {
    const state = {
      ctx: {
        scanService: {
          subPackageMap: new Map(),
        },
        configService: {
          isDev: false,
          platform: 'alipay',
          packageJson: {
            dependencies: {
              'tdesign-miniprogram': '^1.12.3',
            },
          },
          weappViteConfig: {},
        },
      },
      subPackageMeta: {
        subPackage: {
          root: 'pkg',
        },
      },
      entriesMap: new Map(),
      pendingIndependentBuilds: [],
      moduleImporters: new Map(),
      entryModuleIds: new Set(),
      hmrState: {
        didEmitAllEntries: false,
        hasBuiltOnce: false,
      },
      hmrSharedChunksMode: 'auto',
      hmrSharedChunkImporters: new Map(),
    } as any

    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'common.js': {
        type: 'chunk',
        fileName: 'common.js',
        code: 'const toast = require("tdesign-miniprogram/toast/index")',
        imports: [],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['common.js'].code).toContain('/node_modules/tdesign-miniprogram/toast/index')
  })

  it('supports miniprogram_npm mode in alipay npm require rewrite', async () => {
    const state = {
      ctx: {
        scanService: {
          subPackageMap: new Map(),
        },
        configService: {
          isDev: false,
          platform: 'alipay',
          packageJson: {
            dependencies: {
              'tdesign-miniprogram': '^1.12.3',
            },
          },
          weappViteConfig: {
            npm: {
              alipayNpmMode: 'miniprogram_npm',
            },
          },
        },
      },
      subPackageMeta: {
        subPackage: {
          root: 'pkg',
        },
      },
      entriesMap: new Map(),
      pendingIndependentBuilds: [],
      moduleImporters: new Map(),
      entryModuleIds: new Set(),
      hmrState: {
        didEmitAllEntries: false,
        hasBuiltOnce: false,
      },
      hmrSharedChunksMode: 'auto',
      hmrSharedChunkImporters: new Map(),
    } as any

    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'common.js': {
        type: 'chunk',
        fileName: 'common.js',
        code: 'const toast = require("tdesign-miniprogram/toast/index")',
        imports: [],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['common.js'].code).toContain('/miniprogram_npm/tdesign-miniprogram/toast/index')
  })

  it('rewrites template literal requires for platform npm imports and ignores plugin imports', async () => {
    const state = {
      ctx: {
        scanService: {
          subPackageMap: new Map(),
        },
        configService: {
          isDev: false,
          platform: 'alipay',
          packageJson: {
            dependencies: {
              'tdesign-miniprogram': '^1.12.3',
            },
          },
          weappViteConfig: {},
        },
      },
      subPackageMeta: {
        subPackage: {
          root: 'pkg',
        },
      },
      entriesMap: new Map(),
      pendingIndependentBuilds: [],
      moduleImporters: new Map(),
      entryModuleIds: new Set(),
      hmrState: {
        didEmitAllEntries: false,
        hasBuiltOnce: false,
      },
      hmrSharedChunksMode: 'auto',
      hmrSharedChunkImporters: new Map(),
    } as any

    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'common.js': {
        type: 'chunk',
        fileName: 'common.js',
        code: 'const toast = require(`tdesign-miniprogram/toast/index`); const plugin = require(`plugin://demo/card`)',
        imports: [],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['common.js'].code).toContain('/node_modules/tdesign-miniprogram/toast/index')
    expect(bundle['common.js'].code).toContain('plugin://demo/card')
  })

  it('localizes plugin build npm imports to plugin-local miniprogram_npm', async () => {
    const state = {
      ctx: {
        scanService: {
          subPackageMap: new Map(),
        },
        configService: {
          isDev: false,
          pluginOnly: true,
          platform: 'weapp',
          packageJson: {
            dependencies: {
              'dayjs': '^1.11.13',
              'tdesign-miniprogram': '^1.12.3',
            },
          },
          weappViteConfig: {},
        },
      },
      entriesMap: new Map(),
      pendingIndependentBuilds: [],
      moduleImporters: new Map(),
      entryModuleIds: new Set(),
      hmrState: {
        didEmitAllEntries: false,
        hasBuiltOnce: false,
      },
      hmrSharedChunksMode: 'auto',
      hmrSharedChunkImporters: new Map(),
    } as any

    const hook = createGenerateBundleHook(state, true)
    const bundle = {
      'common.js': {
        type: 'chunk',
        fileName: 'common.js',
        code: 'const dayjs = require("dayjs"); const toast = require("tdesign-miniprogram/toast/index")',
        imports: [],
        dynamicImports: [],
      },
      'pages/demo/index.js': {
        type: 'chunk',
        fileName: 'pages/demo/index.js',
        code: 'const dayjs = require("dayjs")',
        imports: [],
        dynamicImports: [],
      },
      'pages/demo/index.json': {
        type: 'asset',
        fileName: 'pages/demo/index.json',
        source: JSON.stringify({
          usingComponents: {
            't-button': 'tdesign-miniprogram/button/button',
          },
        }),
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['common.js'].code).toContain('./miniprogram_npm/dayjs/index')
    expect(bundle['common.js'].code).toContain('./miniprogram_npm/tdesign-miniprogram/toast/index')
    expect(bundle['pages/demo/index.js'].code).toContain('../../miniprogram_npm/dayjs/index')
    expect(bundle['pages/demo/index.json'].source).toContain('"t-button": "../../miniprogram_npm/tdesign-miniprogram/button/button"')
  })

  it('localizes npm imports to subpackage-local miniprogram_npm when npm subpackage dependencies are declared', async () => {
    const state = {
      ctx: {
        scanService: {
          subPackageMap: new Map([
            ['packageA', {
              subPackage: {
                root: 'packageA',
                dependencies: ['dayjs', /^tdesign-miniprogram$/],
              },
            }],
          ]),
        },
        configService: {
          isDev: false,
          platform: 'weapp',
          packageJson: {
            dependencies: {
              'dayjs': '^1.11.13',
              'tdesign-miniprogram': '^1.12.3',
            },
          },
          weappViteConfig: {
            npm: {
              subPackages: {
                packageA: {
                  dependencies: ['dayjs', /^tdesign-miniprogram$/],
                },
              },
            },
          },
        },
      },
      entriesMap: new Map(),
      pendingIndependentBuilds: [],
      moduleImporters: new Map(),
      entryModuleIds: new Set(),
      hmrState: {
        didEmitAllEntries: false,
        hasBuiltOnce: false,
      },
      hmrSharedChunksMode: 'auto',
      hmrSharedChunkImporters: new Map(),
    } as any

    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'packageA/pages/foo.js': {
        type: 'chunk',
        fileName: 'packageA/pages/foo.js',
        code: 'const dayjs = require(`dayjs`); const t = require("tdesign-miniprogram/toast/index")',
        imports: [],
        dynamicImports: [],
      },
      'packageA/pages/foo.json': {
        type: 'asset',
        fileName: 'packageA/pages/foo.json',
        source: JSON.stringify({
          usingComponents: {
            't-button': 'tdesign-miniprogram/button/button',
          },
        }),
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['packageA/pages/foo.js'].code).toContain('../miniprogram_npm/dayjs/index')
    expect(bundle['packageA/pages/foo.js'].code).toContain('require("../miniprogram_npm/tdesign-miniprogram/toast/index")')
    expect(bundle['packageA/pages/foo.json'].source).toContain('"t-button": "../miniprogram_npm/tdesign-miniprogram/button/button"')
  })
})
