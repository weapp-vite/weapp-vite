import type { TemplateRenderer } from './template'

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

const EVENT_TO_DOM: Record<string, string> = {
  tap: 'click',
  input: 'input',
  change: 'change',
  submit: 'submit',
  blur: 'blur',
  focus: 'focus',
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

function bindRuntimeEvents(root: HTMLElement, methods: Record<string, (event: any) => any>, instance: ComponentPublicInstance) {
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
      const eventName = attribute.slice('data-wx-on-'.length)
      const handler = methods[handlerName]
      if (!handler) {
        continue
      }
      const domEvent = EVENT_TO_DOM[eventName] ?? eventName
      element.addEventListener(domEvent, (nativeEvent) => {
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

export function defineComponent(tagName: string, options: DefineComponentOptions) {
  if (!options || typeof options !== 'object') {
    throw new TypeError('[@weapp-vite/web] defineComponent 需要提供配置对象。')
  }

  if (customElements.get(tagName)) {
    return customElements.get(tagName) as CustomElementConstructor
  }

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

  class WeappWebComponent extends HTMLElement implements ComponentPublicInstance {
    static get observedAttributes() {
      return observedAttributes
    }

    #state: DataRecord
    #properties: DataRecord
    #methods: Record<string, (event: any) => any>
    #shadow: ShadowRoot
    #contentRoot: HTMLElement
    #styleElement?: HTMLStyleElement
    #isMounted = false

    constructor() {
      super()

      const dataOption = typeof component.data === 'function'
        ? (component.data as () => DataRecord)()
        : (component.data ?? {})

      this.#properties = { ...defaultPropertyValues }
      this.#state = { ...cloneValue(this.#properties), ...cloneValue(dataOption) }

      this.#shadow = this.attachShadow({ mode: 'open' })

      if (style) {
        this.#styleElement = document.createElement('style')
        this.#styleElement.textContent = style
        this.#shadow.append(this.#styleElement)
      }

      this.#contentRoot = document.createElement('div')
      this.#contentRoot.setAttribute('part', 'content')
      this.#shadow.append(this.#contentRoot)

      this.#methods = {}
      for (const [name, fn] of Object.entries(component.methods ?? {})) {
        if (typeof fn === 'function') {
          this.#methods[name] = fn.bind(this)
        }
      }

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
      this.#applyAttributes()
      this.#render()
      lifetimes.attached?.call(this)
      this.#isMounted = true
      lifetimes.ready?.call(this)
    }

    disconnectedCallback() {
      this.#isMounted = false
      lifetimes.detached?.call(this)
    }

    attributeChangedCallback(attrName: string, _oldValue: string | null, newValue: string | null) {
      const propName = toCamelCase(attrName)
      if (!Object.prototype.hasOwnProperty.call(this.#properties, propName)) {
        return
      }
      const propOption = component.properties?.[propName]
      const coerced = coerceValue(newValue, propOption?.type)
      this.#setProperty(propName, coerced)
    }

    #applyAttributes() {
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
        this.#render()
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
        this.#render()
      }
      propOption?.observer?.call(this, coerced, oldValue)
    }

    #render() {
      const html = template(this.#state)
      if (!this.#contentRoot) {
        return
      }
      this.#contentRoot.innerHTML = html
      bindRuntimeEvents(this.#contentRoot, this.#methods, this)
    }
  }

  customElements.define(tagName, WeappWebComponent)
  return WeappWebComponent
}

export type { ComponentOptions, PropertyOption }
