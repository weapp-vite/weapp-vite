import type { DocumentContext } from '../../documentContext'
import type { Attribute, EditAttribute, EditNode, EditPath, Node, TemplateDocument } from '../../types'

export interface LogicalAttribute extends EditAttribute {
  name: string
  value?: string
  quote?: '"' | '\''
  original?: Attribute
  changed?: boolean
}

export interface ChildList {
  items: PathRecord[]
  version: number
  owner?: PathRecord
}

export interface PathRecord {
  base: Node
  source: string
  original?: Node
  parent?: PathRecord
  list: ChildList
  children: ChildList
  path?: EditPath
  view?: EditNode
  name?: string
  attributes: LogicalAttribute[]
  data?: string
  dirty: boolean
  attached: boolean
  rawProtected?: boolean
  generation?: number
}

export interface TraversalFrame {
  record?: PathRecord
  skipped: boolean
}

export interface TraversalContext {
  stopped: boolean
  frame?: TraversalFrame
  frames: TraversalFrame[]
  requeues: PathRecord[]
  requeueCounts: Map<PathRecord, { total: number, unchanged: number, version: number }>
}

export interface PathSession {
  document: TemplateDocument
  context: DocumentContext
  roots: ChildList
  active: boolean
  version: number
  traversals: TraversalContext[]
  makePath: (record: PathRecord) => EditPath
}

/** 完整解析树包含所有文本和空白，逻辑子列表只需保存节点；旧 callback 不建立索引。 */
export function createList(source: string, nodes: readonly Node[], original: boolean, parent?: PathRecord): ChildList {
  const roots: ChildList = { items: [], version: 0, owner: parent }
  const tasks = [{ nodes, list: roots, parent }]
  while (tasks.length) {
    const task = tasks.pop()!
    for (const base of task.nodes) {
      const record: PathRecord = {
        base,
        source,
        original: original ? base : undefined,
        parent: task.parent,
        list: task.list,
        children: { items: [], version: 0 },
        name: base.kind === 'element' ? base.name : undefined,
        attributes: base.kind === 'element' ? base.attributes.map(attribute => ({ name: attribute.name, value: attribute.value, quote: attribute.quote, original: attribute })) : [],
        data: base.kind === 'element' ? undefined : base.data,
        dirty: false,
        attached: true,
      }
      record.children.owner = record
      task.list.items.push(record)
      if (base.kind === 'element' && !base.selfClosing) {
        tasks.push({ nodes: base.children, list: record.children, parent: record })
      }
    }
  }
  return roots
}

export function records(list: ChildList) {
  return list.items
}

export function attributeView(attribute: LogicalAttribute): EditAttribute {
  return Object.freeze({ name: attribute.name, value: attribute.value, quote: attribute.quote })
}

/** 当前逻辑节点不暴露旧源码坐标，属性和子节点每次读取都来自当前树。 */
export function nodeView(record: PathRecord): EditNode {
  if (!record.view) {
    record.view = record.base.kind === 'element'
      ? Object.freeze({
          kind: 'element' as const,
          get name() { return record.name! },
          get attributes() { return Object.freeze(record.attributes.map(attributeView)) },
          get children() { return Object.freeze(records(record.children).map(nodeView)) },
          get selfClosing() { return record.base.kind === 'element' && record.base.selfClosing && !record.children.items.length },
        })
      : Object.freeze({ kind: record.base.kind, get data() { return record.data! } })
  }
  return record.view
}

export function isAttached(record: PathRecord) {
  for (let current: PathRecord | undefined = record; current; current = current.parent) {
    if (!current.attached) {
      return false
    }
  }
  return true
}

export function assertActive(session: PathSession, record: PathRecord) {
  if (!session.active || !isAttached(record)) {
    throw new Error('This WXML edit path is no longer active.')
  }
}

export function changed(session: PathSession, record?: PathRecord) {
  session.version++
  for (let current = record; current; current = current.parent) {
    current.dirty = true
  }
}

/** 新结构继承目标与执行来源的最大代数，嵌套遍历和原文标签重建不能重置谱系。 */
export function structuralGeneration(session: PathSession, target: PathRecord) {
  let generation = 0
  // active 期间的修改来自 visitor，所有在栈遍历均已绑定其当前执行节点。
  const sources = [target, ...session.traversals.map(traversal => traversal.frame!.record!)]
  for (const source of sources) {
    for (let current: PathRecord | undefined = source; current; current = current.parent) {
      generation = Math.max(generation, current.generation ?? 0)
    }
  }
  return generation + 1
}

export function rawElement(session: PathSession, record: PathRecord) {
  return record.base.kind === 'element' && session.context.dialect.rawTags.some(name => name.toLowerCase() === record.name!.toLowerCase())
}

/** 失效状态沿父链传播，不逐节点销毁路径，也不会重新使用被替换路径的身份。 */
export function detach(record: PathRecord) {
  record.attached = false
}
