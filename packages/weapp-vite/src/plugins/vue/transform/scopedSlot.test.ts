import { describe, expect, it, vi } from 'vitest'
import {
  emitScopedSlotAssets,
  emitScopedSlotChunks,
  getScopedSlotClassStyleWxs,
  isScopedSlotVirtualId,
  loadScopedSlotModule,
  resolveScopedSlotVirtualId,
  shouldResetScopedSlotCache,
} from './scopedSlot'

const createJsonMergerMock = vi.hoisted(() => vi.fn(() => (base: Record<string, any>, next: Record<string, any>) => ({ ...base, ...next })))
const emitClassStyleWxsAssetIfMissingMock = vi.hoisted(() => vi.fn())
const resolveJsonMock = vi.hoisted(() => vi.fn())

vi.mock('wevu/compiler', () => ({
  createJsonMerger: createJsonMergerMock,
  buildClassStyleComputedCode: vi.fn(() => '() => ({})'),
  getClassStyleWxsSource: vi.fn(() => 'module.exports = {};'),
  WE_VU_MODULE_ID: 'wevu',
  WE_VU_RUNTIME_APIS: {
    createWevuScopedSlotComponent: 'createWevuScopedSlotComponent',
  },
}))

vi.mock('./emitAssets', () => ({
  emitClassStyleWxsAssetIfMissing: emitClassStyleWxsAssetIfMissingMock,
}))

vi.mock('../../../utils', () => ({
  resolveJson: resolveJsonMock,
}))

