import { describe, expect, it } from 'vitest'
import {
  isSafeJavaScriptPatch,
  isStatefulHmrBoundary,
  redirectNativeComponentRegistration,
  shouldResetStatefulHmrRetention,
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
})
