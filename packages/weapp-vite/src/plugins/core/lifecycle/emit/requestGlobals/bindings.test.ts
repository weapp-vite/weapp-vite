import type { OutputBundle, OutputChunk } from 'rolldown'
import vm from 'node:vm'
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
})
