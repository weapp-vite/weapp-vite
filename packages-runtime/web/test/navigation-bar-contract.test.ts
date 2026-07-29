// @vitest-environment happy-dom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  ensureNavigationBarDefined,
  setNavigationBarMetrics,
} from '../src/runtime/navigationBar'

function resetMetrics() {
  setNavigationBarMetrics({
    navContentHeight: undefined,
    safeAreaTop: undefined,
    statusBarHeight: undefined,
  })
}

describe('navigation bar environment contract', () => {
  beforeAll(() => {
    ensureNavigationBarDefined()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.replaceChildren()
    resetMetrics()
    vi.restoreAllMocks()
  })

  it('uses safe-area measurements and platform defaults', () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ height: 32 } as DOMRect)
    const navigationBar = document.createElement('weapp-navigation-bar')
    document.body.append(navigationBar)

    expect(navigationBar.style.getPropertyValue('--weapp-status-bar-height')).toBe('32px')
    expect(navigationBar.style.getPropertyValue('--weapp-nav-content-height')).toBe('48px')
    expect(document.body.querySelectorAll('div')).toHaveLength(0)

    rect.mockReturnValue({ height: -4 } as DOMRect)
    vi.stubGlobal('navigator', { userAgent: 'iPhone' })
    resetMetrics()
    expect(navigationBar.style.getPropertyValue('--weapp-status-bar-height')).toBe('20px')
    expect(navigationBar.style.getPropertyValue('--weapp-nav-content-height')).toBe('44px')
  })

  it('falls back safely without navigator or a measurable document body', () => {
    const navigationBar = document.createElement('weapp-navigation-bar')
    document.body.append(navigationBar)

    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('document', undefined)
    resetMetrics()
    expect(navigationBar.style.getPropertyValue('--weapp-nav-height')).toBe('72px')

    vi.stubGlobal('document', { body: undefined })
    resetMetrics()
    expect(navigationBar.style.getPropertyValue('--weapp-status-bar-height')).toBe('24px')
  })

  it('handles appearance before connection and all transparent color forms', () => {
    const navigationBar = document.createElement('weapp-navigation-bar')
    navigationBar.setAttribute('title', 'Before connection')
    document.body.append(navigationBar)
    const nav = navigationBar.shadowRoot!.querySelector('.weapp-nav')!

    for (const color of ['transparent', 'rgba(0,0,0,0)', 'rgba(0, 0, 0, 0)', 'hsla(0,0%,0%,0)']) {
      navigationBar.setAttribute('background-color', color)
      expect(nav.classList.contains('weapp-nav--transparent')).toBe(true)
    }
    navigationBar.removeAttribute('background-color')
    navigationBar.removeAttribute('title')
    expect(nav.classList.contains('weapp-nav--transparent')).toBe(false)
    expect(navigationBar.shadowRoot!.querySelector('.weapp-nav__title-text')!.textContent).toBe('')
  })

  it('binds to visualViewport and reapplies metrics on resize', () => {
    const listeners = new Map<string, EventListener>()
    const visualViewport = {
      addEventListener: vi.fn((name: string, listener: EventListener) => listeners.set(name, listener)),
      removeEventListener: vi.fn(),
    }
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: visualViewport,
    })
    const navigationBar = document.createElement('weapp-navigation-bar')
    document.body.append(navigationBar)

    setNavigationBarMetrics({ statusBarHeight: 18, navContentHeight: 42 })
    listeners.get('resize')!(new Event('resize'))
    expect(navigationBar.style.getPropertyValue('--weapp-nav-height')).toBe('60px')

    navigationBar.remove()
    expect(visualViewport.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
    Reflect.deleteProperty(window, 'visualViewport')
  })

  it('skips resize and definition work when browser globals are unavailable', () => {
    const disconnected = document.createElement('weapp-navigation-bar') as HTMLElement & {
      disconnectedCallback: () => void
    }
    disconnected.disconnectedCallback()

    const navigationBar = document.createElement('weapp-navigation-bar') as HTMLElement & {
      connectedCallback: () => void
      disconnectedCallback: () => void
    }
    navigationBar.connectedCallback()
    vi.stubGlobal('window', undefined)
    navigationBar.disconnectedCallback()

    ensureNavigationBarDefined()
    vi.stubGlobal('customElements', undefined)
    ensureNavigationBarDefined()
  })
})
