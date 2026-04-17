import type { ComponentPublicInstance } from './types'
import { getMiniProgramRuntimeGlobalKeys } from '@weapp-core/shared'

type QueryRoot = ParentNode & {
  querySelector?: ParentNode['querySelector']
  querySelectorAll?: ParentNode['querySelectorAll']
}

const MINI_PROGRAM_RUNTIME_GLOBAL_KEYS = getMiniProgramRuntimeGlobalKeys()

export function resolveQueryRoot(instance: ComponentPublicInstance & { renderRoot?: ParentNode }): QueryRoot {
  return (instance.renderRoot ?? instance.shadowRoot ?? instance) as QueryRoot
}

export function resolveRenderRoot(instance: ComponentPublicInstance & { renderRoot?: HTMLElement | ShadowRoot }) {
  return (instance.renderRoot ?? instance.shadowRoot ?? instance) as HTMLElement | ShadowRoot
}

export function createScopedSelectorQuery(instance: ComponentPublicInstance) {
  const runtime = globalThis as Record<string, {
    createSelectorQuery?: () => {
      in?: (context: unknown) => unknown
    }
  } | undefined>
  for (const globalKey of MINI_PROGRAM_RUNTIME_GLOBAL_KEYS) {
    const query = runtime[globalKey]?.createSelectorQuery?.()
    if (query && typeof query.in === 'function') {
      return query.in(instance)
    }
    if (query) {
      return query
    }
  }
  return undefined
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
