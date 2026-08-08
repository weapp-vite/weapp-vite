import type { HostProps } from '../types'
import { serializeStyle } from './serialization'

interface BindingTextNode {
  value: string
}

interface BindingElementNode {
  children: BindingNode[]
  props: HostProps
  sid: string
}

type BindingNode = BindingElementNode | BindingTextNode

function isTextNode(node: BindingNode): node is BindingTextNode {
  return 'value' in node
}

function collectText(node: BindingNode): string {
  if (isTextNode(node)) {
    return node.value
  }
  return node.children.map(collectText).join('')
}

export function readStaticBindingFields(props: HostProps) {
  const value = props.__bindingFields
  return typeof value === 'string' && value
    ? value.split(',').filter(Boolean)
    : []
}

export function readStaticSlot(props: HostProps) {
  const value = props.__slot
  if (typeof value !== 'string' || !value) {
    throw new Error('static template host node 缺少编译期 __slot')
  }
  return value
}

function readBindingValue(element: BindingElementNode, field: string, props = element.props) {
  if (field === 'text') {
    return element.children.map(collectText).join('')
  }
  if (field === 'className') {
    return props.className ?? props.class ?? ''
  }
  if (field === 'style') {
    return serializeStyle(props.style) ?? ''
  }
  return props[field]
}

export function hasStaticBindingChanges(previous: HostProps, next: HostProps) {
  const fields = readStaticBindingFields(next)
  return fields.some((field) => {
    if (field === 'text') {
      return false
    }
    if (field === 'className') {
      return (previous.className ?? previous.class) !== (next.className ?? next.class)
    }
    if (field === 'style') {
      return serializeStyle(previous.style) !== serializeStyle(next.style)
    }
    return previous[field] !== next[field]
  })
}

export class StaticBindingState {
  private dirty = new Map<BindingElementNode, Set<string>>()

  clear() {
    this.dirty.clear()
  }

  markField(element: BindingElementNode, field: string) {
    let fields = this.dirty.get(element)
    if (!fields) {
      fields = new Set<string>()
      this.dirty.set(element, fields)
    }
    fields.add(field)
  }

  markProps(element: BindingElementNode, previous: HostProps, next: HostProps) {
    for (const field of readStaticBindingFields(next)) {
      if (field === 'text') {
        continue
      }
      if (readBindingValue(element, field, previous) !== readBindingValue(element, field, next)) {
        this.markField(element, field)
      }
    }
  }

  snapshot(elements: Iterable<BindingElementNode>) {
    const slots: Record<string, Record<string, unknown>> = {}
    for (const element of elements) {
      const fields = readStaticBindingFields(element.props)
      if (fields.length === 0) {
        continue
      }
      slots[element.sid] = Object.fromEntries(
        fields.map(field => [field, readBindingValue(element, field)]),
      )
    }
    return slots
  }

  takePayload() {
    const payload: Record<string, unknown> = {}
    for (const [element, fields] of this.dirty) {
      for (const field of fields) {
        payload[`slots.${element.sid}.${field}`] = readBindingValue(element, field)
      }
    }
    this.dirty.clear()
    return payload
  }
}
