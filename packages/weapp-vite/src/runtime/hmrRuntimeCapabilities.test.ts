import { describe, expect, it } from 'vitest'
import { getHmrRuntimeCapabilityFallback, HMR_RUNTIME_CAPABILITIES, HmrRuntimeCapabilityError, resolveStatefulHmrInputFallback } from './hmrRuntimeCapabilities'

describe('stateful HMR capability admission', () => {
  it('requires an actual classic transition for an unsupported provider instead of requesting another stateful snapshot', () => {
    expect(resolveStatefulHmrInputFallback({ files: ['src/pages/home.vue'], providerSupported: false })).toMatchObject({ code: 'compiler-provider' })
  })

  it.each([
    { files: ['src/app.json'], code: 'config-json' },
    { files: ['src/pages/home.vue'], dirtyReasons: ['entry-mixed-config:1'], code: 'config-json' },
    { files: ['src/pages/home/index.json'], dirtyReasons: ['json-sidecar:2'], configurationChanged: false, code: 'config-json' },
    { files: ['src/pages/home/index.js'], dirtyReasons: ['json-sidecar:1', 'tailwind-content:1'], configurationChanged: false, code: 'config-json' },
    { files: ['src/pages/new.vue'], dirtyReasons: ['entry-graph-changed'], code: 'entry-topology' },
    { files: ['src/shared.ts'], updateType: 'FullReload', code: 'engine-full-reload' },
  ])('classifies $code before publishing an unsupported update', ({ code, ...input }) => {
    expect(resolveStatefulHmrInputFallback(input)?.code).toBe(code)
  })

  it.each([
    { files: ['src/shared.ts'], updateType: 'Patch' },
    { files: ['src/pages/home.vue'], dirtyReasons: ['entry-mixed-asset:1'], updateType: 'Patch' },
    { files: ['src/style.css'], dirtyReasons: ['entry-style-only:1'] },
    { files: ['public/icon.png'] },
    { files: ['tokens.json'], configurationChanged: false },
    { files: ['template-rules.json'], dirtyReasons: ['wxml-transform-dependency:1', 'tailwind-content:1'], configurationChanged: false },
  ])('keeps a supported patch or visual update stateful: $files', (input) => {
    expect(resolveStatefulHmrInputFallback(input)).toBeUndefined()
  })

  it.each([undefined, 'Noop', 'Patch'])('rejects changed external CSS bindings before relying on the native update: %s', (updateType) => {
    expect(resolveStatefulHmrInputFallback({
      files: ['src/pages/home/alternate.css'],
      dirtyReasons: ['entry-style-bindings:1'],
      updateType,
    })).toMatchObject({ code: 'patch-shape', files: ['src/pages/home/alternate.css'] })
  })

  it('preserves syntax, filesystem, business and IDE errors as errors', () => {
    for (const error of [new SyntaxError('invalid syntax'), Object.assign(new Error('read failed'), { code: 'EACCES' }), new TypeError('setup failed'), new Error('IDE disconnected')]) {
      expect(getHmrRuntimeCapabilityFallback(error)).toBeUndefined()
    }
    const fallback = { code: 'patch-shape' as const, message: 'unsupported external owner' }
    expect(getHmrRuntimeCapabilityFallback(new HmrRuntimeCapabilityError(fallback))).toBe(fallback)
  })

  it('gives every capability a unique stable identifier', () => {
    expect(new Set(HMR_RUNTIME_CAPABILITIES.map(item => item.id)).size).toBe(HMR_RUNTIME_CAPABILITIES.length)
  })
})
