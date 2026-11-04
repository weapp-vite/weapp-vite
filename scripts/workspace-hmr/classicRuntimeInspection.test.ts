import { parse } from '@babel/parser'
import { transformWithOxc } from 'vite'
import { describe, expect, it } from 'vitest'
import { inspectClassicEmittedScript } from './classicRuntimeInspection'

const declaration = 'const key = "__WEAPP_VITE_STATEFUL_HMR_BRIDGE__";'

async function lower(source: string) {
  const { code } = await transformWithOxc(`${declaration} ${source}`, 'runtime-probe.js', { target: 'es6' })
  expect(code).not.toContain('?.')
  return parse(code)
}

describe('classic runtime compiler-lowered readonly probes', () => {
  it.each([
    'if (typeof readHost()?.[key]?.trackWevuComponent === "function") inspectSnapshot();',
    'const bridge = readHost()?.[key]; if (typeof bridge?.Component === "function") bridge.Component({}); else Component({});',
    'let bridge; bridge = readHost()?.[key]; const alias = bridge; if (typeof alias?.Page === "function") alias.Page({}); else Page({});',
  ])('keeps a real ES6 compiler lowering of the readonly probe: %s', async (source) => {
    const ast = await lower(source)
    expect(() => inspectClassicEmittedScript(ast)).not.toThrow()
  })

  it.each([
    'readHost()[key];',
    'readHost()[key] = {};',
    'const bridge = readHost()?.[key]; bridge.installNative("Page", Page);',
    'let bridge; bridge = readHost()?.[key]; const alias = bridge; alias.takeNativeDefinitions();',
    'const { installNative: install } = readHost()?.[key]; install("Page", Page);',
    'let bridge; ({ takeNativeDefinitions: bridge } = readHost()?.[key]); bridge();',
    'let first, second; first = readHost()?.[key]; second = first; first = second; second.installNative("Page", Page);',
    '(readHost()?.[key]).installNative("Page", Page);',
    'readHost()?.[key]?.takeNativeDefinitions?.();',
    'const { [key]: bridge } = readHost(); bridge.Page({});',
  ])('keeps rejecting retained registrations and aliases after compiler lowering: %s', async (source) => {
    const ast = await lower(source)
    expect(() => inspectClassicEmittedScript(ast)).toThrow('active stateful bridge')
  })

  it.each([
    'host == null ? void 0 : (host[key] = {});',
    'host == null ? void 0 : delete host[key];',
    'host == null ? void 0 : host[key]++;',
    'host === null ? void 0 : host[key];',
    'host === null || other === void 0 ? void 0 : host[key];',
    'host === null && host === void 0 ? void 0 : host[key];',
    'host == null ? void 0 : (host = other, host[key]);',
    'host === null || (host = other) === void 0 ? void 0 : host[key];',
    'host === null || sideEffect() || host === void 0 ? void 0 : host[key];',
    'readHost() == null ? void 0 : readHost()[key];',
    'function probe(undefined) { return host === null || host === undefined ? void 0 : host[key]; }',
  ])('does not treat an unsafe or incomplete guard as an optional readonly probe: %s', (source) => {
    expect(() => inspectClassicEmittedScript(parse(`${declaration} ${source}`))).toThrow('active stateful bridge')
  })
})
