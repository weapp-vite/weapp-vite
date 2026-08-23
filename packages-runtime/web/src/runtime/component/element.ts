import type {
  CreateComponentElementClassOptions,
  WeappComponentInstance,
} from './elementTypes'
import type {
  ComponentOptions,
  ComponentPublicInstance,
  DataRecord,
  PageLifeTimeHooks,
  TriggerEventOptions,
} from './types'
import type { ClassAttributeElement } from './virtualHost'
import { html } from 'lit'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'
import { createIntersectionObserverBridge } from '../polyfill/intersectionObserver'
import { createRenderContext } from '../renderContext'
import { hasOwn } from '../utils/object'
import { supportsLit } from './constants'
import {
  createScopedSelectorQuery,
  resolveRenderRoot,
  selectRuntimeComponent,
  selectRuntimeComponents,
} from './dom'
import { bindRuntimeEvents } from './events'
import { runComponentObservers } from './observers'
import { createComponentPublicInstance } from './publicInstance'
import { resolveRelationNodes } from './relations'
import { createWebSlotsProxy } from './slots'
import { assignDataPath, cloneValue, coerceValue, parseDataPath, resolveDataPath, toCamelCase } from './utils'
import {
  clearVirtualHostClasses,
  clearVirtualHostParts,
  syncVirtualHostClasses,
  syncVirtualHostParts,
} from './virtualHost'

export type { WeappComponentInstance } from './elementTypes'
export type WeappComponentElementClass = typeof HTMLElement & {
  new (): WeappComponentInstance
}

function resolveComposedParent(node: Node): Node | undefined {
  const assignedSlot = (node as Element).assignedSlot
  if (assignedSlot) {
    return assignedSlot
  }
  if (node.parentNode) {
    return node.parentNode
  }
  const root = node.getRootNode?.()
  return root instanceof ShadowRoot ? root.host : undefined
}

function isWeappComponentInstance(value: unknown): value is WeappComponentInstance {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof (value as WeappComponentInstance).__weappSync === 'function',
  )
}

