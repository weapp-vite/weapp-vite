/* eslint-disable ts/no-use-before-define -- patchProp 与宿主 options 相互引用，统一保留宿主操作表。 */
import type { RendererOptions } from '@vue/runtime-core'
import type { NativeDomEvent, NativeDomNode, NativeDomSelection } from '@weapp-core/shared/native-dom'
import { normalizeClass, normalizeStyle } from '@vue/runtime-core'
import { createNativeDomElement } from '@weapp-core/shared/native-dom'
import { normalizeEmitEventName } from '../runtime/emit'

export interface HostNode {
  native: NativeDomNode
  parent?: HostNode
  children: HostNode[]
  style?: string
  hidden?: boolean
  cleanups?: Set<() => void>
}

interface EventBinding {
  type: string
  capture: boolean
  listener: (event: NativeDomEvent) => void
}

function serializeStyle(value: unknown) {
  const style = normalizeStyle(value as any)
  if (typeof style === 'string') {
    return style
  }
  return Object.entries(style ?? {}).filter(([, value]) => value != null).map(([name, value]) => `${name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}:${value}`).join(';')
}

function applyStyle(node: HostNode) {
  const value = [node.style, node.hidden ? 'display:none' : ''].filter(Boolean).join(';')
  if (value) {
    node.native.setAttribute('style', value)
  }
  else {
    node.native.removeAttribute('style')
  }
}

export function setVisible(node: HostNode, visible: boolean) {
  node.hidden = !visible
  applyStyle(node)
}

export function createHost(selection: NativeDomSelection) {
  const nodes = new Set<HostNode>()
  const wrap = (native: NativeDomNode): HostNode => {
    const node: HostNode = { native, children: [] }
    nodes.add(node)
    return node
  }
  const root = wrap(selection.container)
  const bindings = new WeakMap<HostNode, Map<string, EventBinding>>()
  const dispose = (node: HostNode) => {
    for (const binding of bindings.get(node)?.values() ?? []) {
      node.native.removeEventListener(binding.type, binding.listener, binding.capture)
    }
    bindings.delete(node)
    for (const cleanup of node.cleanups ?? []) {
      cleanup()
    }
    node.children.forEach(dispose)
    nodes.delete(node)
  }
  const detach = (node: HostNode) => {
    const parent = node.parent
    if (parent) {
      parent.native.removeChild(node.native)
      parent.children.splice(parent.children.indexOf(node), 1)
      node.parent = undefined
    }
  }
  const patchProp = (node: HostNode, key: string, _previous: any, next: any) => {
    if (key === 'textContent') {
      options.setElementText(node, String(next ?? ''))
      return
    }
    if (key === 'style') {
      node.style = serializeStyle(next)
      applyStyle(node)
      return
    }
    if (/^on[A-Z]/.test(key)) {
      const listeners = bindings.get(node) ?? new Map<string, EventBinding>()
      const previous = listeners.get(key)
      if (previous) {
        node.native.removeEventListener(previous.type, previous.listener, previous.capture)
        listeners.delete(key)
      }
      if (next) {
        const capture = /Capture(?:Once|Passive)*$/.test(key)
        const once = /Once(?:Capture|Passive)*$/.test(key)
        const name = normalizeEmitEventName(key.slice(2).replace(/(?:Capture|Once|Passive)+$/, '').replace(/^./, c => c.toLowerCase()))
        const binding: EventBinding = {
          type: `bind${name === 'click' ? 'tap' : name}`,
          capture,
          listener: (event) => {
            if (once) {
              node.native.removeEventListener(binding.type, binding.listener, capture)
            }
            for (const handler of Array.isArray(next) ? next : [next]) {
              handler(event)
            }
          },
        }
        node.native.addEventListener(binding.type, binding.listener, capture)
        listeners.set(key, binding)
      }
      bindings.set(node, listeners)
      return
    }
    if (key.startsWith('__') || key === 'key' || key === 'ref') {
      return
    }
    const name = /^(?:data|aria)-/.test(key) ? key : key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
    const value = key === 'class' ? normalizeClass(next) : next
    if (value == null || (value === false && ['checked', 'disabled', 'hidden', 'selected', 'multiple'].includes(key)) || (key === 'class' && value === '')) {
      node.native.removeAttribute(name)
    }
    else {
      node.native.setAttribute(name, value)
    }
  }
  const options: RendererOptions<HostNode, HostNode> = {
    createElement: type => wrap(createNativeDomElement(selection, type)),
    createText: value => wrap(selection.appDocument.createTextNode(value)),
    // V2 没有必需的 comment API，用空文本作为结构锚点。
    createComment: () => wrap(selection.appDocument.createTextNode('')),
    setText: (node, value) => { node.native.nodeValue = value },
    setElementText: (node, value) => {
      for (const child of [...node.children]) {
        detach(child)
        dispose(child)
      }
      if (value) {
        const child = wrap(selection.appDocument.createTextNode(value))
        node.native.appendChild(child.native)
        node.children.push(child)
        child.parent = node
      }
    },
    parentNode: node => node.parent ?? null,
    nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1] ?? null,
    insert: (node, parent, anchor) => {
      // 移动仍持有事件监听；只有真正卸载才释放。
      detach(node)
      if (anchor) {
        parent.native.insertBefore(node.native, anchor.native)
        parent.children.splice(parent.children.indexOf(anchor), 0, node)
      }
      else {
        parent.native.appendChild(node.native)
        parent.children.push(node)
      }
      node.parent = parent
    },
    remove: (node) => {
      detach(node)
      dispose(node)
    },
    patchProp,
    setScopeId: (node, id) => node.native.setAttribute(id, ''),
  }
  const cleanup = () => {
    for (const node of [...root.children]) {
      detach(node)
    }
    for (const node of nodes) {
      dispose(node)
    }
  }
  return { root, options, patchProp, cleanup }
}
