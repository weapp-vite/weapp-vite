import { describe, expect, it } from 'vitest'
import {
  getChangedStatefulHmrSnapshotAssets,
  isSafeJavaScriptPatch,
  isStatefulHmrAssetFile,
  isStatefulHmrBoundary,
  mergeStatefulHmrSnapshotAssets,
  redirectNativeComponentRegistration,
  requiresStatefulHmrSnapshot,
  shouldResetStatefulHmrRetention,
  shouldRestartStatefulHmrServer,
  shouldUseStatefulHmrSnapshotOnly,
  stampStatefulHmrFullBuild,
} from './session'

describe('stateful hmr session', () => {
  it('only accepts application script and Vue main modules as HMR boundaries', () => {
    const srcRoot = '/project/src'
    const entryIds = new Set([
      '/project/src/pages/index.ts',
      '/project/src/pages/profile.vue',
    ])

    expect(isStatefulHmrBoundary('/project/src/pages/index.ts', srcRoot, entryIds)).toBe(true)
    expect(isStatefulHmrBoundary('/project/src/pages/profile.vue', srcRoot, entryIds)).toBe(true)
    expect(isStatefulHmrBoundary('/project/src/bootstrap/index.ts', srcRoot, entryIds)).toBe(false)
    expect(isStatefulHmrBoundary(
      '/project/src/pages/index.ts?raw&weapp-vite-sidecar-owner=%2Fproject%2Fsrc%2Fpages%2Findex.ts&weapp-vite-sidecar=script&lang.js',
      srcRoot,
      entryIds,
    )).toBe(true)
    expect(isStatefulHmrBoundary('/project/src/pages/index.vue?type=style&lang.css', srcRoot, entryIds)).toBe(false)
    expect(isStatefulHmrBoundary('/project/src/pages/index.vue?type=template', srcRoot, entryIds)).toBe(false)
    expect(isStatefulHmrBoundary(
      '/project/src/pages/index.json?raw&weapp-vite-sidecar-owner=%2Fproject%2Fsrc%2Fpages%2Findex.ts&weapp-vite-sidecar=json&lang.js',
      srcRoot,
      entryIds,
    )).toBe(false)
    expect(isStatefulHmrBoundary('/project/src-other/pages/index.ts', srcRoot, entryIds)).toBe(false)
    expect(isStatefulHmrBoundary('/project/src/pages/index.css', srcRoot, entryIds)).toBe(false)
    expect(isStatefulHmrBoundary('/project/vendor/index.ts', srcRoot, entryIds)).toBe(false)
  })

  it('redirects only unbound native Component registration calls', () => {
    expect(redirectNativeComponentRegistration('Component({ methods: {} })'))
      .toContain('__WEAPP_VITE_STATEFUL_HMR_BRIDGE__"].Component({ methods: {} })')
    expect(redirectNativeComponentRegistration('const Component = factory; Component({})'))
      .toBe('const Component = factory; Component({})')
    expect(redirectNativeComponentRegistration('runtime.Component({})'))
      .toBe('runtime.Component({})')
  })

  it('falls back for non-JavaScript and incompatible engine updates', () => {
    const patch = {
      type: 'Patch',
      code: 'void 0',
      filename: 'update.js',
      hmrBoundaries: [['src/pages/index.ts', 'src/pages/index.ts']],
    } as any

    expect(isSafeJavaScriptPatch(['src/pages/index.ts'], patch)).toBe(true)
    expect(isSafeJavaScriptPatch(['src/pages/index.vue'], patch, ['entry-direct:1'])).toBe(true)
    expect(isSafeJavaScriptPatch(['src/pages/index.vue'], patch, ['entry-local-asset:1'])).toBe(false)
    expect(isSafeJavaScriptPatch(['src/pages/index.vue'], patch, ['entry-style-only:1'])).toBe(false)
    expect(isSafeJavaScriptPatch(['src/pages/index.vue'], patch, ['entry-json-only:1'])).toBe(false)
    expect(isSafeJavaScriptPatch(['src/pages/index.vue'], patch, ['entry-direct:1', 'tailwind-content:1'])).toBe(false)
    expect(isSafeJavaScriptPatch(['src/pages/index.vue'], {
      ...patch,
      changedIds: [
        'src/pages/index.vue?raw&weapp-vite-sidecar-owner=%2Fproject%2Fsrc%2Fpages%2Findex.vue&weapp-vite-sidecar=script&lang.js',
      ],
    }, [], ['/project/src/pages/index.vue'], '/project')).toBe(true)
    expect(isSafeJavaScriptPatch(['/project/src/bootstrap/index.ts'], {
      ...patch,
      changedIds: ['src/bootstrap/index.ts'],
    }, [], ['/project/src/pages/index.vue'], '/project')).toBe(false)
    expect(isSafeJavaScriptPatch(['src/layouts/default.vue'], {
      ...patch,
      changedIds: [
        'src/layouts/default.vue?raw&weapp-vite-sidecar-owner=%2Fproject%2Fsrc%2Flayouts%2Fdefault.vue&weapp-vite-sidecar=script&lang.js',
        'src/layouts/default.vue?raw&weapp-vite-sidecar-owner=%2Fproject%2Fsrc%2Fpages%2Findex.vue&weapp-vite-sidecar=layout&lang.js',
      ],
    }, [], ['/project/src/layouts/default.vue'], '/project')).toBe(false)
    expect(isSafeJavaScriptPatch(['src/pages/index.css'], patch)).toBe(false)
    expect(isSafeJavaScriptPatch(['src/app.json'], patch)).toBe(false)
    expect(isSafeJavaScriptPatch(['src/pages/index.ts'], { type: 'FullReload', reason: 'boundary' } as any)).toBe(false)
  })

  it('resets retained deltas at the count and byte limits', () => {
    expect(shouldResetStatefulHmrRetention(999, 0, 1)).toBe(false)
    expect(shouldResetStatefulHmrRetention(1_000, 0, 1)).toBe(true)
    expect(shouldResetStatefulHmrRetention(0, 16 * 1024 * 1024 - 2, 1)).toBe(false)
    expect(shouldResetStatefulHmrRetention(0, 16 * 1024 * 1024 - 1, 1)).toBe(true)
  })

  it('rebuilds source fallbacks in place and only restarts for config dependencies', () => {
    const configDependencies = ['/project/weapp-vite.config.ts', '/project/shared.config.ts']

    expect(shouldRestartStatefulHmrServer(['/project/src/pages/index.wxml'], configDependencies)).toBe(false)
    expect(shouldRestartStatefulHmrServer(['/project/src/app.css'], configDependencies)).toBe(false)
    expect(shouldRestartStatefulHmrServer(['/project/weapp-vite.config.ts'], configDependencies)).toBe(true)
    expect(shouldRestartStatefulHmrServer(['C:\\project\\shared.config.ts'], ['C:/project/shared.config.ts'])).toBe(true)
    expect(shouldRestartStatefulHmrServer(['/project/src/pages/index/view.tsx'], [], true)).toBe(true)
    expect(shouldRestartStatefulHmrServer(['/project/src/pages/index/view.tsx'], [], { renderMode: 'dynamic' })).toBe(false)
  })

  it('schedules snapshots for sidecars and unsafe script or Vue updates', () => {
    expect(requiresStatefulHmrSnapshot('/project/src/pages/index.wxml')).toBe(true)
    expect(requiresStatefulHmrSnapshot('/project/src/app.css')).toBe(true)
    expect(requiresStatefulHmrSnapshot('/project/src/pages/index.ts')).toBe(false)
    expect(requiresStatefulHmrSnapshot('/project/src/pages/index.jsx', ['entry-direct:1'])).toBe(true)
    expect(requiresStatefulHmrSnapshot('/project/src/pages/index.tsx', ['entry-direct:1'])).toBe(true)
    expect(requiresStatefulHmrSnapshot('/project/src/pages/index.vue', ['entry-direct:1'])).toBe(false)
    expect(requiresStatefulHmrSnapshot('/project/src/pages/index.vue', ['entry-style-only:1'])).toBe(true)
    expect(requiresStatefulHmrSnapshot('/project/src/pages/index.ts', ['tailwind-content:2'])).toBe(true)
    expect(requiresStatefulHmrSnapshot('/project/src/pages/index/view.tsx', ['react-template:1'])).toBe(true)
  })

  it('keeps asset-only Tailwind updates out of the DevEngine full build path', () => {
    expect(shouldUseStatefulHmrSnapshotOnly([
      'entry-local-asset:1',
      'tailwind-content:2',
    ])).toBe(true)
    expect(shouldUseStatefulHmrSnapshotOnly(['entry-style-only:1'])).toBe(true)
    expect(shouldUseStatefulHmrSnapshotOnly(['entry-json-only:1'])).toBe(true)
    expect(shouldUseStatefulHmrSnapshotOnly([
      'entry-direct:1',
      'tailwind-content:2',
    ])).toBe(false)
    expect(shouldUseStatefulHmrSnapshotOnly(['tailwind-content:2'])).toBe(false)
  })

  it('classifies native asset updates without relying on dirty reason labels', () => {
    expect(isStatefulHmrAssetFile('/project/pages/index/index.wxml')).toBe(true)
    expect(isStatefulHmrAssetFile('/project/app.wxss')).toBe(true)
    expect(isStatefulHmrAssetFile('/project/pages/index/index.js')).toBe(false)
    expect(isStatefulHmrAssetFile('/project/src/pages/index.vue')).toBe(false)
  })

  it('stamps every JavaScript chunk in a full build with the same build id', () => {
    const output = [
      { code: 'app();', fileName: 'app.js', type: 'chunk' },
      { code: 'shared();', fileName: 'weapp-vendors/shared.js', type: 'chunk' },
      { fileName: 'app.json', source: '{}', type: 'asset' },
    ] as any

    stampStatefulHmrFullBuild(output, 'build-a')

    expect(output[0].code).toBe('// weapp-vite-stateful-build:build-a\napp();')
    expect(output[1].code).toBe('// weapp-vite-stateful-build:build-a\nshared();')
    expect(output[2]).toEqual({ fileName: 'app.json', source: '{}', type: 'asset' })
  })

  it('keeps stateful chunks while replacing serve-mode assets with snapshot assets', () => {
    const output = [
      { code: 'stateful();', fileName: 'app.js', type: 'chunk' },
      { fileName: 'app.wxss', source: '', type: 'asset' },
      { fileName: 'server-only.json', source: '{}', type: 'asset' },
    ] as any

    mergeStatefulHmrSnapshotAssets(output, [
      { code: 'plain();', fileName: 'app.js', type: 'chunk' },
      { fileName: 'app.wxss', source: '.bg{}', type: 'asset' },
      { fileName: 'pages/index/index.wxml', source: '<view/>', type: 'asset' },
    ] as any)

    expect(output).toEqual([
      { code: 'stateful();', fileName: 'app.js', type: 'chunk' },
      { fileName: 'app.wxss', source: '.bg{}', type: 'asset' },
      { fileName: 'server-only.json', source: '{}', type: 'asset' },
      { fileName: 'pages/index/index.wxml', source: '<view/>', type: 'asset' },
    ])
  })

  it('only submits changed snapshot assets during a refresh', () => {
    const changed = getChangedStatefulHmrSnapshotAssets([
      { fileName: 'app.wxss', source: '.same{}', type: 'asset' },
      { fileName: 'pages/index/index.wxml', source: '<view/>', type: 'asset' },
    ], [
      { fileName: 'app.wxss', source: '.same{}', type: 'asset' },
      { fileName: 'pages/index/index.wxml', source: '<view class="updated"/>', type: 'asset' },
      { fileName: 'pages/about/index.wxml', source: '<view/>', type: 'asset' },
    ])

    expect(changed).toEqual([
      { fileName: 'pages/index/index.wxml', source: '<view class="updated"/>', type: 'asset' },
      { fileName: 'pages/about/index.wxml', source: '<view/>', type: 'asset' },
    ])
  })
})
