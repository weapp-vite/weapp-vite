import { afterEach, describe, expect, it, vi } from 'vitest'
import { setRuntimeExecutionMode } from '../src/runtime/execution'
import {
  createChildScope,
  createScope,
  escapeAttribute,
  escapeHtml,
  evaluateExpression,
  interpolateText,
  normalizeList,
  resolveAttributeValue,
} from '../src/runtime/legacyTemplate/expression'
import { setRuntimeWarningOptions } from '../src/runtime/warning'

afterEach(() => {
  setRuntimeExecutionMode()
  setRuntimeWarningOptions()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.resetModules()
  vi.doUnmock('../src/runtime/style')
})

async function loadStyleModule(moduleId: '../src/runtime/button/style' | '../src/runtime/nativeComponents/style') {
  const injectStyle = vi.fn()
  vi.doMock('../src/runtime/style', () => ({ injectStyle }))
  const module = moduleId === '../src/runtime/button/style'
    ? await import('../src/runtime/button/style')
    : await import('../src/runtime/nativeComponents/style')
  return { injectStyle, module }
}

describe('runtime style installation contracts', () => {
  it('installs button styles into the document once and handles missing hosts', async () => {
    const { injectStyle, module } = await loadStyleModule('../src/runtime/button/style')
    const ensureButtonStyle = (module as typeof import('../src/runtime/button/style')).ensureButtonStyle

    vi.stubGlobal('document', undefined)
    ensureButtonStyle()
    expect(injectStyle).not.toHaveBeenCalled()

    vi.stubGlobal('document', { head: null })
    ensureButtonStyle()
    expect(injectStyle).not.toHaveBeenCalled()

    const head = {}
    vi.stubGlobal('document', { head })
    ensureButtonStyle()
    ensureButtonStyle()
    expect(injectStyle).toHaveBeenCalledTimes(1)
  })

  it('uses constructable button stylesheets and falls back to style elements', async () => {
    const { module } = await loadStyleModule('../src/runtime/button/style')
    const ensureButtonStyle = (module as typeof import('../src/runtime/button/style')).ensureButtonStyle
    const replaceSync = vi.fn()
    class StyleSheet {
      replaceSync(css: string) {
        replaceSync(css)
      }
    }
    vi.stubGlobal('CSSStyleSheet', StyleSheet)

    const adoptedDocument = { adoptedStyleSheets: [], createElement: vi.fn() }
    vi.stubGlobal('document', adoptedDocument)
    const firstRoot = {
      adoptedStyleSheets: [] as unknown[],
      appendChild: vi.fn(),
      ownerDocument: adoptedDocument,
    }
    ensureButtonStyle(firstRoot as unknown as ShadowRoot)
    ensureButtonStyle(firstRoot as unknown as ShadowRoot)
    expect(firstRoot.adoptedStyleSheets).toHaveLength(1)
    expect(replaceSync).toHaveBeenCalledOnce()

    const sharedSheet = firstRoot.adoptedStyleSheets[0]
    const secondRoot = {
      adoptedStyleSheets: [sharedSheet],
      appendChild: vi.fn(),
      ownerDocument: adoptedDocument,
    }
    ensureButtonStyle(secondRoot as unknown as ShadowRoot)
    expect(secondRoot.adoptedStyleSheets).toEqual([sharedSheet])

    const ownerlessRoot = { adoptedStyleSheets: undefined, appendChild: vi.fn() }
    ensureButtonStyle(ownerlessRoot as unknown as ShadowRoot)
    expect(ownerlessRoot.adoptedStyleSheets).toEqual([sharedSheet])

    const style = {} as { id?: string, textContent?: string }
    const fallbackDocument = { createElement: vi.fn(() => style) }
    const fallbackRoot = {
      appendChild: vi.fn(),
      ownerDocument: fallbackDocument,
    }
    vi.stubGlobal('document', fallbackDocument)
    ensureButtonStyle(fallbackRoot as unknown as ShadowRoot)
    expect(fallbackRoot.appendChild).toHaveBeenCalledWith(style)
    expect(style.id).toBe('weapp-web-button-style')
    expect(style.textContent).toContain('weapp-button')

    const invalidRoot = { appendChild: vi.fn(), ownerDocument: {} }
    expect(() => ensureButtonStyle(invalidRoot as unknown as ShadowRoot)).not.toThrow()
    expect(invalidRoot.appendChild).toHaveBeenCalledOnce()
  })

  it('installs native component styles through document, sheet and fallback paths', async () => {
    const { injectStyle, module } = await loadStyleModule('../src/runtime/nativeComponents/style')
    const ensureNativeComponentStyle = (module as typeof import('../src/runtime/nativeComponents/style')).ensureNativeComponentStyle

    vi.stubGlobal('document', undefined)
    ensureNativeComponentStyle()
    expect(injectStyle).not.toHaveBeenCalled()

    vi.stubGlobal('document', { head: null })
    ensureNativeComponentStyle()

    const head = {}
    vi.stubGlobal('document', { head })
    ensureNativeComponentStyle()
    ensureNativeComponentStyle()
    expect(injectStyle).toHaveBeenCalledOnce()

    const replaceSync = vi.fn()
    class StyleSheet {
      replaceSync(css: string) {
        replaceSync(css)
      }
    }
    vi.stubGlobal('CSSStyleSheet', StyleSheet)
    const adoptedDocument = { adoptedStyleSheets: [] }
    const firstRoot = { adoptedStyleSheets: [] as unknown[], ownerDocument: adoptedDocument }
    ensureNativeComponentStyle(firstRoot as unknown as ShadowRoot)
    expect(firstRoot.adoptedStyleSheets).toHaveLength(1)
    expect(replaceSync).toHaveBeenCalledOnce()

    const sharedSheet = firstRoot.adoptedStyleSheets[0]
    const secondRoot = { adoptedStyleSheets: [sharedSheet], ownerDocument: adoptedDocument }
    ensureNativeComponentStyle(secondRoot as unknown as ShadowRoot)
    expect(secondRoot.adoptedStyleSheets).toEqual([sharedSheet])

    const ownerlessRoot = { adoptedStyleSheets: undefined }
    vi.stubGlobal('document', adoptedDocument)
    ensureNativeComponentStyle(ownerlessRoot as unknown as ShadowRoot)
    expect(ownerlessRoot.adoptedStyleSheets).toEqual([sharedSheet])

    const style = {} as { id?: string, textContent?: string }
    const fallbackDocument = { createElement: vi.fn(() => style) }
    const fallbackRoot = { append: vi.fn(), ownerDocument: fallbackDocument }
    vi.stubGlobal('document', fallbackDocument)
    ensureNativeComponentStyle(fallbackRoot as unknown as ShadowRoot)
    expect(fallbackRoot.append).toHaveBeenCalledWith(style)
    expect(style.id).toBe('weapp-web-native-component-style')
    expect(style.textContent).toContain('weapp-view')
  })
})

