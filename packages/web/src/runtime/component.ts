import type { TemplateRenderer } from './template'

import { html, LitElement } from 'lit'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'
import { createRenderContext } from './renderContext'
import { emitRuntimeWarning } from './warning'

type DataRecord = Record<string, any>

interface PropertyOption {
  type?: StringConstructor | NumberConstructor | BooleanConstructor | ObjectConstructor | ArrayConstructor | null
  value?: any
  observer?: (this: ComponentPublicInstance, newValue: any, oldValue: any) => void
}

interface LifeTimeHooks {
  created?: (this: ComponentPublicInstance) => void
  attached?: (this: ComponentPublicInstance) => void
  ready?: (this: ComponentPublicInstance) => void
  detached?: (this: ComponentPublicInstance) => void
}

interface PageLifeTimeHooks {
  show?: (this: ComponentPublicInstance) => void
  hide?: (this: ComponentPublicInstance) => void
  resize?: (this: ComponentPublicInstance) => void
}

interface ComponentOptions {
  properties?: Record<string, PropertyOption>
  data?: DataRecord | (() => DataRecord)
  methods?: Record<string, (this: ComponentPublicInstance, event: any) => any>
  lifetimes?: LifeTimeHooks
  pageLifetimes?: PageLifeTimeHooks
  behaviors?: ComponentOptions[]
}

export interface DefineComponentOptions {
  template: TemplateRenderer
  style?: string
  component?: ComponentOptions
  observerInit?: boolean
}

export interface ComponentPublicInstance extends HTMLElement {
  readonly data: DataRecord
  readonly properties: DataRecord
  setData: (patch: DataRecord) => void
  triggerEvent: (name: string, detail?: any) => void
}

const supportsLit = typeof document !== 'undefined'
  && typeof document.createComment === 'function'
  && typeof document.createTreeWalker === 'function'

const FallbackElement = class {}
const EVENT_FLAG_ATTRIBUTE_PREFIX = 'data-wx-on-flags-'

function parseEventFlags(value: string | null) {
  if (!value) {
    return { catch: false, capture: false }
  }
  const tokens = value.split(',').map(token => token.trim()).filter(Boolean)
  const tokenSet = new Set(tokens)
  return {
    catch: tokenSet.has('catch'),
    capture: tokenSet.has('capture'),
  }
}

function bindRuntimeEvents(
  root: HTMLElement | ShadowRoot,
  methods: Record<string, (event: any) => any>,
  instance: ComponentPublicInstance,
) {
  if (typeof document === 'undefined') {
    return
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  while (walker.nextNode()) {
    const element = walker.currentNode as HTMLElement
    for (const attribute of element.getAttributeNames()) {
      if (!attribute.startsWith('data-wx-on-') || attribute.startsWith(EVENT_FLAG_ATTRIBUTE_PREFIX)) {
        continue
      }
      const handlerName = element.getAttribute(attribute)
      if (!handlerName) {
        continue
      }
      const handler = methods[handlerName]
      if (!handler) {
        continue
      }
      const eventName = attribute.slice('data-wx-on-'.length)
      const flags = parseEventFlags(element.getAttribute(`${EVENT_FLAG_ATTRIBUTE_PREFIX}${eventName}`))
      element.addEventListener(eventName, (nativeEvent) => {
        if (flags.catch) {
          nativeEvent.stopPropagation()
        }
        const dataset = { ...element.dataset }
        const syntheticEvent = {
          type: eventName,
          timeStamp: nativeEvent.timeStamp,
          detail: (nativeEvent as CustomEvent).detail ?? (nativeEvent as InputEvent).data ?? undefined,
          target: {
            dataset,
          },
          currentTarget: {
            dataset,
          },
          originalEvent: nativeEvent,
        }
        handler.call(instance, syntheticEvent)
      }, flags.capture)
    }
  }
}

function hyphenate(name: string) {
  return name.replace(/([A-Z])/g, (_, char: string) => `-${char.toLowerCase()}`)
}

function toCamelCase(name: string) {
  return name.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
}

function cloneValue(value: any) {
  if (Array.isArray(value)) {
    return value.slice()
  }
  if (value && typeof value === 'object') {
    return { ...value }
  }
  return value
}

function coerceValue(value: any, type?: PropertyOption['type']) {
  if (type === Boolean) {
    if (value === '' || value === true) {
      return true
    }
    if (value === undefined || value === null || value === false) {
      return false
    }
    if (typeof value === 'string') {
      return value !== 'false'
    }
    return Boolean(value)
  }

  if (type === Number) {
    if (value === undefined || value === null) {
      return value
    }
    const numeric = Number(value)
    return Number.isNaN(numeric) ? value : numeric
  }

  if (type === Object || type === Array) {
    if (value === undefined || value === null) {
      return value
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value)
      }
      catch {
        return value
      }
    }
    return value
  }

  return value
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeLifetimes(target: LifeTimeHooks, source?: LifeTimeHooks) {
  if (!source) {
    return
  }
  const keys: Array<keyof LifeTimeHooks> = ['created', 'attached', 'ready', 'detached']
  for (const key of keys) {
    const next = source[key]
    if (!next) {
      continue
    }
    const current = target[key]
    target[key] = current
      ? function merged(this: ComponentPublicInstance) {
        current.call(this)
        next.call(this)
      }
      : next
  }
}

