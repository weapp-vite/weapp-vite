interface NavigationBarMetrics {
  statusBarHeight?: number
  navContentHeight?: number
  safeAreaTop?: number
}

const NAVIGATION_BAR_TAG = 'weapp-navigation-bar'
const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement
const navigationBarInstances = new Set<WeappNavigationBar>()
let navigationBarMetrics: NavigationBarMetrics = {}

const NAVBAR_STYLE = `
:host {
  --weapp-status-bar-height: 20px;
  --weapp-nav-content-height: 44px;
  --weapp-nav-height: calc(var(--weapp-status-bar-height) + var(--weapp-nav-content-height));
  --weapp-nav-bg: #ffffff;
  --weapp-nav-color: #000000;
  --weapp-nav-transition-duration: 0ms;
  --weapp-nav-transition-easing: ease;
  display: block;
  position: relative;
  z-index: 999;
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
}

.weapp-nav__spacer {
  height: var(--weapp-nav-height);
}

.weapp-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--weapp-nav-height);
  display: flex;
  flex-direction: column;
  background: var(--weapp-nav-bg);
  color: var(--weapp-nav-color);
  box-shadow: 0 0.5px 0 rgba(0, 0, 0, 0.1);
  transition:
    background-color var(--weapp-nav-transition-duration) var(--weapp-nav-transition-easing),
    color var(--weapp-nav-transition-duration) var(--weapp-nav-transition-easing);
}

.weapp-nav--transparent {
  box-shadow: none;
}

.weapp-nav__status {
  height: var(--weapp-status-bar-height);
}

.weapp-nav__content {
  height: var(--weapp-nav-content-height);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 0 12px;
  box-sizing: border-box;
  font-size: 17px;
  font-weight: 500;
  line-height: 1;
}

.weapp-nav__left,
.weapp-nav__right {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 88px;
  display: flex;
  align-items: center;
}

.weapp-nav__left {
  left: 12px;
}

.weapp-nav__right {
  right: 12px;
  justify-content: flex-end;
}

.weapp-nav__title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 70%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weapp-nav__loading {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-top-color: transparent;
  animation: weapp-nav-spin 0.8s linear infinite;
}

.weapp-nav__loading[hidden] {
  display: none;
}

@keyframes weapp-nav-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`

