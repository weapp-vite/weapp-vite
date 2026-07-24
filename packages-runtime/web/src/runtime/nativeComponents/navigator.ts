import type { MiniProgramBaseResult, NavigateToMiniProgramOptions } from '../polyfill/types'
import { getNativeComponentDescriptor } from '../../shared/nativeComponents'
import { navigateBack, navigateTo, redirectTo, reLaunch, switchTab } from '../polyfill/routeRuntime'
import { exitMiniProgram, navigateToMiniProgram } from '../polyfill/runtimeDataApi'
import { emitRuntimeWarning } from '../warning'
import { dispatchMiniProgramEvent, readBooleanAttribute, resolveContainingShadowRoot } from './helpers'
import { ensureNativeComponentStyle } from './style'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

type NavigatorOpenType = 'navigate' | 'redirect' | 'switchtab' | 'relaunch' | 'navigateback' | 'exit'

interface NavigatorRuntimeBridge {
  navigateTo: typeof navigateTo
  redirectTo: typeof redirectTo
  switchTab: typeof switchTab
  reLaunch: typeof reLaunch
  navigateBack: typeof navigateBack
  navigateToMiniProgram: typeof navigateToMiniProgram
  exitMiniProgram: typeof exitMiniProgram
}

export interface NavigatorRequest {
  url: string
  openType: string
  delta: number
  target: string
  appId?: string
  path?: string
  extraData?: Record<string, unknown>
  envVersion?: 'develop' | 'trial' | 'release'
  success?: (result: MiniProgramBaseResult) => void
  fail?: (result: MiniProgramBaseResult) => void
  complete?: (result: MiniProgramBaseResult) => void
}

const defaultBridge: NavigatorRuntimeBridge = {
  navigateTo,
  redirectTo,
  switchTab,
  reLaunch,
  navigateBack,
  navigateToMiniProgram,
  exitMiniProgram,
}

function normalizeOpenType(value: string): NavigatorOpenType {
  const normalized = value.trim().toLowerCase()
  switch (normalized) {
    case 'redirect':
    case 'switchtab':
    case 'relaunch':
    case 'navigateback':
    case 'exit':
      return normalized
    default:
      return 'navigate'
  }
}

function withNavigatorCallbacks<T extends Record<string, unknown>>(options: T, request: NavigatorRequest) {
  if (request.success) {
    Object.assign(options, { success: request.success })
  }
  if (request.fail) {
    Object.assign(options, { fail: request.fail })
  }
  if (request.complete) {
    Object.assign(options, { complete: request.complete })
  }
  return options
}

export function executeNavigatorRequest(
  request: NavigatorRequest,
  bridge: NavigatorRuntimeBridge = defaultBridge,
) {
  const openType = normalizeOpenType(request.openType)
  if (request.target.trim().toLowerCase() === 'miniprogram') {
    if (openType === 'exit') {
      return bridge.exitMiniProgram({
        success: request.success,
        fail: request.fail,
        complete: request.complete,
      })
    }
    const options: NavigateToMiniProgramOptions = {
      appId: request.appId,
      path: request.path,
      extraData: request.extraData,
      envVersion: request.envVersion,
      success: request.success,
      fail: request.fail,
      complete: request.complete,
    }
    return bridge.navigateToMiniProgram(options)
  }

  switch (openType) {
    case 'redirect':
      return bridge.redirectTo(withNavigatorCallbacks({ url: request.url }, request))
    case 'switchtab':
      return bridge.switchTab(withNavigatorCallbacks({ url: request.url }, request))
    case 'relaunch':
      return bridge.reLaunch(withNavigatorCallbacks({ url: request.url }, request))
    case 'navigateback':
      return bridge.navigateBack(withNavigatorCallbacks({ delta: request.delta }, request))
    case 'exit':
      emitRuntimeWarning('[@weapp-vite/web] navigator open-type="exit" 仅在 target="miniProgram" 时生效', {
        key: 'navigator:self:exit',
        context: 'native-component:navigator',
      })
      return Promise.resolve()
    default:
      return bridge.navigateTo(withNavigatorCallbacks({ url: request.url }, request))
  }
}

export function resolveNavigatorExtraData(value: unknown, attributeValue?: string | null) {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>
  }
  const serialized = typeof value === 'string' ? value : attributeValue
  if (!serialized) {
    return undefined
  }
  try {
    const parsed = JSON.parse(serialized) as unknown
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : undefined
  }
  catch {
    return undefined
  }
}

function parseNumber(value: string | null, fallback: number) {
  const number = Number(value)
  return value !== null && Number.isFinite(number) ? number : fallback
}

function resolveHoverClass(element: HTMLElement) {
  const value = element.getAttribute('hover-class') ?? element.getAttribute('data-hover-class')
  if (value === 'none') {
    return ''
  }
  return value || 'navigator-hover'
}

export class WeappNavigator extends BaseElement {
  static observedAttributes = [...getNativeComponentDescriptor('navigator')!.attributes]

  extraData?: Record<string, unknown> | string