export function createComponentElementClass({
  BaseElement,
  runtimeState,
  instances,
}: CreateComponentElementClassOptions): WeappComponentElementClass {
  const RuntimeBaseElement = BaseElement as typeof HTMLElement & {
    readonly observedAttributes?: string[]
  }
  class WeappWebComponent extends RuntimeBaseElement implements WeappComponentInstance {
    static get observedAttributes() {
      const inherited = super.observedAttributes ?? []
      return Array.from(new Set([...inherited, ...runtimeState.observedAttributes]))
    }

    #state: DataRecord
    #properties: DataRecord
    #methods: Record<string, (event: any) => any> = {}
    #publicInstance: ComponentPublicInstance
    #exposedMethodNames = new Set<string>()
    #isMounted = false
    #renderContext = createRenderContext(this, {})
    #usesLegacyTemplate = false
    #readyFired = false
    #observerInitDone = false
    #observedKeys = new Set<string>()
    #virtualHostClassTokens = new Set<string>()
    #virtualHostPartTokens = new Set<string>()
    #virtualHostRootElement: ClassAttributeElement | undefined
    readonly data!: DataRecord
    readonly properties!: DataRecord

    constructor() {
      super()
      const dataOption = runtimeState.componentRef.data ?? {}
      this.#properties = { ...runtimeState.defaultPropertyValues }
      this.#state = { ...cloneValue(this.#properties), ...cloneValue(dataOption) }
      Object.defineProperty(this.#state, '$slots', {
        configurable: true,
        enumerable: true,
        value: createWebSlotsProxy(() => this.#state.vueSlots),
      })
      Object.defineProperties(this, {
        data: {
          configurable: true,
          enumerable: true,
          get: () => this.#state,
        },
        properties: {
          configurable: true,
          enumerable: true,
          get: () => this.#properties,
        },
      })
      this.#publicInstance = createComponentPublicInstance(
        this,
        WeappWebComponent.prototype,
        key => typeof key === 'string' ? this.#methods[key] : undefined,
      )
      for (const [propName] of runtimeState.propertyEntries) {
        Object.defineProperty(this, propName, {
          configurable: true,
          enumerable: true,
          get: () => this.#state[propName],
          set: value => this.#setProperty(propName, value),
        })
      }
      this.#syncMethods(runtimeState.componentRef.methods ?? {})
      if (!supportsLit) {
        const host = this as unknown as HTMLElement
        if (!host.shadowRoot && typeof host.attachShadow === 'function') {
          host.attachShadow({ mode: 'open' })
        }
        ;(this as any).renderRoot = host.shadowRoot ?? host
      }
      instances.add(this)
      runtimeState.lifetimes.created?.call(this.#publicInstance)
    }

    setData(patch: DataRecord, callback?: () => void) {
      const changed = this.#applyDataPatch(patch)
      if (supportsLit && changed) {
        const updateComplete = (this as unknown as { updateComplete: Promise<boolean> }).updateComplete
        return updateComplete.then(() => {
          callback?.()
        })
      }
      callback?.()
    }

    triggerEvent(name: string, detail?: any, options: TriggerEventOptions = {}) {
      this.dispatchEvent(new CustomEvent(name, {
        detail,
        bubbles: options.bubbles ?? false,
        composed: options.composed ?? false,
      }))
    }

    createSelectorQuery() {
      return createScopedSelectorQuery(this)
    }

    createIntersectionObserver(options?: {
      initialRatio?: number
      observeAll?: boolean
      thresholds?: number[]
    }) {
      return createIntersectionObserverBridge(this, options)
    }

    selectComponent(selector: string) {
      return selectRuntimeComponent(this, selector)
    }

    selectAllComponents(selector: string) {
      return selectRuntimeComponents(this, selector)
    }

    getRelationNodes(relationPath: string) {
      const relation = runtimeState.componentRef.relations?.[relationPath]
      return relation
        ? resolveRelationNodes(this, runtimeState.id, relationPath, relation.type)
        : []
    }

    selectOwnerComponent() {
      let current = resolveComposedParent(this)
      while (current) {
        if (isWeappComponentInstance(current)) {
          return current
        }
        current = resolveComposedParent(current)
      }
      return undefined
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
      runtimeState.lifetimes.attached?.call(this.#publicInstance)
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
      runtimeState.lifetimes.detached?.call(this.#publicInstance)
    }

    attributeChangedCallback(attrName: string, oldValue: string | null, newValue: string | null) {
      const superAttributeChanged = (BaseElement.prototype as {
        attributeChangedCallback?: (name: string, oldValue: string | null, newValue: string | null) => void
      }).attributeChangedCallback
      if (supportsLit && typeof superAttributeChanged === 'function') {
        superAttributeChanged.call(this, attrName, oldValue, newValue)
      }
      const propName = toCamelCase(attrName)
      if (!hasOwn(this.#properties, propName)) {
        return
      }
      const propOption = runtimeState.componentRef.properties?.[propName]
      this.#setProperty(propName, coerceValue(newValue, propOption?.type))
    }

    firstUpdated() {
      runtimeState.lifetimes.ready?.call(this.#publicInstance)
      this.#readyFired = true
    }

    updated() {
      this.#syncVirtualHostClasses()
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
        return false
      }
      let changed = false
      const changedKeys: string[] = []
      const previousProperties: DataRecord = {}
      for (const [path, value] of Object.entries(patch)) {
        const segments = parseDataPath(path)
        const topKey = segments[0]
        if (!topKey || Object.is(resolveDataPath(this.#state, segments), value)) {
          continue
        }
        if (hasOwn(this.#properties, topKey) && !hasOwn(previousProperties, topKey)) {
          previousProperties[topKey] = this.#properties[topKey]
        }
        assignDataPath(this.#state, segments, value)
        if (hasOwn(this.#properties, topKey)) {
          this.#properties[topKey] = this.#state[topKey]
        }
        changedKeys.push(path)
        changed = true
      }
      if (changed) {
        this.requestUpdate()
        runComponentObservers(runtimeState.componentRef, this.#publicInstance, changedKeys, previousProperties)
        for (const key of changedKeys) {
          if (runtimeState.componentRef.properties?.[key]?.observer) {
            this.#observedKeys.add(key)
          }
        }
      }
      return changed
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
      runComponentObservers(runtimeState.componentRef, this.#publicInstance, [name], { [name]: oldValue })
      if (propOption?.observer) {
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
        propOption.observer.call(this.#publicInstance, value, undefined)
        this.#observedKeys.add(propName)
      }
    }

    #syncMethods(nextMethods: ComponentOptions['methods']) {
      const resolved = nextMethods ?? {}
      const bound: Record<string, (event: any) => any> = {}
      for (const [name, fn] of Object.entries(resolved)) {
        if (typeof fn === 'function') {
          bound[name] = fn.bind(this.#publicInstance)
        }
      }
      for (const name of this.#exposedMethodNames) {
        if (name in bound) {
          continue
        }
        const descriptor = Object.getOwnPropertyDescriptor(this, name)
        if (descriptor?.configurable && descriptor.value === this.#methods[name]) {
          delete (this as unknown as Record<string, unknown>)[name]
        }
        this.#exposedMethodNames.delete(name)
      }
      for (const key of Object.keys(this.#methods)) {
        if (!(key in bound)) {
          delete this.#methods[key]
        }
      }
      for (const [key, fn] of Object.entries(bound)) {
        this.#methods[key] = fn
        if (!this.#exposedMethodNames.has(key) && key in this) {
          continue
        }
        Object.defineProperty(this, key, {
          configurable: true,
          enumerable: false,
          writable: true,
          value: fn,
        })
        this.#exposedMethodNames.add(key)
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
        hook.call(this.#publicInstance)
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
      this.#syncVirtualHostClasses()
      if (!this.#readyFired) {
        runtimeState.lifetimes.ready?.call(this.#publicInstance)
        this.#readyFired = true
      }
    }

    #syncVirtualHostClasses() {
      const host = this as unknown as ClassAttributeElement
      if (!runtimeState.componentRef.options?.virtualHost) {
        clearVirtualHostClasses(host, this.#virtualHostClassTokens)
        clearVirtualHostParts(this.#virtualHostRootElement, this.#virtualHostPartTokens)
        this.#virtualHostRootElement = undefined
        return
      }
      const root = resolveRenderRoot(this)
      syncVirtualHostClasses(host, root, this.#virtualHostClassTokens)
      this.#virtualHostRootElement = syncVirtualHostParts(
        root,
        this.#virtualHostRootElement,
        this.#virtualHostPartTokens,
      )
    }
  }

  return WeappWebComponent as WeappComponentElementClass
}
