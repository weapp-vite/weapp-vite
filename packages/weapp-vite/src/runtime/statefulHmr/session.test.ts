import { describe, expect, it } from 'vitest'
import {
  isSafeJavaScriptPatch,
  isStatefulHmrBoundary,
  redirectNativeComponentRegistration,
  shouldResetStatefulHmrRetention,
} from './session'

describe('stateful hmr session', () => {
  it('only accepts application script and Vue main modules as HMR boundaries', () => {
    const srcRoot = '/project/src'

    expect(isStatefulHmrBoundary('/project/src/pages/index.ts', srcRoot)).toBe(true)
    expect(isStatefulHmrBoundary('/project/src/pages/index.vue', srcRoot)).toBe(true)
    expect(isStatefulHmrBoundary('/project/src/pages/index.vue?type=style&lang.css', srcRoot)).toBe(false)
    expect(isStatefulHmrBoundary('/project/src/pages/index.vue?type=template', srcRoot)).toBe(false)
    expect(isStatefulHmrBoundary('/project/src/pages/index.css', srcRoot)).toBe(false)
    expect(isStatefulHmrBoundary('/project/vendor/index.ts', srcRoot)).toBe(false)
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
})
