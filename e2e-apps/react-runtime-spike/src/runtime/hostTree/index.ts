import type { HostProps, MiniProgramPageAdapter, SerializedHostNode } from '../types'
import { serializeProps, serializeStyle } from './serialization'

export { hasSerializedPropChanges } from './serialization'

export type HostParent = HostElement | HostRoot
export type HostNode = HostElement | HostText

function attach(parent: HostParent, child: HostNode, index?: number) {
  if (child.parent) {
    const previousIndex = child.parent.children.indexOf(child)
    if (previousIndex >= 0) {
      child.parent.children.splice(previousIndex, 1)
    }
  }
  child.parent = parent
  if (index === undefined) {
    parent.children.push(child)
  }
  else {
    parent.children.splice(index, 0, child)
  }
}

export class HostText {
  parent: HostParent | null = null
  readonly root: HostRoot
  readonly sid: string
  value: string

  constructor(
    root: HostRoot,
    sid: string,
    value: string,
  ) {
    this.root = root
    this.sid = sid
    this.value = value
    root.register(this)
  }

  serialize(): SerializedHostNode {
    return {
      nn: '#text',
      sid: this.sid,
      v: this.value,
    }
  }

  setValue(value: string) {
    if (value === this.value) {
      return
    }
    this.value = value
    this.root.markNode(this)
  }
}

export class HostElement {
  readonly children: HostNode[] = []
  parent: HostParent | null = null
  props: HostProps
  readonly root: HostRoot
  readonly sid: string
  readonly type: string

  constructor(
    root: HostRoot,
    sid: string,
    type: string,
    props: HostProps,
  ) {
    this.props = props
    this.root = root
    this.sid = sid
    this.type = type
    root.register(this)
  }

  append(child: HostNode, notify = true) {
    attach(this, child)
    if (notify) {
      this.root.markStructure(this)
    }
  }

  insertBefore(child: HostNode, before: HostNode) {
    const index = this.children.indexOf(before)
    attach(this, child, index < 0 ? undefined : index)
    this.root.markStructure(this)
  }

  remove(child: HostNode) {
    const index = this.children.indexOf(child)
    if (index < 0) {
      return
    }
    this.children.splice(index, 1)
    child.parent = null
    this.root.unregisterTree(child)
    this.root.markStructure(this)
  }

  serialize(): SerializedHostNode {
    const className = this.props.className ?? this.props.class
    const serialized: SerializedHostNode = {
      nn: this.type,
      sid: this.sid,
    }
    if (this.children.length > 0) {
      serialized.cn = this.children.map(child => child.serialize())
    }
    if (typeof className === 'string' && className) {
      serialized.cl = className
    }
    const style = serializeStyle(this.props.style)
    if (style) {
      serialized.st = style
    }
    const props = serializeProps(this.props)
    if (props) {
      serialized.p = props
    }
    return serialized
  }

  updateProps(props: HostProps, notify = true) {
    this.props = props
    if (notify) {
      this.root.markNode(this)
    }
  }
}

export class HostRoot {
  readonly children: HostNode[] = []
  private dirtyNodes = new Set<HostNode>()
  private dirtyStructures = new Set<HostParent>()
  private mounted = false
  private nodeId = 0
  private nodes = new Map<string, HostNode>()
  private pendingFlush = false
  private readonly adapter: MiniProgramPageAdapter

  constructor(adapter: MiniProgramPageAdapter) {
    this.adapter = adapter
  }

  nextSid() {
    this.nodeId += 1
    return `r${this.nodeId}`
  }

  register(node: HostNode) {
    this.nodes.set(node.sid, node)
  }

  unregisterTree(node: HostNode) {
    this.nodes.delete(node.sid)
    if (node instanceof HostElement) {
      node.children.forEach(child => this.unregisterTree(child))
    }
  }

  getNode(sid: string) {
    return this.nodes.get(sid)
  }

  append(child: HostNode) {
    attach(this, child)
    this.markStructure(this)
  }

  insertBefore(child: HostNode, before: HostNode) {
    const index = this.children.indexOf(before)
    attach(this, child, index < 0 ? undefined : index)
    this.markStructure(this)
  }

  remove(child: HostNode) {
    const index = this.children.indexOf(child)
    if (index < 0) {
      return
    }
    this.children.splice(index, 1)
    child.parent = null
    this.unregisterTree(child)
    this.markStructure(this)
  }

  clear() {
    this.children.forEach(child => this.unregisterTree(child))
    this.children.length = 0
    this.markStructure(this)
  }

  markNode(node: HostNode) {
    this.dirtyNodes.add(node)
    this.scheduleFlush()
  }

  markStructure(parent: HostParent) {
    this.dirtyStructures.add(parent)
    this.scheduleFlush()
  }

  private scheduleFlush() {
    if (this.pendingFlush) {
      return
    }
    this.pendingFlush = true
    Promise.resolve().then(() => this.flush())
  }

  private pathOf(target: HostParent | HostNode): string | undefined {
    if (target instanceof HostRoot) {
      return 'root'
    }
    const parent = target.parent
    if (!parent) {
      return undefined
    }
    const parentPath = this.pathOf(parent)
    const index = parent.children.indexOf(target)
    return parentPath && index >= 0 ? `${parentPath}.cn[${index}]` : undefined
  }

  private hasStructuralAncestor(node: HostNode) {
    let parent = node.parent
    while (parent) {
      if (this.dirtyStructures.has(parent)) {
        return true
      }
      parent = parent instanceof HostElement ? parent.parent : null
    }
    return false
  }

  snapshot() {
    return {
      cn: this.children.map(child => child.serialize()),
    }
  }

  flush() {
    this.pendingFlush = false
    if (!this.mounted) {
      this.mounted = true
      this.dirtyNodes.clear()
      this.dirtyStructures.clear()
      this.adapter.setData({ root: this.snapshot() })
      return
    }

    const payload: Record<string, unknown> = {}
    for (const parent of this.dirtyStructures) {
      const path = this.pathOf(parent)
      if (path) {
        payload[`${path}.cn`] = parent.children.map(child => child.serialize())
      }
    }
    for (const node of this.dirtyNodes) {
      if (this.hasStructuralAncestor(node)) {
        continue
      }
      const path = this.pathOf(node)
      if (path) {
        payload[path] = node.serialize()
      }
    }

    this.dirtyNodes.clear()
    this.dirtyStructures.clear()
    if (Object.keys(payload).length > 0) {
      this.adapter.setData(payload)
    }
  }
}