function mergePageLifetimes(target: PageLifeTimeHooks, source?: PageLifeTimeHooks) {
  if (!source) {
    return
  }
  const keys: Array<keyof PageLifeTimeHooks> = ['show', 'hide', 'resize']
  for (const key of keys) {
    const next = source[key]
    if (!next) {
      continue
    }
    const current = target[key]
    target[key] = current
      ? function merged(this: ComponentPublicInstance) {
        current.call(this)
        next.call(this)
      }
      : next
  }
}

function normalizeBehaviors(component: ComponentOptions | undefined) {
  if (!component) {
    return { component: undefined, warnings: [] as string[] }
  }
  const warnings: string[] = []
  const visited = new Set<ComponentOptions>()
  const merged: ComponentOptions = {}

  const mergeComponent = (source: ComponentOptions) => {
    if (source.properties) {
      merged.properties = { ...(merged.properties ?? {}), ...source.properties }
    }
    if (source.data) {
      const nextData = typeof source.data === 'function'
        ? source.data()
        : source.data
      if (isPlainObject(nextData)) {
        merged.data = { ...((merged.data as DataRecord) ?? {}), ...nextData }
      }
    }
    if (source.methods) {
      merged.methods = { ...(merged.methods ?? {}), ...source.methods }
    }
    if (source.lifetimes) {
      merged.lifetimes = merged.lifetimes ?? {}
      mergeLifetimes(merged.lifetimes, source.lifetimes)
    }
    if (source.pageLifetimes) {
      merged.pageLifetimes = merged.pageLifetimes ?? {}
      mergePageLifetimes(merged.pageLifetimes, source.pageLifetimes)
    }
  }

  const walk = (source: ComponentOptions) => {
    if (visited.has(source)) {
      warnings.push('[@weapp-vite/web] behaviors 存在循环引用，已跳过。')
      return
    }
    visited.add(source)
    const behaviors = source.behaviors ?? []
    if (Array.isArray(behaviors)) {
      for (const behavior of behaviors) {
        if (!behavior || !isPlainObject(behavior)) {
          warnings.push('[@weapp-vite/web] behaviors 仅支持对象，已忽略非对象条目。')
          continue
        }
        walk(behavior as ComponentOptions)
        mergeComponent(behavior as ComponentOptions)
      }
    }
    else if (behaviors) {
      warnings.push('[@weapp-vite/web] behaviors 仅支持数组，已忽略。')
    }
  }

  walk(component)
  mergeComponent(component)

  return {
    component: merged,
    warnings,
  }
}

