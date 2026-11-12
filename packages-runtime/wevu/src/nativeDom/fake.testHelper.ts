type Listener = (event: FakeEvent) => void

interface FakeEvent {
  detail: Record<string, unknown>
  stopPropagation: () => void
  target: FakeNode
  type: string
}

export class FakeNode {
  attributes = new Map<string, unknown>()
  children: FakeNode[] = []
  listeners = new Map<string, Set<{ listener: Listener, capture: boolean }>>()
  nodeValue: string | null = null
  parent: FakeNode | undefined

  constructor(readonly name: string) {}

  appendChild(child: FakeNode) {
    this.insertBefore(child, null)
    return child
  }

  insertBefore(child: FakeNode, before: FakeNode | null) {
    if (child.parent) {
      const previousIndex = child.parent.children.indexOf(child)
      if (previousIndex >= 0) {
        child.parent.children.splice(previousIndex, 1)
      }
    }
    const index = before ? this.children.indexOf(before) : -1
    if (before && index < 0) {
      throw new Error('before node is not a child')
    }
    child.parent = this
    this.children.splice(index < 0 ? this.children.length : index, 0, child)
    return child
  }

  removeChild(child: FakeNode) {
    const index = this.children.indexOf(child)
    if (index < 0) {
      throw new Error('node is not a child')
    }
    this.children.splice(index, 1)
    child.parent = undefined
    return child
  }

  setAttribute(name: string, value: unknown) {
    this.attributes.set(name, value)
  }

  removeAttribute(name: string) {
    this.attributes.delete(name)
  }

  addEventListener(type: string, listener: Listener, capture = false) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add({ listener, capture })
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: Listener, capture = false) {
    const listeners = this.listeners.get(type)
    if (!listeners) {
      return
    }
    for (const binding of listeners) {
      if (binding.listener === listener && binding.capture === capture) {
        listeners.delete(binding)
      }
    }
    if (listeners.size === 0) {
      this.listeners.delete(type)
    }
  }

  dispatch(type: string) {
    const path: FakeNode[] = [this]
    let current = this.parent
    while (current) {
      path.push(current)
      current = current.parent
    }
    let stopped = false
    const event: FakeEvent = {
      detail: { value: 'from-native' },
      stopPropagation: () => {
        stopped = true
      },
      target: this,
      type,
    }
    for (const node of path.slice().reverse()) {
      node.invoke(type, event, true)
      if (stopped) {
        return
      }
    }
    for (const node of path) {
      node.invoke(type, event, false)
      if (stopped) {
        return
      }
    }
  }

  private invoke(type: string, event: FakeEvent, capture: boolean) {
    for (const binding of this.listeners.get(type) ?? []) {
      if (binding.capture === capture) {
        binding.listener(event)
      }
    }
  }
}
