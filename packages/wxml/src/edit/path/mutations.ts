import type { AttributeValue, Node } from '../../types'
import type { ChildList, PathRecord, PathSession } from './model'
import { encodeAttribute, encodeText } from '../../encoding'
import { assertName, assertValid } from '../state'
import { parseFragment, projectSource } from './context'
import { assertActive, changed, createList, detach, rawElement, records, structuralGeneration } from './model'
import { renderItems } from './render'

export function requireElement(session: PathSession, record: PathRecord) {
  assertActive(session, record)
  if (record.base.kind !== 'element') {
    throw new TypeError('This edit requires an element node.')
  }
}

export function setAttribute(session: PathSession, record: PathRecord, name: string, value: AttributeValue | undefined, boolean = false) {
  requireElement(session, record)
  assertName(name)
  const encoded = boolean || value === undefined ? undefined : encodeAttribute(value, session.document.syntax)
  const matches = record.attributes.filter(attribute => attribute.name === name)
  if (value === undefined && !boolean) {
    if (!matches.length) {
      return
    }
    record.attributes = record.attributes.filter(attribute => attribute.name !== name)
  }
  else if (matches.length) {
    const first = matches[0]!
    if (matches.length === 1 && first.value === encoded && first.quote === (boolean ? undefined : '"')) {
      return
    }
    first.value = encoded
    first.quote = boolean ? undefined : '"'
    first.changed = true
    record.attributes = record.attributes.filter(attribute => attribute.name !== name || attribute === first)
  }
  else {
    record.attributes.push({ name, value: encoded, quote: boolean ? undefined : '"', changed: true })
  }
  changed(session, record)
}

export function renameAttribute(session: PathSession, record: PathRecord, name: string, nextName: string) {
  requireElement(session, record)
  assertName(name)
  assertName(nextName)
  if (name === nextName) {
    return
  }
  const matches = record.attributes.filter(attribute => attribute.name === name)
  if (matches.length && record.attributes.some(attribute => attribute.name === nextName)) {
    throw new TypeError(`Cannot rename WXML attribute to an existing name: ${nextName}.`)
  }
  for (const attribute of matches) {
    attribute.name = nextName
  }
  if (matches.length) {
    changed(session, record)
  }
}

export function rename(session: PathSession, record: PathRecord, name: string) {
  requireElement(session, record)
  assertName(name)
  if (record.name === name) {
    return
  }
  const wasRaw = rawElement(session, record)
  const previous = record.name
  const wasDirty = record.dirty
  record.name = name
  const isRaw = rawElement(session, record)
  if (wasRaw !== isRaw) {
    // 原文标签的词法模式改变时，只重建该子树；旧后代路径必须失效。
    record.dirty = true
    try {
      const source = renderItems([record])
      const parsed = parseFragment(session, source, session.context.resolveScriptBoundary ? projectSource(session, record, 'current', source) : undefined)
      assertValid(parsed)
      const replacement = parsed.children[0]
      if (parsed.children.length !== 1 || replacement?.kind !== 'element') {
        throw new TypeError('Renaming a raw tag must preserve its element boundary.')
      }
      const fresh = records(createList(source, [replacement], false))[0]!
      for (const child of records(record.children)) {
        detach(child)
      }
      record.base = fresh.base
      record.source = fresh.source
      record.children = fresh.children
      record.children.owner = record
      record.attributes = fresh.attributes
      for (const child of records(record.children)) {
        child.parent = record
      }
      record.rawProtected = undefined
    }
    catch (error) {
      record.name = previous
      record.dirty = wasDirty
      throw error
    }
  }
  changed(session, record)
}

export function replaceText(session: PathSession, record: PathRecord, value: string | { readonly expression: string }) {
  assertActive(session, record)
  if (record.base.kind !== 'text') {
    throw new TypeError('replaceText requires a text node.')
  }
  const encoded = encodeText(value)
  if (encoded !== record.data) {
    record.data = encoded
    changed(session, record)
  }
}

function rawOwner(session: PathSession, record: PathRecord, inside: boolean) {
  return inside && rawElement(session, record) ? record : record.base.kind === 'script' ? record.parent : undefined
}

function insertedList(session: PathSession, source: string, parent: PathRecord | undefined, owner: PathRecord | undefined, record: PathRecord, operation: 'before' | 'after' | 'prepend' | 'append' | 'replace'): ChildList {
  if (typeof source !== 'string') {
    throw new TypeError('Expected a WXML source string.')
  }
  if (!source) {
    return { items: [], version: 0, owner: parent }
  }
  if (owner) {
    const script: Node = { kind: 'script', start: 0, end: source.length, data: source }
    return createList(source, [script], false, parent)
  }
  const document = parseFragment(session, source, session.context.resolveScriptBoundary ? projectSource(session, record, operation, source) : undefined)
  assertValid(document)
  return createList(source, document.children, false, parent)
}

export function structure(session: PathSession, record: PathRecord, operation: 'before' | 'after' | 'prepend' | 'append' | 'replace' | 'remove', source = '') {
  assertActive(session, record)
  const inside = operation === 'prepend' || operation === 'append'
  if (inside) {
    requireElement(session, record)
  }
  const list = inside ? record.children : record.list
  const parent = inside ? record : record.parent
  const owner = rawOwner(session, record, inside)
  if (operation === 'replace' && renderItems([record]) === source) {
    return [session.makePath(record)]
  }
  const added: ChildList = operation === 'remove' ? { items: [], version: 0 } : insertedList(session, source, parent, owner, record, operation)
  const generation = structuralGeneration(session, record)
  // 只限制 visitor 持续生成的新节点谱系，不限制输入深度、片段大小或总访问数。
  if (added.items.length && generation > 1024) {
    throw new Error('WXML edit structural generation limit exceeded; repeated insertion or replacement must terminate.')
  }
  const index = inside
    ? operation === 'prepend' ? 0 : list.items.length
    : list.items.indexOf(record) + (operation === 'after' ? 1 : 0)
  const remove = operation === 'replace' || operation === 'remove'
  if (!remove && !added.items.length) {
    return []
  }
  if (remove) {
    detach(record)
  }
  for (const item of added.items) {
    item.list = list
    const stack = [item]
    while (stack.length) {
      const inserted = stack.pop()!
      inserted.generation = generation
      stack.push(...records(inserted.children))
    }
  }
  list.items.splice(index, remove ? 1 : 0, ...added.items)
  list.version++
  changed(session, parent)
  if (owner) {
    owner.rawProtected = true
    changed(session, owner)
  }
  return added.items.map(session.makePath)
}
