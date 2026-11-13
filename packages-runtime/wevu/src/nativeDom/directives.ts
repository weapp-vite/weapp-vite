import type { ObjectDirective } from '@vue/runtime-core'
import type { HostNode } from './host'
import { setVisible } from './host'

export const vShow: ObjectDirective<HostNode> = {
  beforeMount: (node, binding) => setVisible(node, Boolean(binding.value)),
  updated: (node, binding) => setVisible(node, Boolean(binding.value)),
}

export function withModifiers(handler: (...args: any[]) => any, modifiers: string[]) {
  return (event: any, ...args: any[]) => {
    for (const modifier of modifiers) {
      if (modifier === 'stop') {
        event.stopPropagation?.()
      }
      else if (modifier === 'prevent') {
        event.preventDefault?.()
      }
      else if (modifier === 'self' && event.target !== event.currentTarget) {
        return
      }
    }
    return handler(event, ...args)
  }
}

export function withKeys(handler: (...args: any[]) => any, keys: string[]) {
  return (event: any) => {
    if (keys.includes(String(event.key ?? '').toLowerCase())) {
      return handler(event)
    }
  }
}
