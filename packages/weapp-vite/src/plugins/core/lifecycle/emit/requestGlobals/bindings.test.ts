import type { OutputBundle, OutputChunk } from 'rolldown'
import vm from 'node:vm'
import { REQUEST_GLOBAL_INSTALLER_MARKER, REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { createRequestGlobalsPassiveBindingsCode, FULL_REQUEST_GLOBAL_TARGETS } from '../../../../../runtime/config/internal/injectRequestGlobals'
import { injectRequestGlobalsBundleRuntime, injectRequestGlobalsLocalBindings, injectRequestGlobalsPassiveBindings } from '../requestGlobals'

function execute(code: string) {
  const context = vm.createContext({ module: { exports: {} }, exports: {} })
  vm.runInContext(`(function(exports) {${code}\n})(exports)`, context)
  return context
}

function fixture(code: string): OutputBundle {
  return { 'support.js': { type: 'chunk', fileName: 'support.js', code } as OutputChunk }
}

const declarations = [
  `function fetch() { return 'own-fetch'; }`,
  `var fetch; function fetch() { return 'own-fetch'; }`,
  `const { fetch } = { fetch: () => 'own-fetch' };`,
  `if (true) { var fetch = () => 'own-fetch'; }`,
]

describe('request globals preserve output bindings', () => {
  it.each(declarations)('preserves existing declarations in passive chunks: %s', (declaration) => {
    const bundle = fixture(`${declaration}\nexports.value = fetch();`)
    injectRequestGlobalsPassiveBindings(bundle, new Map(), ['fetch'], 'explicit', undefined)
    const result = execute((bundle['support.js'] as OutputChunk).code)
    expect(result.exports.value).toBe('own-fetch')
  })

  it.each([false, true])('preserves local entry bindings with installer=%s', (hasInstaller) => {
    const bundle = fixture(`function fetch() { return 'own-fetch'; }
      ${hasInstaller ? `const runtime = require('./runtime.js');` : ''}
      exports.value = fetch();`)
    injectRequestGlobalsLocalBindings(bundle, new Map([['runtime.js', 'install']]), ['fetch'], 'explicit', new Map([['support', { type: 'page' }]]))
    const context = vm.createContext({ exports: {}, require: () => ({ install: () => ({ fetch: () => 'host-fetch' }) }) })
    vm.runInContext(`(function(exports, require) {${(bundle['support.js'] as OutputChunk).code}\n})(exports, require)`, context)
    expect(context.exports.value).toBe('own-fetch')
  })

  it('preserves all locally implemented installer targets without recreating an empty binding selection', () => {
    const bundle = fixture(`const { URL } = { URL: class { value() { return 'own-url'; } } };
      function installWebRuntimeGlobals() { const targets = ${JSON.stringify(FULL_REQUEST_GLOBAL_TARGETS)}; return { URL }; }
      exports.installWebRuntimeGlobals = installWebRuntimeGlobals;
      exports.value = new URL().value();`)
    injectRequestGlobalsBundleRuntime(bundle, ['URL'], 'explicit')
    const result = execute((bundle['support.js'] as OutputChunk).code)
    expect(result.exports.value).toBe('own-url')
    expect(new result.URL().value()).toBe('own-url')
  })

  it('updates generated placeholders during local installation without overwriting original bindings', () => {
    const bundle = fixture(`const runtime = require('./base.js');
      function fetch() { return 'own-fetch'; }
      function installWebRuntimeGlobals() { const targets = ${JSON.stringify(FULL_REQUEST_GLOBAL_TARGETS)}; return { fetch, URL: runtime.URL }; }
      exports.installWebRuntimeGlobals = installWebRuntimeGlobals;
      exports.value = fetch(); exports.url = new URL().value();`)
    const installers = injectRequestGlobalsBundleRuntime(bundle, ['fetch'], 'explicit')
    injectRequestGlobalsLocalBindings(bundle, installers, ['fetch'], 'explicit', new Map([['support', { type: 'page' }]]))
    const context = vm.createContext({ exports: {}, require: () => ({ URL: class {
      value() {
        return 'host-url'
      }
    } }) })
    vm.runInContext(`(function(exports, require) {${(bundle['support.js'] as OutputChunk).code}\n})(exports, require)`, context)
    expect(context.exports.value).toBe('own-fetch')
    expect(context.exports.url).toBe('host-url')
  })

  it('does not turn an explicitly empty passive selection into all targets', () => {
    expect(createRequestGlobalsPassiveBindingsCode(['fetch'], [])).toBe('')
  })

  it('makes atob/btoa callable while a third-party dependency initializes before the installer', () => {
    const bundle = fixture(`exports.decoded = atob("QQ=="); exports.encoded = btoa("AB");`)
    injectRequestGlobalsPassiveBindings(bundle, new Map(), ['atob', 'btoa'], 'explicit', undefined)
    const result = execute((bundle['support.js'] as OutputChunk).code)
    expect(result.exports.decoded).toBe('A')
    expect(result.exports.encoded).toBe('QUI=')
  })

  it('installs base64 globals before an installer chunk evaluates its own module code', () => {
    const bundle = fixture(`exports.decoded = atob("QQ==");
      function installWebRuntimeGlobals() { return { atob: globalThis.atob, btoa: globalThis.btoa }; }
      Object.defineProperty(installWebRuntimeGlobals, ${JSON.stringify(REQUEST_GLOBAL_INSTALLER_MARKER)}, { value: true });
      exports.installWebRuntimeGlobals = installWebRuntimeGlobals;`)
    injectRequestGlobalsBundleRuntime(bundle, ['atob', 'btoa'], 'explicit')
    const result = execute((bundle['support.js'] as OutputChunk).code)
    expect(result.exports.decoded).toBe('A')
  })

  it('injects passive bindings into ky-style globalThis capability probes', () => {
    const bundle = fixture(`exports.supportsRequest = typeof globalThis.Request === "function";
      exports.supportsAbortController = typeof globalThis.AbortController === "function";
      exports.supportsResponseStreams = typeof globalThis.ReadableStream === "function";`)
    injectRequestGlobalsPassiveBindings(bundle, new Map(), FULL_REQUEST_GLOBAL_TARGETS, 'auto', undefined)
    const code = (bundle['support.js'] as OutputChunk).code

    expect(code).toContain(REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER)
    expect(code).toContain('var Request =')
    expect(code).toContain('var AbortController =')
    expect(code).toContain('var ReadableStream =')
  })

  it('lets ky-style capability probes finish in a dependency chunk before the installer runs', () => {
    const bundle = fixture(`exports.streamError = (() => {
      try { new globalThis.ReadableStream(); return null } catch (error) { return String(error) }
    })();
    exports.supportsRequestStreams = (() => {
      let duplexAccessed = false
      try {
        const request = new globalThis.Request("https://empty.invalid", {
          body: new globalThis.ReadableStream(),
          method: "POST",
          get duplex() { duplexAccessed = true; return "half" },
        })
        return duplexAccessed && !request.headers.has("Content-Type")
      } catch { return false }
    })();
    exports.abortSignalAborted = (() => {
      const controller = new globalThis.AbortController()
      controller.abort()
      return controller.signal.aborted
    })();`)
    injectRequestGlobalsPassiveBindings(bundle, new Map(), FULL_REQUEST_GLOBAL_TARGETS, 'explicit', undefined)
    const result = execute((bundle['support.js'] as OutputChunk).code)

    expect(result.exports.streamError).toBeNull()
    expect(result.exports.supportsRequestStreams).toBe(false)
    expect(result.exports.abortSignalAborted).toBe(true)
  })

  it('initializes streaming constructors before a dependency evaluates its superclass', () => {
    class HostTransformStream {}
    class HostEventSource {
      constructor(readonly url: string) {}
    }
    const bundle = fixture(`const runtime = require('./runtime.js');
      exports.Parser = class extends TransformStream {};
      exports.source = new EventSource('https://sse.invalid/events');`)
    injectRequestGlobalsLocalBindings(
      bundle,
      new Map([['runtime.js', 'install']]),
      ['EventSource', 'TextDecoderStream'],
      'explicit',
      new Map([['support', { type: 'page' }]]),
    )
    const context = vm.createContext({
      exports: {},
      require: () => ({
        install: () => ({ EventSource: HostEventSource, TransformStream: HostTransformStream }),
      }),
    })
    vm.runInContext(`(function(exports, require) {${(bundle['support.js'] as OutputChunk).code}\n})(exports, require)`, context)
    expect(context.exports.Parser.prototype).toBeInstanceOf(HostTransformStream)
    expect(context.exports.source.url).toBe('https://sse.invalid/events')
  })
})
