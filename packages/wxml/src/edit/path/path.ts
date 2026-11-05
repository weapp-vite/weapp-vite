import type { AttributeValue, EditElement, EditPath, EditRawNode, EditVisitors } from '../../types'
import type { PathRecord, PathSession } from './model'
import { assertActive, attributeView, isAttached, nodeView, records } from './model'
import * as mutations from './mutations'
import { requeue, traversalFor, traverse } from './traverse'

/** 每个逻辑节点只创建一个路径，新增节点与旧节点使用相同的编辑生命周期。 */
export class LiveEditPath implements EditPath {
  constructor(private readonly session: PathSession, private readonly record: PathRecord) {}

  get node() {
    return nodeView(this.record)
  }

  get originalNode() {
    return this.record.original
  }

  get originalRange() {
    const original = this.record.original
    return original ? Object.freeze({ start: original.start, end: original.end }) : undefined
  }

  get parentPath() {
    return this.record.parent ? this.session.makePath(this.record.parent) : undefined
  }

  get key() {
    return records(this.record.list).indexOf(this.record)
  }

  get removed() {
    return !isAttached(this.record)
  }

  get(key: 'children') {
    if (key !== 'children') {
      throw new TypeError('Only children paths are supported.')
    }
    return Object.freeze(records(this.record.children).map(this.session.makePath))
  }

  getSibling(index: number) {
    const sibling = records(this.record.list)[index]
    return sibling ? this.session.makePath(sibling) : undefined
  }

  findParent(predicate: (path: EditPath) => boolean) {
    for (let parent = this.parentPath; parent; parent = parent.parentPath) {
      if (predicate(parent)) {
        return parent
      }
    }
    return undefined
  }

  isElement(): this is EditPath<EditElement>
  isElement<Name extends string>(name: Name): this is EditPath<EditElement & { readonly name: Name }>
  isElement(name?: string): this is EditPath<EditElement> {
    return this.record.base.kind === 'element' && (name === undefined || this.record.name === name)
  }

  isText(): this is EditPath<EditRawNode & { readonly kind: 'text' }> {
    return this.record.base.kind === 'text'
  }

  hasAttribute(name: string) {
    return this.record.base.kind === 'element' && this.record.attributes.some(attribute => attribute.name === name)
  }

  getAttribute(name: string) {
    const attribute = this.record.base.kind === 'element' ? this.record.attributes.find(attribute => attribute.name === name) : undefined
    return attribute ? attributeView(attribute) : undefined
  }

  rename(name: string) {
    mutations.rename(this.session, this.record, name)
  }

  renameAttribute(name: string, nextName: string) {
    mutations.renameAttribute(this.session, this.record, name, nextName)
  }

  setAttribute(name: string, value: AttributeValue) {
    if (value === undefined) {
      throw new TypeError('Expected a string, finite number, boolean, or nonempty expression.')
    }
    mutations.setAttribute(this.session, this.record, name, value)
  }

  setBooleanAttribute(name: string) {
    mutations.setAttribute(this.session, this.record, name, undefined, true)
  }

  removeAttribute(name: string) {
    mutations.setAttribute(this.session, this.record, name, undefined)
  }

  replaceText(value: string | { readonly expression: string }) {
    mutations.replaceText(this.session, this.record, value)
  }

  remove() {
    mutations.structure(this.session, this.record, 'remove')
  }

  replaceWith(source: string) {
    return Object.freeze(mutations.structure(this.session, this.record, 'replace', source))
  }

  insertBefore(source: string) {
    return Object.freeze(mutations.structure(this.session, this.record, 'before', source))
  }

  insertAfter(source: string) {
    return Object.freeze(mutations.structure(this.session, this.record, 'after', source))
  }

  prepend(source: string) {
    return Object.freeze(mutations.structure(this.session, this.record, 'prepend', source))
  }

  append(source: string) {
    return Object.freeze(mutations.structure(this.session, this.record, 'append', source))
  }

  traverse<State = undefined>(visitors: EditVisitors<State>, state?: State) {
    assertActive(this.session, this.record)
    traverse(this.session, this.record.children, visitors, state as State, this.record)
  }

  skip() {
    assertActive(this.session, this.record)
    const traversal = traversalFor(this.session)
    const frame = traversal.frame
    if (frame?.record !== this.record) {
      throw new Error('skip() requires the current WXML edit traversal frame.')
    }
    frame.skipped = true
  }

  stop() {
    assertActive(this.session, this.record)
    traversalFor(this.session).stopped = true
  }

  requeue() {
    assertActive(this.session, this.record)
    requeue(this.session, this.record)
  }
}
