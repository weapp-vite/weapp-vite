import { describe, expect, it, vi } from 'vitest'
import {
  isRecord,
  normalizeComponentOptions,
  normalizePageOptions,
} from '../src/runtime/polyfill/routeRuntime/options'
import { parsePageUrl } from '../src/runtime/polyfill/routeRuntime/url'

describe('route options and URL contracts', () => {
  it('parses empty, queried and template-extension page URLs', () => {
    expect(parsePageUrl('')).toEqual({ id: '', query: {} })
    expect(parsePageUrl('/pages/home/index?name=first&name=second&encoded=a%20b')).toEqual({
      id: 'pages/home/index',
      query: { encoded: 'a b', name: 'second' },
    })
    for (const extension of ['.wxml', '.axml', '.swan', '.ttml', '.qml', '.ksml', '.xhsml', '.html']) {
      expect(parsePageUrl(`/pages/home/index${extension.toUpperCase()}`).id).toBe('pages/home/index')
    }
    expect(parsePageUrl('/pages/home/index.js').id).toBe('pages/home/index.js')
  })

  it('normalizes page methods, cloned lifetimes and lifecycle hooks', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord(null)).toBe(false)
    expect(isRecord('value')).toBe(false)
    expect(normalizePageOptions(undefined)).toEqual({ component: { methods: {} }, hooks: {} })

    const nested = vi.fn()
    const top = vi.fn()
    const attached = vi.fn()
    const hooks = {
      onHide: vi.fn(),
      onLoad: vi.fn(),
      onReady: vi.fn(),
      onShow: vi.fn(),
      onUnload: vi.fn(),
    }
    const raw = {
      ...hooks,
      attached: top,
      data: { value: 1 },
      ignored: 'value',
      lifetimes: { attached },
      methods: { attached: nested, invalid: 1 },
    }
    const result = normalizePageOptions(raw as any)
    expect(result.component.methods).toEqual({ attached: nested })
    expect(result.component.lifetimes).toEqual({ attached })
    expect(result.component.lifetimes).not.toBe(raw.lifetimes)
    expect(result.hooks).toEqual(hooks)

    const invalid = normalizePageOptions({
      methods: 'invalid',
      onHide: 1,
      onLoad: null,
      onReady: {},
      onShow: false,
      onUnload: 'invalid',
      tap: top,
    } as any)
    expect(invalid.component.methods).toEqual({ tap: top })
    expect(invalid.hooks).toEqual({})
  })

  it('normalizes component methods with nested precedence and reserved fields', () => {
    expect(normalizeComponentOptions(undefined)).toEqual({ methods: {} })
    const nested = vi.fn()
    const top = vi.fn()
    const created = vi.fn()
    const raw = {
      created: top,
      data: {},
      lifetimes: { created },
      methods: { created: nested, invalid: null },
      pageLifetimes: { show: vi.fn() },
      property: 'value',
    }
    const result = normalizeComponentOptions(raw as any)
    expect(result.methods).toEqual({ created: nested })
    expect(result.lifetimes).toEqual({ created })
    expect(result.lifetimes).not.toBe(raw.lifetimes)
    expect(normalizeComponentOptions({ methods: [], tap: top } as any).methods).toEqual({ tap: top })
  })
})
