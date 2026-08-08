import { afterEach, describe, expect, it } from 'vitest'
import {
  getWebViewportWidth,
  resolveWebViewportConfig,
  setupWebViewport,
} from '../src/runtime/viewport'

const originalDocument = (globalThis as Record<string, unknown>).document
const originalWindow = (globalThis as Record<string, unknown>).window

afterEach(() => {
  if (originalDocument === undefined) {
    delete (globalThis as Record<string, unknown>).document
  }
  else {
    Object.assign(globalThis, { document: originalDocument })
  }
  if (originalWindow === undefined) {
    delete (globalThis as Record<string, unknown>).window
  }
  else {
    Object.assign(globalThis, { window: originalWindow })
  }
})

describe('web viewport', () => {
  it('normalizes modes and positive numeric options', () => {
    expect(resolveWebViewportConfig()).toEqual({
      mode: 'mini-program',
      maxWidth: 375,
      desktopBreakpoint: 600,
    })
    expect(resolveWebViewportConfig({
      mode: 'responsive',
      maxWidth: 414,
      desktopBreakpoint: 720,
    })).toEqual({
      mode: 'responsive',
      maxWidth: 414,
      desktopBreakpoint: 720,
    })
    expect(resolveWebViewportConfig({
      mode: 'invalid' as any,
      maxWidth: 0,
      desktopBreakpoint: Number.NaN,
    })).toEqual({
      mode: 'mini-program',
      maxWidth: 375,
      desktopBreakpoint: 600,
    })
  })

  it('returns the resolved config without touching the DOM in node hosts', () => {
    delete (globalThis as Record<string, unknown>).document
    expect(setupWebViewport({ mode: 'responsive' }).mode).toBe('responsive')
    expect(getWebViewportWidth()).toBe(0)
  })

  it('creates and updates the viewport style in browser hosts', () => {
    const root = {
      clientWidth: 1024,
      setAttribute: () => {},
    }
    const style = { id: '', textContent: '' }
    const documentRef = {
      documentElement: root,
      createElement: () => style,
      head: { append: () => {} },
      querySelector: (selector: string) => selector === '#app' ? null : selector === '#weapp-web-viewport-style' ? style : null,
    }
    Object.assign(globalThis, {
      document: documentRef,
      window: { innerWidth: 800 },
    })

    expect(setupWebViewport({ mode: 'mini-program', maxWidth: 375 })).toMatchObject({
      maxWidth: 375,
    })
    expect(style.textContent).toContain('--weapp-viewport-max-width')
    expect(getWebViewportWidth()).toBe(375)

    root.clientWidth = 320
    expect(getWebViewportWidth()).toBe(320)
    setupWebViewport({ mode: 'responsive' })
    expect(style.textContent).toContain('width: 100%')
  })

  it('uses app width first and falls back to window width', () => {
    const app = { clientWidth: 414 }
    const root = { clientWidth: 0 }
    Object.assign(globalThis, {
      document: {
        documentElement: root,
        querySelector: (selector: string) => selector === '#app' ? app : null,
      },
      window: { innerWidth: 768 },
    })
    expect(getWebViewportWidth()).toBe(414)

    app.clientWidth = 0
    expect(getWebViewportWidth()).toBe(768)
    delete (globalThis as any).window
    expect(getWebViewportWidth()).toBe(0)
  })
})
