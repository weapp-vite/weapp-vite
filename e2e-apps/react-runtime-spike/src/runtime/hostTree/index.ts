import type { HostProps, MiniProgramPageAdapter } from '../types'
import type { HostNode, HostParent } from './nodes'
import { attachHostNode, HostElement } from './nodes'
import { hasSerializedPropChanges } from './serialization'
import { hasStaticBindingChanges, readStaticSlot, StaticBindingState } from './staticBindings'

export { HostElement, HostText } from './nodes'
export type { HostNode, HostParent } from './nodes'
export { hasSerializedPropChanges } from './serialization'
export type HostRenderMode = 'static-bindings' | 'tree'

export class HostRoot {
  readonly children: HostNode[] = []
  readonly renderMode: HostRenderMode
  private dirtyNodes = new Set<HostNode>()
  private dirtyStructures = new Set<HostParent>()
  private mounted = false
  private nodeId = 0
  private nodes = new Map<string, HostNode>()
  private pendingFlush = false
  private readonly adapter: MiniProgramPageAdapter
  private readonly staticBindings = new StaticBindingState()
  private staticMismatch: Error | undefined
  private unmounting = false

  constructor(adapter: MiniProgramPageAdapter, renderMode: HostRenderMode = 'tree') {
    this.adapter = adapter
    this.renderMode = renderMode
  }

  beginUnmount() {
    this.unmounting = true
  }

  assertStaticTemplateValid() {
    if (!this.staticMismatch) {
      return
    }
    const error = this.staticMismatch
    this.staticMismatch = undefined
    throw error
  }

  createElementSid(props: HostProps) {
    return this.renderMode === 'static-bindings' ? readStaticSlot(props) : this.nextSid()
  }

  nextSid() {
    this.nodeId += 1
    return `r${this.nodeId}`
  }

  register(node: HostNode) {
    if (this.renderMode === 'static-bindings' && node instanceof HostElement && this.nodes.has(node.sid)) {
      throw new Error(`static template slot 冲突：${node.sid}`)
    }
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
    attachHostNode(this, child)
    this.markStructure(this)
  }

  insertBefore(child: HostNode, before: HostNode) {
    const index = this.children.indexOf(before)
    attachHostNode(this, child, index < 0 ? undefined : index)
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

  markElementProps(element: HostElement, previous: HostProps, next: HostProps) {
    if (this.renderMode === 'static-bindings') {
      this.staticBindings.markProps(element, previous, next)
      this.scheduleFlush()
      return
    }
    this.markNode(element)
  }

  markStaticText(element: HostElement) {
    this.staticBindings.markField(element, 'text')
    this.scheduleFlush()
  }

  markStructure(parent: HostParent) {
    if (this.renderMode === 'static-bindings') {
      if (this.mounted && !this.unmounting) {
        this.staticMismatch = new Error('static template 运行时结构发生变化，需要切换 dynamic island fallback')
      }
      return
    }
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

  shouldNotifyPropUpdate(previous: HostProps, next: HostProps) {
    return this.renderMode === 'static-bindings'
      ? hasStaticBindingChanges(previous, next)
      : hasSerializedPropChanges(previous, next)
  }

  private staticElements() {
    return Array.from(this.nodes.values()).filter((node): node is HostElement => node instanceof HostElement)
  }

  private flushStaticBindings() {
    if (this.staticMismatch) {
      this.staticBindings.clear()
      return
    }
    if (!this.mounted) {
      this.mounted = true
      this.staticBindings.clear()
      this.adapter.setData({ slots: this.staticBindings.snapshot(this.staticElements()) })
      return
    }
    const payload = this.staticBindings.takePayload()
    if (Object.keys(payload).length > 0 && !this.unmounting) {
      this.adapter.setData(payload)
    }
  }

  flush() {
    this.pendingFlush = false
    if (this.renderMode === 'static-bindings') {
      this.flushStaticBindings()
      return
    }
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