function isIOS() {
  if (typeof navigator === 'undefined') {
    return false
  }
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function getDefaultHeights() {
  if (isIOS()) {
    return { statusBarHeight: 20, navContentHeight: 44 }
  }
  return { statusBarHeight: 24, navContentHeight: 48 }
}

function readSafeAreaTop() {
  if (typeof document === 'undefined' || !document.body) {
    return 0
  }
  const probe = document.createElement('div')
  probe.style.cssText = [
    'position: absolute',
    'top: 0',
    'height: env(safe-area-inset-top)',
    'height: constant(safe-area-inset-top)',
    'pointer-events: none',
    'visibility: hidden',
  ].join(';')
  document.body.appendChild(probe)
  const height = Math.max(0, probe.getBoundingClientRect().height)
  probe.remove()
  return height
}

function resolveNavigationBarMetrics(): Required<NavigationBarMetrics> & { navHeight: number } {
  const defaults = getDefaultHeights()
  const safeAreaTop = navigationBarMetrics.safeAreaTop !== undefined
    ? navigationBarMetrics.safeAreaTop
    : readSafeAreaTop()
  const statusBarHeight = navigationBarMetrics.statusBarHeight !== undefined
    ? navigationBarMetrics.statusBarHeight
    : (safeAreaTop > 0 ? safeAreaTop : defaults.statusBarHeight)
  const navContentHeight = navigationBarMetrics.navContentHeight !== undefined
    ? navigationBarMetrics.navContentHeight
    : defaults.navContentHeight
  return {
    safeAreaTop,
    statusBarHeight,
    navContentHeight,
    navHeight: statusBarHeight + navContentHeight,
  }
}

function isTransparentColor(value: string | null) {
  if (!value) {
    return false
  }
  const normalized = value.trim().toLowerCase()
  return normalized === 'transparent'
    || normalized === 'rgba(0,0,0,0)'
    || normalized === 'rgba(0, 0, 0, 0)'
    || normalized === 'hsla(0,0%,0%,0)'
}

export function setNavigationBarMetrics(next: NavigationBarMetrics) {
  navigationBarMetrics = { ...navigationBarMetrics, ...next }
  for (const instance of navigationBarInstances) {
    instance.applyMetrics()
  }
}

class WeappNavigationBar extends BaseElement {
  static get observedAttributes() {
    return ['title', 'background-color', 'text-style', 'front-color', 'loading']
  }

  #nav?: HTMLDivElement
  #title?: HTMLSpanElement
  #loading?: HTMLSpanElement
  #resizeHandler?: () => void

  connectedCallback() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' })
    }
    if (this.shadowRoot && !this.shadowRoot.hasChildNodes()) {
      this.#renderShell()
    }
    navigationBarInstances.add(this)
    this.applyMetrics()
    this.applyAppearance()
    this.#bindResize()
  }

  disconnectedCallback() {
    navigationBarInstances.delete(this)
    if (this.#resizeHandler) {
      const target = typeof window !== 'undefined' ? (window.visualViewport ?? window) : undefined
      target?.removeEventListener('resize', this.#resizeHandler)
      this.#resizeHandler = undefined
    }
  }

  attributeChangedCallback() {
    this.applyAppearance()
  }

  applyMetrics() {
    const metrics = resolveNavigationBarMetrics()
    this.style.setProperty('--weapp-status-bar-height', `${metrics.statusBarHeight}px`)
    this.style.setProperty('--weapp-nav-content-height', `${metrics.navContentHeight}px`)
    this.style.setProperty('--weapp-nav-height', `${metrics.navHeight}px`)
  }

  applyAppearance() {
    if (!this.#nav || !this.#title || !this.#loading) {
      return
    }
    const title = this.getAttribute('title') ?? ''
    this.#title.textContent = title
    const background = this.getAttribute('background-color') ?? '#ffffff'
    const frontColor = this.getAttribute('front-color')
    const textStyle = (this.getAttribute('text-style') ?? '').toLowerCase()
    const color = frontColor || (textStyle === 'white' ? '#ffffff' : '#000000')
    const loadingAttr = this.getAttribute('loading')
    const loading = loadingAttr !== null && loadingAttr !== 'false' && loadingAttr !== '0'
    this.style.setProperty('--weapp-nav-bg', background)
    this.style.setProperty('--weapp-nav-color', color)
    this.#loading.toggleAttribute('hidden', !loading)
    this.#nav.classList.toggle('weapp-nav--transparent', isTransparentColor(background))
  }

  #bindResize() {
    if (this.#resizeHandler || typeof window === 'undefined') {
      return
    }
    const target = window.visualViewport ?? window
    this.#resizeHandler = () => {
      this.applyMetrics()
    }
    target.addEventListener('resize', this.#resizeHandler)
  }

  #renderShell() {
    const root = this.shadowRoot!
    root.innerHTML = ''
    const style = document.createElement('style')
    style.textContent = NAVBAR_STYLE
    const spacer = document.createElement('div')
    spacer.className = 'weapp-nav__spacer'
    const nav = document.createElement('div')
    nav.className = 'weapp-nav'
    const status = document.createElement('div')
    status.className = 'weapp-nav__status'
    const content = document.createElement('div')
    content.className = 'weapp-nav__content'
    const left = document.createElement('div')
    left.className = 'weapp-nav__left'
    const right = document.createElement('div')
    right.className = 'weapp-nav__right'
    const title = document.createElement('span')
    title.className = 'weapp-nav__title'
    const loading = document.createElement('span')
    loading.className = 'weapp-nav__loading'
    loading.setAttribute('hidden', '')
    const titleText = document.createElement('span')
    titleText.className = 'weapp-nav__title-text'
    title.append(loading, titleText)
    content.append(left, title, right)
    nav.append(status, content)
    root.append(style, spacer, nav)
    this.#nav = nav
    this.#title = titleText
    this.#loading = loading
  }
}

export function ensureNavigationBarDefined() {
  if (typeof customElements === 'undefined') {
    return
  }
  if (!customElements.get(NAVIGATION_BAR_TAG)) {
    customElements.define(NAVIGATION_BAR_TAG, WeappNavigationBar)
  }
}

export type { NavigationBarMetrics }
