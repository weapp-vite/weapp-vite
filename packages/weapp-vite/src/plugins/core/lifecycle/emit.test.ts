import { describe, expect, it } from 'vitest'
import { createGenerateBundleHook } from './emit'

describe('core lifecycle emit hook injectWeapi', () => {
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

  it('rewrites unsafe dynamic global resolution in bundle chunks to globalThis', async () => {
    const state = {
      ctx: {
        scanService: {
          subPackageMap: new Map(),
        },
        configService: {
          isDev: false,
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
        code: 'const host = typeof self<"u"?self:typeof window<"u"?window:Function("return this")()',
        imports: [],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['common.js'].code).toContain('globalThis')
    expect(bundle['common.js'].code).not.toContain('Function("return this")()')
    expect(bundle['common.js'].code).not.toContain('typeof self<"u"?self:typeof window<"u"?window:globalThis')
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

  it('localizes main package npm imports to relative miniprogram_npm paths for weapp build output', async () => {
    const state = {
      ctx: {
        scanService: {
          subPackageMap: new Map(),
        },
        configService: {
          isDev: false,
          platform: 'weapp',
          packageJson: {
            dependencies: {
              'tdesign-miniprogram': '^1.12.3',
            },
          },
          weappViteConfig: {},
        },
      },
      subPackageMeta: null,
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
      'pages/dialog-bare/index.js': {
        type: 'chunk',
        fileName: 'pages/dialog-bare/index.js',
        code: 'const dialog = require("tdesign-miniprogram/dialog")',
        imports: [],
        dynamicImports: [],
      },
      'pages/dialog-index/index.js': {
        type: 'chunk',
        fileName: 'pages/dialog-index/index.js',
        code: 'const dialog = require("tdesign-miniprogram/dialog/index")',
        imports: [],
        dynamicImports: [],
      },
      'pages/dialog-bare/index.json': {
        type: 'asset',
        fileName: 'pages/dialog-bare/index.json',
        source: JSON.stringify({
          usingComponents: {
            't-dialog': 'tdesign-miniprogram/dialog/dialog',
          },
        }),
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['pages/dialog-bare/index.js'].code).toContain('../../miniprogram_npm/tdesign-miniprogram/dialog/index')
    expect(bundle['pages/dialog-bare/index.js'].code).not.toContain('require("tdesign-miniprogram/dialog")')
    expect(bundle['pages/dialog-index/index.js'].code).toContain('../../miniprogram_npm/tdesign-miniprogram/dialog/index')
    expect(bundle['pages/dialog-bare/index.json'].source).toContain('"t-dialog": "../../miniprogram_npm/tdesign-miniprogram/dialog/dialog"')
  })

  it('rewrites alipay npm requires for explicit include from devDependencies', async () => {
    const state = {
      ctx: {
        scanService: {
          subPackageMap: new Map(),
        },
        configService: {
          isDev: false,
          platform: 'alipay',
          packageJson: {
            devDependencies: {
              dayjs: '^1.11.13',
            },
          },
          weappViteConfig: {
            npm: {
              include: ['dayjs'],
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
        code: 'const dayjs = require("dayjs")',
        imports: [],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['common.js'].code).toContain('/node_modules/dayjs')
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

  it('only localizes plugin build npm imports for explicit npm candidates', async () => {
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

    expect(bundle['common.js'].code).toContain('require("dayjs")')
    expect(bundle['common.js'].code).toContain('./miniprogram_npm/tdesign-miniprogram/toast/index')
    expect(bundle['pages/demo/index.js'].code).toContain('require("dayjs")')
    expect(bundle['pages/demo/index.json'].source).toContain('"t-button": "../../miniprogram_npm/tdesign-miniprogram/button/button"')
  })

  it('localizes plugin build npm imports for explicit plugin dependencies from devDependencies', async () => {
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
            devDependencies: {
              dayjs: '^1.11.13',
            },
          },
          weappViteConfig: {
            npm: {
              pluginPackage: {
                dependencies: ['dayjs'],
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

    const hook = createGenerateBundleHook(state, true)
    const bundle = {
      'common.js': {
        type: 'chunk',
        fileName: 'common.js',
        code: 'const dayjs = require("dayjs")',
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
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['common.js'].code).toContain('./miniprogram_npm/dayjs/index')
    expect(bundle['pages/demo/index.js'].code).toContain('../../miniprogram_npm/dayjs/index')
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