describe('scoped slot helpers', () => {
  it('returns early when no scoped slot assets or chunks need emitting', () => {
    const emitFile = vi.fn()

    emitScopedSlotAssets(
      { emitFile },
      {},
      'pages/index/index',
      {} as any,
    )
    emitScopedSlotChunks(
      { emitFile },
      'pages/index/index',
      {} as any,
      new Map(),
      new Set(),
    )

    expect(emitFile).not.toHaveBeenCalled()
  })

  it('emits scoped slot assets and normalizes malformed json config', () => {
    const emitFile = vi.fn()
    const result: any = {
      config: '{ bad json }',
      scopedSlotComponents: [
        {
          id: 'slot-0',
          componentName: 'ScopedComp',
          template: '<view/>',
          classStyleWxs: true,
        },
      ],
    }
    const bundle: Record<string, any> = {}

    emitScopedSlotAssets(
      { emitFile },
      bundle,
      'pages/index/index',
      result,
      {
        configService: { platform: 'weapp' } as any,
      } as any,
      {
        fileName: '__weapp_vite_class_style.wxs',
        source: 'module.exports = {};',
      },
      { wxml: 'wxml', json: 'json' } as any,
      { defaults: { virtualHost: true } },
    )

    expect(emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: 'pages/index/index.__scoped-slot-slot-0.wxml',
      source: '<view/>',
    })
    expect(emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: 'pages/index/index.__scoped-slot-slot-0.json',
      source: JSON.stringify({
        component: true,
        styleIsolation: 'apply-shared',
        usingComponents: {},
        virtualHost: true,
      }, null, 2),
    })
    expect(emitClassStyleWxsAssetIfMissingMock).toHaveBeenCalledWith(
      { emitFile },
      bundle,
      '__weapp_vite_class_style.wxs',
      'module.exports = {};',
    )

    expect(JSON.parse(result.config)).toEqual({
      usingComponents: {
        ScopedComp: '/pages/index/index.__scoped-slot-slot-0',
      },
    })
  })

  it('resolves auto imported scoped slot dependencies and normalizes alipay config', () => {
    resolveJsonMock.mockImplementation(({ json }: { json: Record<string, any> }) => JSON.stringify({ ...json, normalized: true }))

    const emitFile = vi.fn()
    const result: any = {
      config: JSON.stringify({
        usingComponents: {
          Existing: '/components/existing',
        },
      }),
      scopedSlotComponents: [
        {
          id: 'slot-auto',
          componentName: 'ScopedAutoComp',
          template: '<view><Existing/><AutoA/><AutoDup/><Missing/></view>',
        },
      ],
    }

    emitScopedSlotAssets(
      { emitFile },
      {},
      'pages/index/index',
      result,
      {
        autoImportService: {
          resolve: (name: string) => {
            if (name === 'AutoA') {
              return { value: { name: 'AutoAResolved', from: '/auto/a' } }
            }
            if (name === 'AutoDup') {
              return { value: { name: 'AutoAResolved', from: '/auto/dup' } }
            }
            return null
          },
        },
        wxmlService: {
          analyze: () => ({
            components: {
              Existing: true,
              AutoA: true,
              AutoDup: true,
              Missing: true,
            },
          }),
        },
        configService: {
          platform: 'alipay',
          packageJson: { dependencies: { foo: '1.0.0' } },
          weappViteConfig: { npm: { alipayNpmMode: 'miniprogram_npm' } },
        },
      } as any,
      undefined,
      { wxml: 'wxml', json: 'json' } as any,
    )

    const emittedJson = emitFile.mock.calls.find(call => call[0].fileName.endsWith('.json'))?.[0]
    expect(emittedJson).toBeTruthy()
    expect(JSON.parse(emittedJson.source)).toMatchObject({
      usingComponents: {
        Existing: '/components/existing',
        AutoAResolved: '/auto/a',
      },
      normalized: true,
    })
    expect(JSON.parse(result.config)).toMatchObject({
      usingComponents: {
        Existing: '/components/existing',
        ScopedAutoComp: '/pages/index/index.__scoped-slot-slot-auto',
      },
      normalized: true,
    })
  })

  it('falls back to base usingComponents when scoped slot auto import analyze fails', () => {
    const emitFile = vi.fn()
    const result: any = {
      config: JSON.stringify({
        usingComponents: {
          Existing: '/components/existing',
        },
      }),
      scopedSlotComponents: [
        {
          id: 'slot-fallback',
          componentName: 'ScopedFallbackComp',
          template: '<view><AutoA/></view>',
        },
      ],
    }

    emitScopedSlotAssets(
      { emitFile },
      {},
      'pages/index/index',
      result,
      {
        autoImportService: {
          resolve: () => ({ value: { name: 'AutoAResolved', from: '/auto/a' } }),
        },
        wxmlService: {
          analyze: () => {
            throw new Error('failed to analyze')
          },
        },
      } as any,
      undefined,
      { wxml: 'wxml', json: 'json' } as any,
    )

    const emittedJson = emitFile.mock.calls.find(call => call[0].fileName.endsWith('.json'))?.[0]
    expect(emittedJson).toBeTruthy()
    expect(JSON.parse(emittedJson.source).usingComponents).toEqual({
      Existing: '/components/existing',
    })
  })

  it('skips emitting scoped slot asset files when bundle already has targets', () => {
    const emitFile = vi.fn()
    const result: any = {
      config: JSON.stringify({
        usingComponents: {
          Existing: '/components/existing',
        },
      }),
      scopedSlotComponents: [
        {
          id: 'slot-1',
          componentName: 'ScopedComp',
          template: '<view/>',
        },
      ],
    }
    const bundle: Record<string, any> = {
      'pages/index/index.__scoped-slot-slot-1.wxml': { type: 'asset' },
      'pages/index/index.__scoped-slot-slot-1.json': { type: 'asset' },
    }

    emitScopedSlotAssets(
      { emitFile },
      bundle,
      'pages/index/index',
      result,
      undefined,
      undefined,
      { wxml: 'wxml', json: 'json' } as any,
    )

    expect(emitFile).not.toHaveBeenCalled()
    expect(JSON.parse(result.config).usingComponents).toEqual({
      Existing: '/components/existing',
      ScopedComp: '/pages/index/index.__scoped-slot-slot-1',
    })
  })

  it('emits scoped slot chunk module without computed and inline overrides', () => {
    const emitFile = vi.fn()
    const scopedSlotModules = new Map<string, string>()
    const emittedScopedSlotChunks = new Set<string>()
    const result: any = {
      scopedSlotComponents: [
        {
          id: 'slot-plain',
        },
      ],
    }

    emitScopedSlotChunks(
      { emitFile },
      'pages/index/index',
      result,
      scopedSlotModules,
      emittedScopedSlotChunks,
      { js: 'js' } as any,
    )

    const [virtualId] = Array.from(scopedSlotModules.keys())
    const code = scopedSlotModules.get(virtualId)!
    expect(code).toContain(`import { createWevuScopedSlotComponent as _createWevuScopedSlotComponent } from 'wevu';`)
    expect(code).toContain('createWevuScopedSlotComponent();')
    expect(code).not.toContain('__wevuComputed')
    expect(code).not.toContain('__wevuInlineMap')
  })

  it('emits scoped slot chunks once and caches generated virtual modules', () => {
    const emitFile = vi.fn()
    const scopedSlotModules = new Map<string, string>()
    const emittedScopedSlotChunks = new Set<string>()
    const result: any = {
      scopedSlotComponents: [
        {
          id: 'slot-0',
          classStyleBindings: [{ name: 'x', expression: 'y' }],
          inlineExpressions: [
            {
              id: 'exp-0',
              scopeKeys: ['item'],
              expression: 'scope.item',
            },
          ],
        },
      ],
    }

    emitScopedSlotChunks(
      { emitFile },
      'pages/index/index',
      result,
      scopedSlotModules,
      emittedScopedSlotChunks,
      { js: 'js' } as any,
    )
    emitScopedSlotChunks(
      { emitFile },
      'pages/index/index',
      result,
      scopedSlotModules,
      emittedScopedSlotChunks,
      { js: 'js' } as any,
    )

    expect(emitFile).toHaveBeenCalledTimes(1)
    expect(emitFile.mock.calls[0]?.[0]).toMatchObject({
      type: 'chunk',
      fileName: 'pages/index/index.__scoped-slot-slot-0.js',
    })
    const [virtualId] = Array.from(scopedSlotModules.keys())
    const code = scopedSlotModules.get(virtualId)!
    expect(code).toContain('createWevuScopedSlotComponent')
    expect(loadScopedSlotModule(virtualId, scopedSlotModules)).toEqual({ code, map: null })
  })

  it('handles scoped slot virtual id helpers and cache guards', () => {
    const moduleMap = new Map<string, string>()
    const virtualId = '\0weapp-vite:scoped-slot:pages/index/index.__scoped-slot-slot-2'
    moduleMap.set(virtualId, 'export default {}')

    expect(resolveScopedSlotVirtualId(virtualId)).toBe(virtualId)
    expect(resolveScopedSlotVirtualId('pages/index/index.js')).toBeNull()
    expect(isScopedSlotVirtualId(virtualId)).toBe(true)
    expect(isScopedSlotVirtualId('foo')).toBe(false)
    expect(loadScopedSlotModule('foo', moduleMap)).toBeNull()
    expect(loadScopedSlotModule('\0weapp-vite:scoped-slot:missing', moduleMap)).toBeNull()
    expect(shouldResetScopedSlotCache('/project/src/pages/index.vue')).toBe(true)
    expect(shouldResetScopedSlotCache('/project/src/pages/index.ts')).toBe(false)
    expect(getScopedSlotClassStyleWxs()).toBe('module.exports = {};')
  })
})
