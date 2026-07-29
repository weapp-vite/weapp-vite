// @vitest-environment happy-dom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  configureTabBar,
  ensureTabBarDefined,
  getTabBarPagePaths,
  setTabBarBadgeState,
  setTabBarRedDotState,
  setTabBarVisible,
  syncTabBarRoute,
  updateTabBarItem,
  updateTabBarStyle,
} from '../src/runtime/appShell/tabBar'
import {
  ensureButtonDefined,
  setButtonFormConfig,
} from '../src/runtime/button'
import {
  getHoverClass,
  isDisabled,
  isInternalNode,
  normalizeType,
  parseNumber,
  toBoolean,
} from '../src/runtime/button/helpers'
import {
  ensureNativeComponentsDefined,
} from '../src/runtime/nativeComponents'
import {
  executeNavigatorRequest,
  resolveNavigatorExtraData,
} from '../src/runtime/nativeComponents/navigator'
import {
  ensureNavigationBarDefined,
  setNavigationBarMetrics,
} from '../src/runtime/navigationBar'
import { setRuntimeWarningOptions } from '../src/runtime/warning'

const tabBarConfig = {
  color: '#666666',
  selectedColor: '#07c160',
  backgroundColor: '#ffffff',
  borderStyle: 'black' as const,
  position: 'bottom' as const,
  custom: false,
  list: [
    {
      pagePath: 'pages/home/index',
      text: 'Home',
      iconPath: './assets/home.png',
      selectedIconPath: 'https://example.com/home-active.png',
    },
    {
      pagePath: 'pages/settings/index',
      text: 'Settings',
      iconPath: '/assets/settings.png',
    },
  ],
}

function appendElement<T extends HTMLElement>(tagName: string, attributes: Record<string, string> = {}) {
  const element = document.createElement(tagName) as T
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value)
  }
  document.body.append(element)
  return element
}

