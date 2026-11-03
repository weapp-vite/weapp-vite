import type { AttributeValue, EditableNode, Node } from '../types'
import type { EditSession, NodeEdits } from './state'
import { encodeAttribute, encodeText } from '../encoding'
import { defaultRawTags } from '../options'
import { assertName, stateFor, validateSnippet } from './state'

/** 操作仅在被读取时绑定，普通遍历节点不分配整套编辑闭包。 */
export class EditableHandle implements EditableNode {
  private changes?: NodeEdits

  constructor(private readonly session: EditSession, readonly node: Node, private readonly parent?: EditableHandle) {}

  isInvalidated() {
    const structuralReplacement = this.changes?.replacement !== undefined && this.changes.literalText === undefined
    if (this.changes?.removed || structuralReplacement) {
      return true
    }
    if (!this.session.hasStructuralInvalidations) {
      return false
    }
    for (let current = this.parent; current; current = current.parent) {
      const parentStructuralReplacement = current.changes?.replacement !== undefined && current.changes.literalText === undefined
      if (current.changes?.removed || parentStructuralReplacement) {
        return true
      }
    }
    return false
  }

  private assertActive() {
    if (!this.session.active || this.isInvalidated()) {
      throw new Error('This WXML edit handle is no longer active.')
    }
  }

  private state() {
    if (!this.changes) {
      this.changes = stateFor(this.session, this.node)
    }
    return this.changes
  }

  private element() {
    this.assertActive()
    if (this.node.kind !== 'element') {
      throw new TypeError('This edit requires an element node.')
    }
    return this.state()
  }

  private attribute(name: string) {
    this.assertActive()
    assertName(name)
    return this.element()
  }

  private insert(position: 'before' | 'after' | 'prepend' | 'append', source: string) {
    this.assertActive()
    if ((position === 'prepend' || position === 'append') && this.node.kind !== 'element') {
      throw new TypeError('This edit requires an element node.')
    }
    const rawOwner = this.node.kind === 'script'
      ? this.parent
      : (position === 'prepend' || position === 'append') && this.isRawElement() ? this : undefined
    const snippet = validateSnippet(this.session, source, Boolean(rawOwner))
    if (source) {
      rawOwner?.registerRawOwner()
      const state = this.state()
      ;(state[position] ??= []).push(snippet)
    }
  }

  private isRawElement() {
    if (this.node.kind !== 'element') {
      return false
    }
    const tag = (this.changes?.name ?? this.node.name).toLowerCase()
    return (this.session.document.options.rawTags ?? defaultRawTags).some(name => name.toLowerCase() === tag)
  }

  private registerRawOwner() {
    if (this.node.kind === 'element') {
      this.session.rawOwners ??= new Map()
      this.session.rawOwners.set(this.node, { isInvalidated: () => this.isInvalidated() })
    }
  }

  get rename() {
    return (name: string) => {
      const state = this.element()
      assertName(name)
      state.name = name
    }
  }

  get setAttribute() {
    return (name: string, value: AttributeValue) => {
      const state = this.attribute(name)
      const encoded = encodeAttribute(value, this.session.document.syntax)
      ;(state.attributes ??= new Map()).set(name, encoded)
      if (typeof value === 'object') {
        state.unvalidatedAttributes ??= new Set()
        state.unvalidatedAttributes.add(name)
      }
      else {
        state.unvalidatedAttributes?.delete(name)
      }
    }
  }

  get setBooleanAttribute() {
    return (name: string) => {
      const state = this.attribute(name)
      ;(state.attributes ??= new Map()).set(name, null)
      state.unvalidatedAttributes?.delete(name)
    }
  }

  get removeAttribute() {
    return (name: string) => {
      const state = this.attribute(name)
      ;(state.attributes ??= new Map()).set(name, undefined)
      state.unvalidatedAttributes?.delete(name)
    }
  }

  get replaceText() {
    return (value: string | { readonly expression: string }) => {
      this.assertActive()
      if (this.node.kind !== 'text') {
        throw new TypeError('replaceText requires a text node.')
      }
      const state = this.state()
      state.replacement = encodeText(value)
      state.literalText = typeof value === 'string'
    }
  }

  get remove() {
    return () => {
      this.assertActive()
      this.state().removed = true
      if (this.node.kind === 'element') {
        this.session.hasStructuralInvalidations = true
      }
    }
  }

  get replaceWith() {
    return (source: string) => {
      this.assertActive()
      const rawOwner = this.node.kind === 'script' ? this.parent : undefined
      const state = this.state()
      state.replacement = validateSnippet(this.session, source, Boolean(rawOwner))
      state.literalText = undefined
      rawOwner?.registerRawOwner()
      if (this.node.kind === 'element') {
        this.session.hasStructuralInvalidations = true
      }
    }
  }

  get insertBefore() {
    return (source: string) => this.insert('before', source)
  }

  get insertAfter() {
    return (source: string) => this.insert('after', source)
  }

  get prepend() {
    return (source: string) => this.insert('prepend', source)
  }

  get append() {
    return (source: string) => this.insert('append', source)
  }
}
