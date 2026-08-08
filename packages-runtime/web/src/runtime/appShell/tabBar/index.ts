import type { WebTabBarConfig, WebTabBarItem } from '../../../shared/tabBar'
import { ensureAppContainer, getAppContainer, onDocumentReady } from '../container'
import { TAB_BAR_STYLE } from './style'

interface TabBarItemState {
  badge?: string
  redDot?: boolean
}

type SwitchTabHandler = (url: string) => Promise<unknown>

const TAB_BAR_TAG = 'weapp-tab-bar'
const TAB_BAR_HEIGHT = '50px'
const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

let tabBarConfig: WebTabBarConfig | undefined
let activeRoute = ''
let requestedVisible = true
let animationEnabled = false
let switchTabHandler: SwitchTabHandler | undefined
let itemStates: TabBarItemState[] = []
const instances = new Set<WeappTabBar>()

function resolveAssetUrl(value: string | undefined) {
  if (!value || /^(?:data:|blob:|https?:\/\/|\/)/.test(value)) {
    return value
  }
  return `/${value.replace(/^\.\//, '')}`
}

function isNativeTabBarVisible() {
  return Boolean(
    tabBarConfig
    && !tabBarConfig.custom
    && requestedVisible
    && tabBarConfig.list.some(item => item.pagePath === activeRoute),
  )
}

function syncContainerInsets() {
  const container = getAppContainer()
  if (!container) {
    return
  }
  const bottomVisible = isNativeTabBarVisible() && tabBarConfig?.position !== 'top'
  const topVisible = isNativeTabBarVisible() && tabBarConfig?.position === 'top'
  container.style?.setProperty(
    '--weapp-tab-bar-inset',
    bottomVisible ? `calc(${TAB_BAR_HEIGHT} + var(--weapp-safe-area-inset-bottom, 0px))` : '0px',
  )
  container.style?.setProperty('--weapp-tab-bar-top-inset', topVisible ? TAB_BAR_HEIGHT : '0px')
}

function updateInstances() {
  syncContainerInsets()
  for (const instance of instances) {
    instance.renderTabBar()
  }
}

function ensureTabBarMounted() {
  onDocumentReady(() => {
    const container = ensureAppContainer()
    if (!container || tabBarConfig?.custom || !tabBarConfig) {
      container?.querySelector(TAB_BAR_TAG)?.remove()
      syncContainerInsets()
      return
    }
    let element = container.querySelector(TAB_BAR_TAG) as WeappTabBar | null
    if (!element) {
      element = document.createElement(TAB_BAR_TAG) as WeappTabBar
      container.append(element)
    }
    element.renderTabBar()
  })
}

function resolveItem(index: number) {
  if (!Number.isInteger(index) || index < 0 || !tabBarConfig?.list[index]) {
    return undefined
  }
  return tabBarConfig.list[index]
}