async function flushDom() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('native shell custom elements', () => {
  beforeAll(() => {
    ensureNativeComponentsDefined()
    ensureButtonDefined()
    ensureNavigationBarDefined()
    ensureTabBarDefined()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    configureTabBar(undefined, async () => {})
    document.body.replaceChildren()
    setButtonFormConfig({ preventDefault: true })
    setNavigationBarMetrics({
      navContentHeight: undefined,
      safeAreaTop: undefined,
      statusBarHeight: undefined,
    })
    setRuntimeWarningOptions()
  })

  it('normalizes button attributes and helper values', () => {
    expect(toBoolean(null)).toBe(false)
    expect(toBoolean('')).toBe(true)
    expect(toBoolean(' TRUE ')).toBe(true)
    expect(toBoolean('false')).toBe(false)
    expect(toBoolean('0')).toBe(false)
    expect(toBoolean('yes')).toBe(true)
    expect(parseNumber(null, 20)).toBe(20)
    expect(parseNumber('', 20)).toBe(20)
    expect(parseNumber('invalid', 20)).toBe(20)
    expect(parseNumber('12', 20)).toBe(12)
    expect(normalizeType(null)).toBe('default')
    expect(normalizeType('PRIMARY')).toBe('primary')
    expect(normalizeType('warn')).toBe('warn')
    expect(normalizeType('other')).toBe('default')

    const element = document.createElement('div')
    expect(isDisabled(element)).toBe(false)
    element.setAttribute('loading', '')
    expect(isDisabled(element)).toBe(true)
    expect(getHoverClass(element)).toBe('button-hover')
    element.setAttribute('hover-class', 'pressed')
    expect(getHoverClass(element)).toBe('pressed')
    element.setAttribute('hover-class', 'none')
    expect(getHoverClass(element)).toBe('')
    expect(isInternalNode(document.createTextNode('text'))).toBe(false)
    element.dataset.weappInternal = 'true'
    expect(isInternalNode(element)).toBe(true)
  })

  it('renders button state, moves light DOM content and blocks locked clicks', async () => {
    const button = document.createElement('weapp-button')
    button.textContent = 'Submit'
    button.setAttribute('type', 'primary')
    button.setAttribute('plain', '')
    button.setAttribute('size', 'mini')
    button.setAttribute('open-type', 'share')
    document.body.append(button)

    const nativeButton = button.querySelector('button')!
    const text = button.querySelector('.weapp-btn__text')!
    const loading = button.querySelector('.weapp-btn__loading')!
    expect(text.textContent).toBe('Submit')
    expect(button.classList.contains('weapp-btn--primary')).toBe(true)
    expect(button.classList.contains('weapp-btn--plain')).toBe(true)
    expect(button.classList.contains('weapp-btn--mini')).toBe(true)
    expect(button.classList.contains('weapp-btn--open-type-share')).toBe(true)
    expect(nativeButton.getAttribute('aria-disabled')).toBeNull()
    expect(loading.hasAttribute('hidden')).toBe(true)

    const external = document.createElement('strong')
    external.textContent = ' now'
    button.append(external)
    await flushDom()
    expect(text.contains(external)).toBe(true)

    button.setAttribute('type', 'warn')
    button.setAttribute('open-type', 'contact')
    button.setAttribute('loading', '')
    expect(button.classList.contains('weapp-btn--primary')).toBe(false)
    expect(button.classList.contains('weapp-btn--warn')).toBe(true)
    expect(button.classList.contains('weapp-btn--open-type-share')).toBe(false)
    expect(button.classList.contains('weapp-btn--open-type-contact')).toBe(true)
    expect(nativeButton.disabled).toBe(true)
    expect(nativeButton.getAttribute('aria-disabled')).toBe('true')
    expect(loading.hasAttribute('hidden')).toBe(false)

    const click = vi.fn()
    button.addEventListener('click', click)
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    expect(button.dispatchEvent(event)).toBe(false)
    expect(click).not.toHaveBeenCalled()

    button.removeAttribute('loading')
    button.removeAttribute('open-type')
    button.removeAttribute('plain')
    button.setAttribute('type', 'unknown')
    expect(button.classList.contains('weapp-btn--default')).toBe(true)
    expect(button.classList.contains('weapp-btn--open-type-contact')).toBe(false)
    expect(nativeButton.disabled).toBe(false)
  })

  it('dispatches button form actions and applies hover timing rules', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    const form = appendElement<any>('weapp-form')
    const button = document.createElement('weapp-button')
    button.setAttribute('form-type', 'submit')
    button.setAttribute('hover-class', 'pressed')
    button.setAttribute('hover-start-time', '10')
    button.setAttribute('hover-stay-time', '15')
    form.append(button)
    const submit = vi.fn()
    form.addEventListener('submit', submit)

    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    button.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    expect(submit).toHaveBeenCalledTimes(1)

    button.setAttribute('form-type', 'reset')
    const reset = vi.fn()
    form.addEventListener('reset', reset)
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(reset).toHaveBeenCalledTimes(1)

    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    vi.advanceTimersByTime(10)
    expect(button.classList.contains('pressed')).toBe(true)
    button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    vi.advanceTimersByTime(15)
    expect(button.classList.contains('pressed')).toBe(false)

    button.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }))
    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    vi.advanceTimersByTime(10)
    expect(button.classList.contains('pressed')).toBe(true)
    button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    expect(button.classList.contains('pressed')).toBe(true)
    button.dispatchEvent(new TouchEvent('touchend', { bubbles: true }))
    button.remove()
    vi.runAllTimers()
    expect(button.classList.contains('pressed')).toBe(true)

    const standalone = appendElement('weapp-button', { 'form-type': 'submit', 'hover-class': 'none' })
    const standaloneClick = new MouseEvent('click', { bubbles: true, cancelable: true })
    standalone.dispatchEvent(standaloneClick)
    expect(standaloneClick.defaultPrevented).toBe(false)
    standalone.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    standalone.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  })

  it('covers button host capabilities and defensive lifecycle branches', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    const host = appendElement('div')
    const root = host.attachShadow({ mode: 'open' })
    const button = document.createElement('weapp-button') as HTMLElement & {
      connectedCallback: () => void
      disconnectedCallback: () => void
    }
    button.setAttribute('hover-class', 'pressed')
    root.append(button)
    button.connectedCallback()

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    button.setAttribute('form-type', 'invalid')
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    button.setAttribute('disabled', '')
    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    button.removeAttribute('disabled')
    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    button.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))

    const internal = document.createElement('span')
    internal.dataset.weappInternal = 'true'
    button.append(internal)
    await flushDom()
    expect(button.querySelector('.weapp-btn__text')!.contains(internal)).toBe(false)

    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    button.disconnectedCallback()

    vi.stubGlobal('MutationObserver', undefined)
    const observerless = appendElement('weapp-button')
    expect(observerless.querySelector('button')).not.toBeNull()

    const define = vi.fn()
    vi.stubGlobal('customElements', { define, get: vi.fn(() => undefined) })
    ensureButtonDefined()
    expect(define).toHaveBeenCalledWith('weapp-button', expect.any(Function))
    vi.stubGlobal('customElements', undefined)
    ensureButtonDefined()
  })

  it('routes every navigator request shape and parses extra data', async () => {
    const success = vi.fn()
    const fail = vi.fn()
    const complete = vi.fn()
    const bridge = {
      navigateTo: vi.fn(() => Promise.resolve()),
      redirectTo: vi.fn(() => Promise.resolve()),
      switchTab: vi.fn(() => Promise.resolve()),
      reLaunch: vi.fn(() => Promise.resolve()),
      navigateBack: vi.fn(() => Promise.resolve()),
      navigateToMiniProgram: vi.fn(() => Promise.resolve()),
      exitMiniProgram: vi.fn(() => Promise.resolve()),
    }
    const base = {
      url: '/pages/home/index',
      delta: 2,
      target: 'self',
      success,
      fail,
      complete,
    }

    for (const openType of ['navigate', 'redirect', 'switchtab', 'relaunch', 'navigateback']) {
      await executeNavigatorRequest({ ...base, openType }, bridge as any)
    }
    await executeNavigatorRequest({ ...base, openType: 'EXIT' }, bridge as any)
    await executeNavigatorRequest({ ...base, openType: 'exit', target: ' miniProgram ' }, bridge as any)
    await executeNavigatorRequest({
      ...base,
      openType: 'navigate',
      target: 'miniProgram',
      appId: 'wx-demo',
      path: 'pages/index/index',
      extraData: { source: 'test' },
      envVersion: 'trial',
    }, bridge as any)

    expect(bridge.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: base.url, success, fail, complete }))
    expect(bridge.redirectTo).toHaveBeenCalledTimes(1)
    expect(bridge.switchTab).toHaveBeenCalledTimes(1)
    expect(bridge.reLaunch).toHaveBeenCalledTimes(1)
    expect(bridge.navigateBack).toHaveBeenCalledWith(expect.objectContaining({ delta: 2 }))
    expect(bridge.exitMiniProgram).toHaveBeenCalledTimes(1)
    expect(bridge.navigateToMiniProgram).toHaveBeenCalledWith(expect.objectContaining({ appId: 'wx-demo' }))

    expect(resolveNavigatorExtraData(undefined)).toBeUndefined()
    expect(resolveNavigatorExtraData(undefined, '')).toBeUndefined()
    expect(resolveNavigatorExtraData('null')).toBeUndefined()
    expect(resolveNavigatorExtraData('1')).toBeUndefined()
    expect(resolveNavigatorExtraData('{bad json')).toBeUndefined()
    expect(resolveNavigatorExtraData('{"valid":true}')).toEqual({ valid: true })
  })

  it('renders navigator links, events, warnings and hover behavior', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(5_000)
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const navigator = document.createElement('weapp-navigator') as any
    navigator.textContent = 'Open app'
    navigator.extraData = '{"source":"property"}'
    navigator.setAttribute('target', 'miniProgram')
    navigator.setAttribute('app-id', 'wx-demo')
    navigator.setAttribute('path', 'pages/index/index')
    navigator.setAttribute('version', 'trial')
    navigator.setAttribute('url', '/pages/home/index')
    navigator.setAttribute('hover-stop-propagation', '')
    navigator.setAttribute('hover-start-time', '-10')
    navigator.setAttribute('hover-stay-time', '-20')
    document.body.append(navigator)

    const anchor = navigator.shadowRoot!.querySelector('a')!
    expect(anchor.getAttribute('href')).toContain('/pages/home/index')
    expect(anchor.getAttribute('aria-label')).toBe('Open app')
    navigator.setAttribute('aria-label', 'Navigate')
    expect(anchor.getAttribute('aria-label')).toBe('Navigate')

    const success = vi.fn()
    const complete = vi.fn()
    navigator.addEventListener('success', success)
    navigator.addEventListener('complete', complete)
    anchor.click()
    await flushDom()
    expect(success).toHaveBeenCalledTimes(1)
    expect(complete).toHaveBeenCalledTimes(1)

    const parentPress = vi.fn()
    document.body.addEventListener('mousedown', parentPress)
    navigator.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    vi.runAllTimers()
    expect(parentPress).not.toHaveBeenCalled()
    expect(navigator.classList.contains('navigator-hover')).toBe(true)
    navigator.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    vi.runAllTimers()
    expect(navigator.classList.contains('navigator-hover')).toBe(false)

    navigator.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }))
    navigator.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    vi.runAllTimers()
    expect(navigator.classList.contains('navigator-hover')).toBe(true)
    navigator.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    navigator.dispatchEvent(new TouchEvent('touchcancel', { bubbles: true }))
    navigator.remove()
    vi.runAllTimers()

    const shortLink = appendElement<any>('weapp-navigator', {
      'short-link': '#miniProgram://demo',
      'target': 'miniProgram',
      'version': 'invalid',
    })
    shortLink.shadowRoot!.querySelector('a')!.click()
    await flushDom()
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('short-link'))

    const noHover = appendElement('weapp-navigator', { 'hover-class': 'none' })
    noHover.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    noHover.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    const defaultTarget = appendElement<any>('weapp-navigator')
    defaultTarget.shadowRoot!.querySelector('a')!.click()
    defaultTarget.classList.add('navigator-hover')
    defaultTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    defaultTarget.classList.remove('navigator-hover')
    defaultTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  })

  it('renders and updates navigation bar metrics and appearance', () => {
    const addResize = vi.spyOn(window, 'addEventListener')
    const removeResize = vi.spyOn(window, 'removeEventListener')
    setNavigationBarMetrics({ statusBarHeight: 22, navContentHeight: 46, safeAreaTop: 8 })
    const navigationBar = appendElement('weapp-navigation-bar', {
      'background-color': 'rgba(0, 0, 0, 0)',
      'front-color': '#123456',
      'loading': '',
      'title': 'Runtime',
    })
    const root = navigationBar.shadowRoot!
    expect(root.querySelector('.weapp-nav__title-text')!.textContent).toBe('Runtime')
    expect(root.querySelector('.weapp-nav')!.classList.contains('weapp-nav--transparent')).toBe(true)
    expect(root.querySelector('.weapp-nav__loading')!.hasAttribute('hidden')).toBe(false)
    expect(navigationBar.style.getPropertyValue('--weapp-status-bar-height')).toBe('22px')
    expect(navigationBar.style.getPropertyValue('--weapp-nav-content-height')).toBe('46px')
    expect(navigationBar.style.getPropertyValue('--weapp-nav-height')).toBe('68px')
    expect(navigationBar.style.getPropertyValue('--weapp-nav-color')).toBe('#123456')
    expect(addResize).toHaveBeenCalledWith('resize', expect.any(Function))

    navigationBar.setAttribute('background-color', 'hsla(0,0%,0%,0)')
    navigationBar.removeAttribute('front-color')
    navigationBar.setAttribute('text-style', 'white')
    navigationBar.setAttribute('loading', '0')
    expect(navigationBar.style.getPropertyValue('--weapp-nav-color')).toBe('#ffffff')
    expect(root.querySelector('.weapp-nav__loading')!.hasAttribute('hidden')).toBe(true)

    setNavigationBarMetrics({ statusBarHeight: 30 })
    expect(navigationBar.style.getPropertyValue('--weapp-nav-height')).toBe('76px')
    ;(navigationBar as any).connectedCallback()
    expect(root.querySelectorAll('.weapp-nav')).toHaveLength(1)
    navigationBar.remove()
    expect(removeResize).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('renders tab bars, assets, state, insets and click behavior', async () => {
    const app = appendElement('div')
    app.id = 'app'
    const switchTab = vi.fn(() => Promise.resolve())
    configureTabBar(tabBarConfig, switchTab)
    syncTabBarRoute('pages/home/index')

    const tabBar = app.querySelector('weapp-tab-bar')!
    const root = tabBar.shadowRoot!
    const buttons = root.querySelectorAll<HTMLButtonElement>('button')
    expect(buttons).toHaveLength(2)
    expect(tabBar.hasAttribute('hidden')).toBe(false)
    expect(tabBar.getAttribute('position')).toBe('bottom')
    expect(buttons[0]!.getAttribute('aria-current')).toBe('page')
    expect(buttons[0]!.querySelector('img')!.src).toBe('https://example.com/home-active.png')
    expect(buttons[1]!.querySelector('img')!.getAttribute('src')).toBe('/assets/settings.png')
    expect(app.style.getPropertyValue('--weapp-tab-bar-inset')).toContain('50px')
    expect([...getTabBarPagePaths()]).toEqual(['pages/home/index', 'pages/settings/index'])

    buttons[0]!.click()
    expect(switchTab).not.toHaveBeenCalled()
    buttons[1]!.click()
    await flushDom()
    expect(switchTab).toHaveBeenCalledWith('/pages/settings/index')

    expect(setTabBarBadgeState(1, '8')).toBe(true)
    expect(root.querySelector('.weapp-tab-bar__badge')!.textContent).toBe('8')
    expect(setTabBarRedDotState(0, true)).toBe(true)
    expect(root.querySelector('.weapp-tab-bar__badge--dot')).not.toBeNull()
    expect(updateTabBarItem(1, { text: 'Profile', selectedIconPath: 'data:image/png;base64,AA==' })).toBe(true)
    expect(root.textContent).toContain('Profile')
    expect(updateTabBarStyle({ borderStyle: 'white', backgroundColor: '#eeeeee' })).toBe(true)
    expect((tabBar as HTMLElement).style.getPropertyValue('--weapp-tab-bar-border-color')).toContain('255')

    expect(setTabBarVisible(false, true)).toBe(true)
    expect(tabBar.hasAttribute('hidden')).toBe(true)
    expect(tabBar.hasAttribute('data-animation')).toBe(true)
    expect(app.style.getPropertyValue('--weapp-tab-bar-inset')).toBe('0px')
    setTabBarVisible(true)
    syncTabBarRoute('pages/settings/index')
    expect(root.querySelector('[aria-current="page"]')!.getAttribute('data-page-path')).toBe('pages/settings/index')

    expect(updateTabBarItem(-1, { text: 'invalid' })).toBe(false)
    expect(updateTabBarItem(0.5, { text: 'invalid' })).toBe(false)
    expect(setTabBarBadgeState(99, 'x')).toBe(false)
    expect(setTabBarRedDotState(99, true)).toBe(false)

    configureTabBar({ ...tabBarConfig, custom: true }, switchTab)
    expect(app.querySelector('weapp-tab-bar')).toBeNull()
    expect(updateTabBarStyle({ color: '#000000' })).toBe(true)
    configureTabBar(undefined, switchTab)
    expect(updateTabBarStyle({ color: '#000000' })).toBe(false)
    expect(getTabBarPagePaths().size).toBe(0)
  })

  it('supports top tab bars, missing handlers and custom-element guards', async () => {
    const app = appendElement('div')
    app.id = 'app'
    configureTabBar({
      ...tabBarConfig,
      position: 'top',
      list: [{ pagePath: 'pages/home/index', text: 'Home', iconPath: 'blob:icon' }],
    }, undefined as any)
    syncTabBarRoute('pages/home/index')
    const tabBar = app.querySelector('weapp-tab-bar')!
    expect(app.style.getPropertyValue('--weapp-tab-bar-top-inset')).toBe('50px')
    expect(tabBar.shadowRoot!.querySelector('img')!.getAttribute('src')).toBe('blob:icon')
    tabBar.shadowRoot!.querySelector('button')!.click()
    tabBar.remove()

    vi.stubGlobal('customElements', undefined)
    expect(() => ensureButtonDefined()).not.toThrow()
    expect(() => ensureNavigationBarDefined()).not.toThrow()
    expect(() => ensureTabBarDefined()).not.toThrow()
  })
})
