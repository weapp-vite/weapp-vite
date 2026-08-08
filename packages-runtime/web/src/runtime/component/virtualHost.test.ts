import type { ClassAttributeElement } from './virtualHost'
import { describe, expect, it, vi } from 'vitest'
import { syncVirtualHostClasses, syncVirtualHostParts } from './virtualHost'

function createElement(initial: Record<string, string> = {}) {
  const attributes = new Map(Object.entries(initial))
  const element: ClassAttributeElement & { tagName: string } = {
    tagName: 'WEAPP-VIEW',
    getAttribute: name => attributes.get(name) ?? null,
    removeAttribute: vi.fn(name => attributes.delete(name)),
    setAttribute: vi.fn((name, value) => attributes.set(name, value)),
  }
  return element
}

describe('virtualHost attribute synchronization', () => {
  it('does not rewrite unchanged host classes or root parts', () => {
    const host = createElement()
    const rootElement = createElement({ class: 'root is-active' })
    const root = { childNodes: [rootElement] }
    const classTokens = new Set<string>()
    const partTokens = new Set<string>()

    syncVirtualHostClasses(host, root, classTokens)
    const currentRoot = syncVirtualHostParts(root, undefined, partTokens)
    syncVirtualHostClasses(host, root, classTokens)
    syncVirtualHostParts(root, currentRoot, partTokens)

    expect(host.setAttribute).toHaveBeenCalledTimes(1)
    expect(rootElement.setAttribute).toHaveBeenCalledTimes(1)
    expect(host.getAttribute('class')).toBe('root is-active')
    expect(rootElement.getAttribute('part')).toBe('root is-active')
  })
})
