import type { HostRoot } from '.'
import type { HostProps, SerializedHostNode } from '../types'
import { serializeProps, serializeStyle } from './serialization'

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

  constructor(root: HostRoot, sid: string, value: string) {
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
    if (this.root.renderMode === 'static-bindings' && this.parent && 'props' in this.parent) {
      this.root.markStaticText(this.parent)
    }
    else {
      this.root.markNode(this)
    }
  }
}

export class HostElement {
  readonly children: HostNode[] = []
  parent: HostParent | null = null
  props: HostProps
  readonly root: HostRoot
  readonly sid: string
  readonly type: string

  constructor(root: HostRoot, sid: string, type: string, props: HostProps) {
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
    const previous = this.props
    this.props = props
    if (notify) {
      this.root.markElementProps(this, previous, props)
    }
  }
}

export function attachHostNode(parent: HostParent, child: HostNode, index?: number) {
  attach(parent, child, index)
}