type ComponentConstructor = CustomElementConstructor & {
  __weappUpdate?: (options: DefineComponentOptions) => void
}

export function defineComponent(tagName: string, options: DefineComponentOptions) {
  if (!options || typeof options !== 'object') {
    throw new TypeError('[@weapp-vite/web] defineComponent 需要提供配置对象。')
  }

  const existing = customElements.get(tagName) as ComponentConstructor | undefined
  if (existing) {
    existing.__weappUpdate?.(options)
    return existing
  }

  const BaseElement = (supportsLit ? LitElement : (globalThis.HTMLElement ?? FallbackElement)) as typeof HTMLElement

  const { template, style = '', component = {}, observerInit = false } = options
  if (!template) {
    throw new Error('[@weapp-vite/web] defineComponent 需要提供模板渲染函数。')
  }

  const normalized = normalizeBehaviors(component)
  for (const warning of normalized.warnings) {
    emitRuntimeWarning(warning, {
      key: `component-behaviors:${warning}`,
      context: 'runtime:component',
    })
  }

  let templateRef = template
  let styleRef = style
  let componentRef = normalized.component ?? component
  let observerInitEnabled = Boolean(observerInit)
  let propertyEntries = Object.entries(componentRef.properties ?? {})
  let observedAttributes = propertyEntries.map(([name]) => hyphenate(name))

  let defaultPropertyValues = propertyEntries.reduce<DataRecord>((acc, [name, prop]) => {
    if (Object.prototype.hasOwnProperty.call(prop, 'value')) {
      acc[name] = cloneValue(prop.value)
    }
    else {
      acc[name] = undefined
    }
    return acc
  }, {})

  let lifetimes = componentRef.lifetimes ?? {}
  let pageLifetimes = componentRef.pageLifetimes ?? {}

  const instances = new Set<WeappWebComponent>()

  class WeappWebComponent extends BaseElement implements ComponentPublicInstance {
    static get observedAttributes() {
      return observedAttributes
    }

    #state: DataRecord
    #properties: DataRecord
    #methods: Record<string, (event: any) => any>
    #isMounted = false
    #renderContext = createRenderContext(this, {})
    #usesLegacyTemplate = false
    #readyFired = false
    #observerInitDone = false
    #observedKeys = new Set<string>()

    constructor() {
      super()

      const dataOption = typeof componentRef.data === 'function'
        ? (componentRef.data as () => DataRecord)()
        : (componentRef.data ?? {})

      this.#properties = { ...defaultPropertyValues }
      this.#state = { ...cloneValue(this.#properties), ...cloneValue(dataOption) }

      this.#methods = {}
      this.#syncMethods(componentRef.methods ?? {})

      for (const [propName] of propertyEntries) {
        Object.defineProperty(this, propName, {
          configurable: true,
          enumerable: true,
          get: () => this.#state[propName],
          set: (value) => {
            this.#setProperty(propName, value)
          },
        })
      }

      if (!supportsLit) {
        const host = this as unknown as HTMLElement
        if (!host.shadowRoot && typeof host.attachShadow === 'function') {
          host.attachShadow({ mode: 'open' })
        }
        ;(this as any).renderRoot = host.shadowRoot ?? host
      }

      instances.add(this)
      lifetimes.created?.call(this)
    }

    get data() {
      return this.#state
    }

    get properties() {
      return this.#properties
    }

    setData(patch: DataRecord) {
      this.#applyDataPatch(patch)
    }

    triggerEvent(name: string, detail?: any) {
      this.dispatchEvent(new CustomEvent(name, {
        detail,
        bubbles: true,
        composed: true,
      }))
    }

    connectedCallback() {
      const superConnected = (BaseElement.prototype as { connectedCallback?: () => void }).connectedCallback
      if (supportsLit && typeof superConnected === 'function') {
        superConnected.call(this)
      }
      this.#applyAttributes()
      if (observerInitEnabled) {
        this.#runInitialObservers()
      }
      lifetimes.attached?.call(this)
      this.#isMounted = true
      if (!supportsLit) {
        this.#renderLegacy()
      }
    }

    disconnectedCallback() {
      const superDisconnected = (BaseElement.prototype as { disconnectedCallback?: () => void }).disconnectedCallback
      if (supportsLit && typeof superDisconnected === 'function') {
        superDisconnected.call(this)
      }
      this.#isMounted = false
      instances.delete(this)
      lifetimes.detached?.call(this)
    }

    attributeChangedCallback(attrName: string, oldValue: string | null, newValue: string | null) {
      const superAttributeChanged = (BaseElement.prototype as {
        attributeChangedCallback?: (name: string, oldValue: string | null, newValue: string | null) => void
      }).attributeChangedCallback
      if (supportsLit && typeof superAttributeChanged === 'function') {
        superAttributeChanged.call(this, attrName, oldValue, newValue)
      }
      const propName = toCamelCase(attrName)
      if (!Object.prototype.hasOwnProperty.call(this.#properties, propName)) {
        return
      }
      const propOption = componentRef.properties?.[propName]
      const coerced = coerceValue(newValue, propOption?.type)
      this.#setProperty(propName, coerced)
    }

    firstUpdated() {
      lifetimes.ready?.call(this)
      this.#readyFired = true
    }

    updated() {
      if (this.#usesLegacyTemplate) {
        const renderRoot = (this as { renderRoot?: HTMLElement | ShadowRoot }).renderRoot
          ?? this.shadowRoot
          ?? this
        bindRuntimeEvents(renderRoot, this.#methods, this)
      }
    }

    render() {
      const result = templateRef(this.#state, this.#renderContext)
      const styleMarkup = styleRef
        ? html`<style>${styleRef}</style>`
        : null
      if (typeof result === 'string') {
        this.#usesLegacyTemplate = true
        return html`${styleMarkup}${unsafeHTML(result)}`
      }
      this.#usesLegacyTemplate = false
      if (styleMarkup) {
        return html`${styleMarkup}${result as any}`
      }
      return result
    }

    requestUpdate(name?: PropertyKey, oldValue?: unknown, options?: unknown) {
      const superRequestUpdate = (BaseElement.prototype as any).requestUpdate
      if (supportsLit && typeof superRequestUpdate === 'function') {
        return superRequestUpdate.call(this, name, oldValue, options)
      }
      if (this.#isMounted) {
        this.#renderLegacy()
      }
      return undefined
    }

    #applyAttributes() {
      if (!this.attributes || typeof this.attributes[Symbol.iterator] !== 'function') {
        return
      }
      for (const attr of this.attributes) {
        this.attributeChangedCallback(attr.name, null, attr.value)
      }
    }

    #applyDataPatch(patch: DataRecord) {
      if (!patch || typeof patch !== 'object') {
        return
      }
      let changed = false
      for (const [key, value] of Object.entries(patch)) {
        if (this.#state[key] !== value) {
          const oldValue = this.#state[key]
          this.#state[key] = value
          if (Object.prototype.hasOwnProperty.call(this.#properties, key)) {
            this.#properties[key] = value
            const propOption = componentRef.properties?.[key]
            if (propOption?.observer) {
              propOption.observer.call(this, value, oldValue)
              this.#observedKeys.add(key)
            }
          }
          changed = true
        }
      }
      if (changed) {
        this.requestUpdate()
      }
    }

    #setProperty(name: string, value: any) {
      const propOption = componentRef.properties?.[name]
      const coerced = coerceValue(value, propOption?.type)
      const oldValue = this.#properties[name]
      if (oldValue === coerced) {
        return
      }
      this.#properties[name] = coerced
      this.#state[name] = coerced
      if (this.#isMounted) {
        this.requestUpdate()
      }
      if (propOption?.observer) {
        propOption.observer.call(this, coerced, oldValue)
        this.#observedKeys.add(name)
      }
    }

    #runInitialObservers() {
      if (this.#observerInitDone) {
        return
      }
      this.#observerInitDone = true
      for (const [propName, propOption] of propertyEntries) {
        if (!propOption.observer || this.#observedKeys.has(propName)) {
          continue
        }
        const value = this.#state[propName]
        propOption.observer.call(this, value, undefined)
        this.#observedKeys.add(propName)
      }
    }

    #syncMethods(nextMethods: ComponentOptions['methods']) {
      const resolved = nextMethods ?? {}
      const bound: Record<string, (event: any) => any> = {}
      for (const [name, fn] of Object.entries(resolved)) {
        if (typeof fn === 'function') {
          bound[name] = fn.bind(this)
        }
      }
      for (const key of Object.keys(this.#methods)) {
        if (!(key in bound)) {
          delete this.#methods[key]
        }
      }
      for (const [key, fn] of Object.entries(bound)) {
        this.#methods[key] = fn
      }
      this.#renderContext = createRenderContext(this, this.#methods)
    }

    __weappSync(nextMethods: ComponentOptions['methods']) {
      this.#syncMethods(nextMethods)
      this.requestUpdate()
    }

    __weappInvokePageLifetime(type: keyof PageLifeTimeHooks) {
      const hook = pageLifetimes[type]
      if (typeof hook === 'function') {
        hook.call(this)
      }
    }

    #renderLegacy() {
      const result = templateRef(this.#state, this.#renderContext)
      const root = (this as any).renderRoot ?? this.shadowRoot ?? this
      const styleMarkup = styleRef ? `<style>${styleRef}</style>` : ''
      if (typeof result === 'string') {
        root.innerHTML = `${styleMarkup}${result}`
        bindRuntimeEvents(root as ShadowRoot, this.#methods, this)
      }
      else if (result == null) {
        root.innerHTML = styleMarkup
      }
      else {
        root.innerHTML = `${styleMarkup}${String(result)}`
      }
      if (!this.#readyFired) {
        lifetimes.ready?.call(this)
        this.#readyFired = true
      }
    }
  }

  const updateComponent = (nextOptions: DefineComponentOptions) => {
    if (!nextOptions?.template) {
      return
    }
    templateRef = nextOptions.template
    styleRef = nextOptions.style ?? ''
    const nextNormalized = normalizeBehaviors(nextOptions.component ?? {})
    for (const warning of nextNormalized.warnings) {
      emitRuntimeWarning(warning, {
        key: `component-behaviors:${warning}`,
        context: 'runtime:component',
      })
    }
    componentRef = nextNormalized.component ?? nextOptions.component ?? {}
    observerInitEnabled = Boolean(nextOptions.observerInit)
    lifetimes = componentRef.lifetimes ?? {}
    pageLifetimes = componentRef.pageLifetimes ?? {}
    propertyEntries = Object.entries(componentRef.properties ?? {})
    observedAttributes = propertyEntries.map(([name]) => hyphenate(name))
    defaultPropertyValues = propertyEntries.reduce<DataRecord>((acc, [name, prop]) => {
      if (Object.prototype.hasOwnProperty.call(prop, 'value')) {
        acc[name] = cloneValue(prop.value)
      }
      else {
        acc[name] = undefined
      }
      return acc
    }, {})
    const nextMethods = componentRef.methods ?? {}
    for (const instance of instances) {
      instance.__weappSync(nextMethods)
    }
  }

  ;(WeappWebComponent as ComponentConstructor).__weappUpdate = updateComponent

  customElements.define(tagName, WeappWebComponent)
  return WeappWebComponent
}

export type { ComponentOptions, PropertyOption }
