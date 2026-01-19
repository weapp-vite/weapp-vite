import type { TemplateRenderer } from './template'

import { html, LitElement, unsafeCSS } from 'lit'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'
import { createRenderContext } from './renderContext'

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

interface ComponentOptions {
  properties?: Record<string, PropertyOption>
  data?: DataRecord | (() => DataRecord)
  methods?: Record<string, (this: ComponentPublicInstance, event: any) => any>
  lifetimes?: LifeTimeHooks
}

export interface DefineComponentOptions {
  template: TemplateRenderer
  style?: string
  component?: ComponentOptions
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
      if (!attribute.startsWith('data-wx-on-')) {
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
      element.addEventListener(eventName, (nativeEvent) => {
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
      })
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

export function defineComponent(tagName: string, options: DefineComponentOptions) {
  if (!options || typeof options !== 'object') {
    throw new TypeError('[@weapp-vite/web] defineComponent 需要提供配置对象。')
  }

  if (customElements.get(tagName)) {
    return customElements.get(tagName) as CustomElementConstructor
  }

  const BaseElement = (supportsLit ? LitElement : (globalThis.HTMLElement ?? FallbackElement)) as typeof HTMLElement

  const { template, style = '', component = {} } = options
  if (!template) {
    throw new Error('[@weapp-vite/web] defineComponent 需要提供模板渲染函数。')
  }

  const propertyEntries = Object.entries(component.properties ?? {})
  const observedAttributes = propertyEntries.map(([name]) => hyphenate(name))

  const defaultPropertyValues = propertyEntries.reduce<DataRecord>((acc, [name, prop]) => {
    if (Object.prototype.hasOwnProperty.call(prop, 'value')) {
      acc[name] = cloneValue(prop.value)
    }
    else {
      acc[name] = undefined
    }
    return acc
  }, {})

  const lifetimes = component.lifetimes ?? {}

  class WeappWebComponent extends BaseElement implements ComponentPublicInstance {
    static get observedAttributes() {
      return observedAttributes
    }

    static styles = style ? [unsafeCSS(style)] : []

    #state: DataRecord
    #properties: DataRecord
    #methods: Record<string, (event: any) => any>
    #isMounted = false
    #renderContext = createRenderContext(this, {})
    #usesLegacyTemplate = false
    #readyFired = false

    constructor() {
      super()

      const dataOption = typeof component.data === 'function'
        ? (component.data as () => DataRecord)()
        : (component.data ?? {})

      this.#properties = { ...defaultPropertyValues }
      this.#state = { ...cloneValue(this.#properties), ...cloneValue(dataOption) }

      this.#methods = {}
      for (const [name, fn] of Object.entries(component.methods ?? {})) {
        if (typeof fn === 'function') {
          this.#methods[name] = fn.bind(this)
        }
      }
      this.#renderContext = createRenderContext(this, this.#methods)

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
      const propOption = component.properties?.[propName]
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
      const result = template(this.#state, this.#renderContext)
      if (typeof result === 'string') {
        this.#usesLegacyTemplate = true
        return html`${unsafeHTML(result)}`
      }
      this.#usesLegacyTemplate = false
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
            component.properties?.[key]?.observer?.call(this, value, oldValue)
          }
          changed = true
        }
      }
      if (changed) {
        this.requestUpdate()
      }
    }

    #setProperty(name: string, value: any) {
      const propOption = component.properties?.[name]
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
      propOption?.observer?.call(this, coerced, oldValue)
    }

    #renderLegacy() {
      const result = template(this.#state, this.#renderContext)
      const root = (this as any).renderRoot ?? this.shadowRoot ?? this
      if (typeof result === 'string') {
        root.innerHTML = result
        bindRuntimeEvents(root as ShadowRoot, this.#methods, this)
      }
      else if (result == null) {
        root.innerHTML = ''
      }
      else {
        root.innerHTML = String(result)
      }
      if (!this.#readyFired) {
        lifetimes.ready?.call(this)
        this.#readyFired = true
      }
    }
  }

  customElements.define(tagName, WeappWebComponent)
  return WeappWebComponent
}

export type { ComponentOptions, PropertyOption }