class WeappTabBar extends BaseElement {
  connectedCallback() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' })
    }
    instances.add(this)
    this.renderTabBar()
  }

  disconnectedCallback() {
    instances.delete(this)
  }

  renderTabBar() {
    const root = this.shadowRoot
    const config = tabBarConfig
    if (!root || !config || config.custom) {
      return
    }
    this.toggleAttribute('hidden', !isNativeTabBarVisible())
    this.setAttribute('position', config.position)
    this.toggleAttribute('data-animation', animationEnabled)
    this.style.setProperty('--weapp-tab-bar-color', config.color)
    this.style.setProperty('--weapp-tab-bar-selected-color', config.selectedColor)
    this.style.setProperty('--weapp-tab-bar-background', config.backgroundColor)
    this.style.setProperty(
      '--weapp-tab-bar-border-color',
      config.borderStyle === 'white' ? 'rgba(255, 255, 255, 0.33)' : 'rgba(0, 0, 0, 0.33)',
    )
    root.replaceChildren(this.#createStyle(), this.#createBar(config))
  }

  #createStyle() {
    const style = document.createElement('style')
    style.textContent = TAB_BAR_STYLE
    return style
  }

  #createBar(config: WebTabBarConfig) {
    const bar = document.createElement('nav')
    bar.className = 'weapp-tab-bar'
    bar.setAttribute('aria-label', 'Tab bar')
    for (const [index, item] of config.list.entries()) {
      bar.append(this.#createItem(item, index))
    }
    return bar
  }

  #createItem(item: WebTabBarItem, index: number) {
    const selected = item.pagePath === activeRoute
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'weapp-tab-bar__item'
    button.dataset.index = String(index)
    button.dataset.pagePath = item.pagePath
    if (selected) {
      button.setAttribute('aria-current', 'page')
    }
    const iconPath = resolveAssetUrl(selected ? (item.selectedIconPath ?? item.iconPath) : item.iconPath)
    const state = itemStates[index]
    if (iconPath || state?.badge || state?.redDot) {
      const iconWrap = document.createElement('span')
      iconWrap.className = 'weapp-tab-bar__icon-wrap'
      if (iconPath) {
        const icon = document.createElement('img')
        icon.className = 'weapp-tab-bar__icon'
        icon.src = iconPath
        icon.alt = ''
        iconWrap.append(icon)
      }
      if (state?.badge || state?.redDot) {
        const badge = document.createElement('span')
        badge.className = state.redDot
          ? 'weapp-tab-bar__badge weapp-tab-bar__badge--dot'
          : 'weapp-tab-bar__badge'
        badge.textContent = state.redDot ? '' : state.badge!
        iconWrap.append(badge)
      }
      button.append(iconWrap)
    }
    const label = document.createElement('span')
    label.className = 'weapp-tab-bar__label'
    label.textContent = item.text
    button.append(label)
    button.addEventListener('click', () => {
      if (selected || !switchTabHandler) {
        return
      }
      void switchTabHandler(`/${item.pagePath}`).catch(() => {})
    })
    return button
  }
}

export function ensureTabBarDefined() {
  if (typeof customElements === 'undefined' || customElements.get(TAB_BAR_TAG)) {
    return
  }
  customElements.define(TAB_BAR_TAG, WeappTabBar)
}

export function configureTabBar(config: WebTabBarConfig | undefined, onSwitchTab: SwitchTabHandler) {
  ensureTabBarDefined()
  tabBarConfig = config
    ? {
        ...config,
        list: config.list.map(item => ({ ...item })),
      }
    : undefined
  switchTabHandler = onSwitchTab
  itemStates = config?.list.map(() => ({})) ?? []
  requestedVisible = true
  animationEnabled = false
  ensureTabBarMounted()
  updateInstances()
}

export function getTabBarPagePaths() {
  return new Set(tabBarConfig?.list.map(item => item.pagePath) ?? [])
}

export function syncTabBarRoute(route: string) {
  activeRoute = route
  ensureTabBarMounted()
  updateInstances()
}

export function setTabBarVisible(visible: boolean, animation = false) {
  requestedVisible = visible
  animationEnabled = animation
  updateInstances()
  return true
}

export function updateTabBarItem(index: number, patch: Partial<Omit<WebTabBarItem, 'pagePath'>>) {
  const item = resolveItem(index)
  if (!item) {
    return false
  }
  Object.assign(item, patch)
  updateInstances()
  return true
}

export function updateTabBarStyle(patch: Partial<Pick<WebTabBarConfig, 'color' | 'selectedColor' | 'backgroundColor' | 'borderStyle'>>) {
  if (!tabBarConfig) {
    return false
  }
  Object.assign(tabBarConfig, patch)
  updateInstances()
  return true
}

export function setTabBarBadgeState(index: number, badge: string | undefined) {
  if (!resolveItem(index)) {
    return false
  }
  itemStates[index] = { badge, redDot: false }
  updateInstances()
  return true
}

export function setTabBarRedDotState(index: number, redDot: boolean) {
  if (!resolveItem(index)) {
    return false
  }
  itemStates[index] = { redDot, badge: undefined }
  updateInstances()
  return true
}

export type { WebTabBarConfig, WebTabBarItem } from '../../../shared/tabBar'
