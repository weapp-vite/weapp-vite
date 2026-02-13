import type { ComponentPublicInstance } from './types'

type QueryRoot = ParentNode & {
  querySelector?: ParentNode['querySelector']
  querySelectorAll?: ParentNode['querySelectorAll']
}

export function resolveQueryRoot(instance: ComponentPublicInstance & { renderRoot?: ParentNode }): QueryRoot {
  return (instance.renderRoot ?? instance.shadowRoot ?? instance) as QueryRoot
}

export function resolveRenderRoot(instance: ComponentPublicInstance & { renderRoot?: HTMLElement | ShadowRoot }) {
  return (instance.renderRoot ?? instance.shadowRoot ?? instance) as HTMLElement | ShadowRoot
}

export function createScopedSelectorQuery(instance: ComponentPublicInstance) {
  const runtime = globalThis as {
    wx?: {
      createSelectorQuery?: () => {
        in?: (context: unknown) => unknown
      }
    }
  }
  const query = runtime.wx?.createSelectorQuery?.()
  if (query && typeof query.in === 'function') {
    return query.in(instance)
  }
  return query
}

export function selectRuntimeComponent(instance: ComponentPublicInstance & { renderRoot?: ParentNode }, selector: string) {
  const root = resolveQueryRoot(instance)
  if (!selector || typeof root.querySelector !== 'function') {
    return null
  }
  return root.querySelector(selector) as ComponentPublicInstance | null
}

export function selectRuntimeComponents(instance: ComponentPublicInstance & { renderRoot?: ParentNode }, selector: string) {
  const root = resolveQueryRoot(instance)
  if (!selector || typeof root.querySelectorAll !== 'function') {
    return []
  }
  return Array.from(root.querySelectorAll(selector)) as ComponentPublicInstance[]
}
