import type { WeappComponentInstance } from './element'
import type { ComponentConstructor, DefineComponentOptions } from './types'
import { LitElement } from 'lit'
import { emitRuntimeWarning } from '../warning'
import { FallbackElement, supportsLit } from './constants'
import { createComponentElementClass } from './element'
import { createComponentRuntimeState, updateComponentRuntimeState } from './state'

function emitBehaviorWarnings(warnings: string[]) {
  for (const warning of warnings) {
    emitRuntimeWarning(warning, {
      key: `component-behaviors:${warning}`,
      context: 'runtime:component',
    })
  }
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

  if (!options.template) {
    throw new Error('[@weapp-vite/web] defineComponent 需要提供模板渲染函数。')
  }

  const BaseElement = (supportsLit ? LitElement : (globalThis.HTMLElement ?? FallbackElement)) as typeof HTMLElement
  const { state: runtimeState, warnings } = createComponentRuntimeState(options)
  emitBehaviorWarnings(warnings)

  const instances = new Set<WeappComponentInstance>()
  const WeappWebComponent = createComponentElementClass({
    BaseElement,
    runtimeState,
    instances,
  })

  const updateComponent = (nextOptions: DefineComponentOptions) => {
    if (!nextOptions?.template) {
      return
    }
    const { warnings: nextWarnings, nextMethods } = updateComponentRuntimeState(runtimeState, nextOptions)
    emitBehaviorWarnings(nextWarnings)
    for (const instance of instances) {
      instance.__weappSync(nextMethods)
    }
  }

  ;(WeappWebComponent as ComponentConstructor).__weappUpdate = updateComponent

  customElements.define(tagName, WeappWebComponent)
  return WeappWebComponent
}

export type {
  ComponentOptions,
  ComponentPublicInstance,
  DefineComponentOptions,
  PropertyOption,
} from './types'
