import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getRuntimeExecutionMode,
  setRuntimeExecutionMode,
  warnRuntimeExecutionOnce,
} from '../src/runtime/execution'
import { setupRpx } from '../src/runtime/rpx'
import { injectStyle, removeStyle } from '../src/runtime/style'
import { setRuntimeWarningOptions } from '../src/runtime/warning'
import { slugify } from '../src/shared/slugify'
import {
  hasControlAttribute,
  normalizeAttributeName,
  normalizeTagName,
  resolveControlAttributeName,
  resolveControlAttributeValue,
} from '../src/shared/wxml'

const originalDocument = (globalThis as any).document
const originalWindow = (globalThis as any).window

describe('web runtime foundation helpers', () => {
  afterEach(() => {
    setRuntimeExecutionMode()
    setRuntimeWarningOptions()
    vi.restoreAllMocks()
    if (originalDocument === undefined) {
      delete (globalThis as any).document
    }
    else {
      ;(globalThis as any).document = originalDocument
    }
    if (originalWindow === undefined) {
      delete (globalThis as any).window
    }
    else {
      ;(globalThis as any).window = originalWindow
    }
  })

  it('normalizes execution modes and dedupes execution warnings', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    setRuntimeExecutionMode('safe')
    expect(getRuntimeExecutionMode()).toBe('safe')
    setRuntimeExecutionMode('invalid')
    expect(getRuntimeExecutionMode()).toBe('compat')
    setRuntimeExecutionMode('invalid')
    expect(warn).toHaveBeenCalledTimes(1)

    warnRuntimeExecutionOnce('same', 'first')
    warnRuntimeExecutionOnce('same', 'first')
    expect(warn).toHaveBeenCalledTimes(2)
    setRuntimeExecutionMode(undefined)
    setRuntimeWarningOptions()
    warnRuntimeExecutionOnce('same', 'first')
    expect(warn).toHaveBeenCalledTimes(3)
  })

  it('injects, updates and removes styles with generated and explicit ids', () => {
    const styles = new Map<string, any>()
    const head = {
      append(style: any) {
        styles.set(style.id, style)
      },
    }
    ;(globalThis as any).document = {
      createElement: () => ({
        id: '',
        textContent: '',
        remove() {
          styles.delete(this.id)
        },
      }),
      head,
    }

    const removeGenerated = injectStyle('body { color: red; }')
    expect(styles.size).toBe(1)
    const generatedId = [...styles.keys()][0]!
    expect(generatedId).toMatch(/^weapp-web-style-/)
    injectStyle('body { color: blue; }', generatedId)
    expect(styles.get(generatedId)?.textContent).toContain('blue')
    removeGenerated()
    expect(styles.size).toBe(0)
    removeStyle('missing')

    delete (globalThis as any).document
    expect(() => removeStyle('missing')).not.toThrow()
    expect(injectStyle('no document')()).toBeUndefined()
  })

  it('computes rpx without a browser window and reuses the resize listener', () => {
    const setProperty = vi.fn()
    ;(globalThis as any).document = {
      documentElement: {
        clientWidth: 375,
        style: { setProperty },
      },
      querySelector: () => null,
    }
    delete (globalThis as any).window
    setupRpx({ designWidth: 750, varName: '--unit' })
    expect(setProperty).toHaveBeenCalledWith('--unit', '0px')
  })

  it('normalizes shared ids, tags, attributes and control directives', () => {
    expect(slugify('---', 'page')).toBe('page-index')
    expect(normalizeTagName('view')).toBe('weapp-view')
    expect(normalizeTagName('block')).toBe('#fragment')
    expect(normalizeTagName('slot')).toBe('slot')
    expect(normalizeTagName('section')).toBe('section')
    expect(normalizeTagName('')).toBe('div')
    expect(normalizeAttributeName('class')).toBe('class')
    expect(normalizeAttributeName('style')).toBe('style')
    expect(normalizeAttributeName('data-id')).toBe('data-id')
    expect(normalizeAttributeName('hoverClass')).toBe('hover-class')

    const attribs = { 'wx:if': '{{ready}}' }
    expect(resolveControlAttributeName(attribs, 'if')).toBe('wx:if')
    expect(resolveControlAttributeValue(attribs, 'if')).toBe('{{ready}}')
    expect(hasControlAttribute(attribs, 'if')).toBe(true)
    expect(resolveControlAttributeName({}, 'if')).toBeUndefined()
    expect(resolveControlAttributeValue({}, 'if')).toBeUndefined()
    expect(hasControlAttribute({}, 'if')).toBe(false)
  })
})
