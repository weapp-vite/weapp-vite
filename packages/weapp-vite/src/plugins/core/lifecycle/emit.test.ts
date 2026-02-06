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

  it('rewrites alipay npm requires to miniprogram_npm', async () => {
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

    expect(bundle['common.js'].code).toContain('/miniprogram_npm/tdesign-miniprogram/toast/index')
  })
})