describe('legacy template expression contracts', () => {
  it('creates scopes and normalizes supported list inputs', () => {
    const parent = createScope({ inherited: 1 })
    const child = createChildScope(parent)
    child.local = 2
    expect(child.inherited).toBe(1)
    expect(createScope()).toEqual({})
    expect(normalizeList([1, 2])).toEqual([1, 2])
    expect(normalizeList(null)).toEqual([])
    expect(normalizeList(3.9)).toEqual([0, 1, 2])
    expect(normalizeList(-1)).toEqual([])
    expect(normalizeList(Number.POSITIVE_INFINITY)).toEqual([])
    expect(normalizeList({ first: 1, second: 2 })).toEqual([1, 2])
    expect(normalizeList('invalid')).toEqual([])
  })

  it('escapes values and interpolates complete and incomplete expressions', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;')
    expect(escapeAttribute('<value>')).toBe('&lt;value&gt;')
    expect(interpolateText('plain <text>', {}, false)).toBe('plain <text>')
    expect(interpolateText('plain <text>', {}, true)).toBe('plain &lt;text&gt;')
    expect(interpolateText('before {{ value }} after', { value: '<ready>' }, true)).toBe('before &lt;ready&gt; after')
    expect(interpolateText('{{ nil }}', { nil: null }, false)).toBe('')
    expect(interpolateText('{{ date }}', { date: new Date('2026-01-02T03:04:05.000Z') }, false)).toBe('2026-01-02T03:04:05.000Z')
    expect(interpolateText('{{ object }}', { object: { ready: true } }, false)).toBe('{"ready":true}')
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(interpolateText('{{ circular }}', { circular }, false)).toBe('[object Object]')
    expect(interpolateText('before {{ value', { value: 'ignored' }, false)).toBe('before {{ value')
    expect(resolveAttributeValue('{{ value }}', { value: 'ready' })).toBe('ready')
    expect(resolveAttributeValue(null as unknown as string, {})).toBe('')
  })

  it('evaluates cached expressions and handles parse and runtime failures by mode', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(evaluateExpression('', {})).toBeUndefined()
    expect(evaluateExpression('{{ }}', {})).toBeUndefined()
    expect(evaluateExpression('{{ value + 1 }}', { value: 1 })).toBe(2)
    expect(evaluateExpression('{{ value + 1 }}', { value: 2 })).toBe(3)

    setRuntimeExecutionMode('safe')
    expect(evaluateExpression('legacySafe ) parse', {})).toBeUndefined()
    expect(evaluateExpression('legacySafe ) parse', {})).toBeUndefined()
    expect(evaluateExpression('legacySafeMissing.value', {})).toBeUndefined()

    setRuntimeExecutionMode('compat')
    expect(evaluateExpression('legacyCompatMissing.value', {})).toBeUndefined()
    expect(() => evaluateExpression('legacyCompat ) parse', {})).toThrow(SyntaxError)

    setRuntimeExecutionMode('strict')
    expect(() => evaluateExpression('legacyStrictMissing.value', {})).toThrow(/strict 模式下表达式执行失败/)
    expect(() => evaluateExpression('legacyStrict ) parse', {})).toThrow(SyntaxError)

    const stringErrorScope = new Proxy({}, {
      has: () => true,
      get: () => {
        // eslint-disable-next-line no-throw-literal -- 覆盖宿主抛出非 Error 值的兼容路径
        throw 'string failure'
      },
    })
    setRuntimeExecutionMode('safe')
    expect(evaluateExpression('legacySafeStringFailure', stringErrorScope)).toBeUndefined()
    setRuntimeExecutionMode('strict')
    expect(() => evaluateExpression('legacyStrictStringFailure', stringErrorScope)).toThrow('string failure')

    const OriginalFunction = globalThis.Function
    class ThrowingFunction {
      constructor() {
        // eslint-disable-next-line no-throw-literal -- 覆盖宿主抛出非 Error 值的兼容路径
        throw 'parse string failure'
      }
    }
    vi.stubGlobal('Function', ThrowingFunction)
    setRuntimeExecutionMode('safe')
    expect(evaluateExpression('legacyForcedParseFailure', {})).toBeUndefined()
    vi.stubGlobal('Function', OriginalFunction)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('safe 模式下忽略表达式'))
  })
})
