import type { ComponentRuntimeState } from './state'
import type {
  ComponentOptions,
  ComponentPublicInstance,
  DataRecord,
  PageLifeTimeHooks,
} from './types'
import { html } from 'lit'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'
import { createRenderContext } from '../renderContext'
import { supportsLit } from './constants'
import {
  createScopedSelectorQuery,
  resolveRenderRoot,
  selectRuntimeComponent,
  selectRuntimeComponents,
} from './dom'
import { bindRuntimeEvents } from './events'
import { cloneValue, coerceValue, toCamelCase } from './utils'

export interface WeappComponentInstance extends ComponentPublicInstance {
  __weappSync: (nextMethods: ComponentOptions['methods']) => void
  __weappInvokePageLifetime: (type: keyof PageLifeTimeHooks) => void
}

interface CreateComponentElementClassOptions {
  BaseElement: typeof HTMLElement
  runtimeState: ComponentRuntimeState
  instances: Set<WeappComponentInstance>
}

export function createComponentElementClass({
  BaseElement,
  runtimeState,
  instances,
}: CreateComponentElementClassOptions) {
  class WeappWebComponent extends BaseElement implements WeappComponentInstance {
    static get observedAttributes() {
      return runtimeState.observedAttributes
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

      const dataOption = typeof runtimeState.componentRef.data === 'function'
        ? (runtimeState.componentRef.data as () => DataRecord)()
        : (runtimeState.componentRef.data ?? {})

      this.#properties = { ...runtimeState.defaultPropertyValues }
      this.#state = { ...cloneValue(this.#properties), ...cloneValue(dataOption) }

      this.#methods = {}
      this.#syncMethods(runtimeState.componentRef.methods ?? {})

      for (const [propName] of runtimeState.propertyEntries) {
        Object.defineProperty(this, propName, {
          configurable: true,
          enumerable: true,
          get: () => this.#state[propName],
          set: value => this.#setProperty(propName, value),
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
      runtimeState.lifetimes.created?.call(this)
    }

    get data() { return this.#state }
    get properties() { return this.#properties }
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

    createSelectorQuery() {
      return createScopedSelectorQuery(this)
    }

    selectComponent(selector: string) {
      return selectRuntimeComponent(this, selector)
    }

    selectAllComponents(selector: string) {
      return selectRuntimeComponents(this, selector)
    }

    connectedCallback() {
      const superConnected = (BaseElement.prototype as { connectedCallback?: () => void }).connectedCallback
      if (supportsLit && typeof superConnected === 'function') {
        superConnected.call(this)
      }
      this.#applyAttributes()
      if (runtimeState.observerInitEnabled) {
        this.#runInitialObservers()
      }
      runtimeState.lifetimes.attached?.call(this)
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
      runtimeState.lifetimes.detached?.call(this)
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
      const propOption = runtimeState.componentRef.properties?.[propName]
      this.#setProperty(propName, coerceValue(newValue, propOption?.type))
    }

    firstUpdated() {
      runtimeState.lifetimes.ready?.call(this)
      this.#readyFired = true
    }

    updated() {
      if (this.#usesLegacyTemplate) {
        bindRuntimeEvents(resolveRenderRoot(this), this.#methods, this)
      }
    }

    render() {
      const result = runtimeState.templateRef(this.#state, this.#renderContext)
      const styleMarkup = runtimeState.styleRef
        ? html`<style>${runtimeState.styleRef}</style>`
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
        if (this.#state[key] === value) {
          continue
        }
        const oldValue = this.#state[key]
        this.#state[key] = value
        if (Object.prototype.hasOwnProperty.call(this.#properties, key)) {
          this.#properties[key] = value
          const propOption = runtimeState.componentRef.properties?.[key]
          if (propOption?.observer) {
            propOption.observer.call(this, value, oldValue)
            this.#observedKeys.add(key)
          }
        }
        changed = true
      }
      if (changed) {
        this.requestUpdate()
      }
    }

    #setProperty(name: string, value: any) {
      const propOption = runtimeState.componentRef.properties?.[name]
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
      for (const [propName, propOption] of runtimeState.propertyEntries) {
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
      const hook = runtimeState.pageLifetimes[type]
      if (typeof hook === 'function') {
        hook.call(this)
      }
    }

    #renderLegacy() {
      const result = runtimeState.templateRef(this.#state, this.#renderContext)
      const root = resolveRenderRoot(this)
      const styleMarkup = runtimeState.styleRef ? `<style>${runtimeState.styleRef}</style>` : ''
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
        runtimeState.lifetimes.ready?.call(this)
        this.#readyFired = true
      }
    }
  }

  return WeappWebComponent
}