  #anchor?: HTMLAnchorElement
  #hoverTimer?: ReturnType<typeof globalThis.setTimeout>
  #hoverRemoveTimer?: ReturnType<typeof globalThis.setTimeout>
  #lastTouchTime = 0
  #bound = false

  connectedCallback() {
    ensureNativeComponentStyle(resolveContainingShadowRoot(this))
    this.#ensureStructure()
    this.#syncAttributes()
    this.#bindEvents()
  }

  disconnectedCallback() {
    this.#clearHoverTimers()
  }

  attributeChangedCallback() {
    this.#syncAttributes()
  }

  #ensureStructure() {
    if (this.#anchor || typeof document === 'undefined') {
      return
    }
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = `
      :host { -webkit-tap-highlight-color: transparent; }
      :host(.navigator-hover) { opacity: 0.7; }
      a { display: block; width: 100%; height: 100%; color: inherit; text-decoration: none; outline: none; }
    `
    const anchor = document.createElement('a')
    anchor.append(document.createElement('slot'))
    root.append(style, anchor)
    this.#anchor = anchor
  }

  #syncAttributes() {
    if (!this.#anchor) {
      return
    }
    const url = this.getAttribute('url') ?? ''
    this.#anchor.href = url || '#'
    this.#anchor.setAttribute('aria-label', this.getAttribute('aria-label') ?? this.textContent?.trim() ?? '')
  }

  #bindEvents() {
    if (this.#bound || !this.#anchor) {
      return
    }
    this.#bound = true
    this.#anchor.addEventListener('click', this.#handleClick)
    this.addEventListener('touchstart', this.#handlePressStart, { passive: true })
    this.addEventListener('mousedown', this.#handlePressStart)
    this.addEventListener('touchend', this.#handlePressEnd)
    this.addEventListener('touchcancel', this.#handlePressEnd)
    this.addEventListener('mouseup', this.#handlePressEnd)
    this.addEventListener('mouseleave', this.#handlePressEnd)
  }

  #handleClick = (event: MouseEvent) => {
    event.preventDefault()
    const target = this.getAttribute('target') ?? 'self'
    const shortLink = this.getAttribute('short-link')
    if (target.toLowerCase() === 'miniprogram' && shortLink && !this.getAttribute('app-id')) {
      emitRuntimeWarning('[@weapp-vite/web] navigator short-link 暂无浏览器等价实现，请同时提供 app-id', {
        key: 'navigator:miniprogram:short-link',
        context: 'native-component:navigator',
      })
    }
    const version = this.getAttribute('version')
    const envVersion = version === 'develop' || version === 'trial' || version === 'release'
      ? version
      : undefined
    void executeNavigatorRequest({
      url: this.getAttribute('url') ?? '',
      openType: this.getAttribute('open-type') ?? 'navigate',
      delta: Math.max(1, parseNumber(this.getAttribute('delta'), 1)),
      target,
      appId: this.getAttribute('app-id') ?? undefined,
      path: this.getAttribute('path') ?? undefined,
      extraData: resolveNavigatorExtraData(this.extraData, this.getAttribute('extra-data')),
      envVersion,
      success: result => dispatchMiniProgramEvent(this, 'success', result),
      fail: result => dispatchMiniProgramEvent(this, 'fail', result),
      complete: result => dispatchMiniProgramEvent(this, 'complete', result),
    }).catch(() => {})
  }

  #handlePressStart = (event: Event) => {
    const hoverClass = resolveHoverClass(this)
    if (!hoverClass) {
      return
    }
    if (readBooleanAttribute(this, 'hover-stop-propagation')) {
      event.stopPropagation()
    }
    if (event.type === 'touchstart') {
      this.#lastTouchTime = Date.now()
    }
    if (event.type === 'mousedown' && Date.now() - this.#lastTouchTime < 400) {
      return
    }
    this.#clearHoverTimers()
    const startTime = Math.max(0, parseNumber(this.getAttribute('hover-start-time'), 50))
    this.#hoverTimer = globalThis.setTimeout(() => this.classList.add(hoverClass), startTime)
  }

  #handlePressEnd = (event: Event) => {
    const hoverClass = resolveHoverClass(this)
    if (!hoverClass || (event.type === 'mouseup' && Date.now() - this.#lastTouchTime < 400)) {
      return
    }
    if (this.#hoverTimer) {
      clearTimeout(this.#hoverTimer)
      this.#hoverTimer = undefined
    }
    if (this.classList.contains(hoverClass)) {
      const stayTime = Math.max(0, parseNumber(this.getAttribute('hover-stay-time'), 600))
      this.#hoverRemoveTimer = globalThis.setTimeout(() => this.classList.remove(hoverClass), stayTime)
    }
  }

  #clearHoverTimers() {
    if (this.#hoverTimer) {
      clearTimeout(this.#hoverTimer)
      this.#hoverTimer = undefined
    }
    if (this.#hoverRemoveTimer) {
      clearTimeout(this.#hoverRemoveTimer)
      this.#hoverRemoveTimer = undefined
    }
  }
}
