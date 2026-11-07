import type { PartInfo } from 'lit/directive.js'
import { WEAPP_VITE_WEB_LEGACY_FRAGMENT_END_COMMENT } from '@weapp-core/constants'
import { noChange } from 'lit'
import { Directive, directive, PartType } from 'lit/directive.js'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'
import { SELF_CLOSING_TAGS } from '../../shared/wxml'
import { resolveLegacyMarkupKey, resolveLegacyMarkupKeySignature } from './markupKeys'

interface MarkupEntry {
  node: Node
  key?: string
  attributes?: Map<string, string>
  children?: MarkupRange
}

interface MarkupRange {
  start: Comment
  end: Comment
  entries: MarkupEntry[]
}

function captureEntries(nodes: Node[], context: object): MarkupEntry[] {
  const entries: MarkupEntry[] = []
  let precedingKey: string | undefined
  let sourceAttributes: ReadonlyMap<string, string> | undefined
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index]!
    const entry: MarkupEntry = { node }
    if (node.nodeType === Node.COMMENT_NODE) {
      const info = resolveLegacyMarkupKey(context, (node as Comment).data)
      precedingKey = info?.key
      sourceAttributes = info?.attributes
      if (info?.fragment) {
        let depth = 1
        let endIndex = index
        while (depth && ++endIndex < nodes.length) {
          const current = nodes[endIndex]!
          if (current.nodeType === Node.COMMENT_NODE) {
            if (current.nodeValue === WEAPP_VITE_WEB_LEGACY_FRAGMENT_END_COMMENT) {
              depth--
            }
            else if (resolveLegacyMarkupKey(context, (current as Comment).data)?.fragment) {
              depth++
            }
          }
        }
        if (depth === 0) {
          entry.key = `fragment:${info.key}`
          entry.children = { start: node as Comment, end: nodes[endIndex] as Comment, entries: captureEntries(nodes.slice(index + 1, endIndex), context) }
          index = endIndex
          precedingKey = undefined
        }
      }
      if (precedingKey) {
        entry.key = `anchor:${precedingKey}`
      }
    }
    else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element
      entry.attributes = sourceAttributes ? new Map(sourceAttributes) : new Map([...element.attributes].map(attribute => [attribute.name, attribute.value]))
      if (sourceAttributes) {
        for (const [name, value] of sourceAttributes) {
          if (element.getAttribute(name) !== value) {
            element.setAttribute(name, value)
          }
        }
      }
      entry.key = precedingKey ? `${element.localName}:${precedingKey}` : undefined
      if (!SELF_CLOSING_TAGS.has(element.localName)) {
        // eslint-disable-next-line ts/no-use-before-define -- 元素与片段共享渲染节点捕获入口。
        entry.children = captureRange(element, context)
      }
      precedingKey = undefined
      sourceAttributes = undefined
    }
    else {
      precedingKey = undefined
      sourceAttributes = undefined
    }
    entries.push(entry)
  }
  return entries
}

function captureRange(parent: Node, context: object): MarkupRange {
  const document = parent.ownerDocument!
  const entries = captureEntries([...parent.childNodes], context)
  // 边界跟随原生组件搬移的内容，更新时只操作模板拥有的节点。
  const start = document.createComment('')
  const end = document.createComment('')
  parent.insertBefore(start, parent.firstChild)
  parent.appendChild(end)
  return { start, end, entries }
}

function sameKind(previous: MarkupEntry, incoming: MarkupEntry) {
  if (previous.node.nodeType !== incoming.node.nodeType || previous.key !== incoming.key) {
    return false
  }
  if (previous.children && (!previous.children.start.parentNode || previous.children.start.parentNode !== previous.children.end.parentNode)) {
    return false
  }
  if (previous.node.nodeType !== Node.ELEMENT_NODE) {
    return true
  }
  const before = previous.node as Element
  const after = incoming.node as Element
  return before.localName === after.localName
    && before.namespaceURI === after.namespaceURI
}

function updateClass(element: Element, previous: string, incoming: string | undefined) {
  const next = new Set(incoming?.split(/\s+/).filter(Boolean))
  for (const token of previous.split(/\s+/).filter(Boolean)) {
    if (!next.has(token)) {
      element.classList.remove(token)
    }
  }
  for (const token of next) {
    element.classList.add(token)
  }
  if (!element.classList.length) {
    element.removeAttribute('class')
  }
}

function updateStyle(element: Element, previous: string, incoming: string | undefined) {
  const before = element.ownerDocument.createElement('span').style
  const after = element.ownerDocument.createElement('span').style
  before.cssText = previous
  after.cssText = incoming ?? ''
  const style = (element as HTMLElement).style
  for (let index = 0; index < before.length; index++) {
    const property = before.item(index)
    if (!after.getPropertyValue(property)) {
      style.removeProperty(property)
    }
  }
  for (let index = 0; index < after.length; index++) {
    const property = after.item(index)
    const value = after.getPropertyValue(property)
    const priority = after.getPropertyPriority(property)
    if (value !== before.getPropertyValue(property) || priority !== before.getPropertyPriority(property)) {
      style.setProperty(property, value, priority)
    }
  }
  if (!style.length) {
    element.removeAttribute('style')
  }
}

function updateAttributes(previous: MarkupEntry, incoming: MarkupEntry) {
  const element = previous.node as Element
  const before = previous.attributes!
  const after = incoming.attributes!
  for (const name of new Set([...before.keys(), ...after.keys()])) {
    const oldValue = before.get(name)
    const newValue = after.get(name)
    if (oldValue === newValue) {
      continue
    }
    if (name === 'class') {
      updateClass(element, oldValue ?? '', newValue)
    }
    else if (name === 'style') {
      updateStyle(element, oldValue ?? '', newValue)
    }
    else if (newValue === undefined) {
      element.removeAttribute(name)
    }
    else {
      element.setAttribute(name, newValue)
    }
  }
  previous.attributes = after
}

function updateEntry(previous: MarkupEntry, incoming: MarkupEntry) {
  if (previous.attributes && incoming.attributes) {
    updateAttributes(previous, incoming)
  }
  else if (previous.node.nodeValue !== incoming.node.nodeValue) {
    previous.node.nodeValue = incoming.node.nodeValue
  }
  // 属性回调可能接管整个 light DOM；已丢失的模板边界不能再作为写入位置。
  if (previous.children?.end.parentNode && previous.children.start.parentNode === previous.children.end.parentNode && incoming.children) {
    // eslint-disable-next-line ts/no-use-before-define -- 子树与兄弟范围共用同一递归更新入口。
    reconcileRange(previous.children, incoming.children)
  }
}

function entryNodes(entry: MarkupEntry) {
  const nodes = [entry.node]
  if (entry.children && !entry.attributes) {
    let current = entry.node
    while (current !== entry.children.end && current.nextSibling) {
      current = current.nextSibling
      nodes.push(current)
    }
  }
  return nodes
}

function reconcileRange(previous: MarkupRange, incoming: MarkupRange) {
  const parent = previous.end.parentNode!
  const remaining = new Set(previous.entries)
  const keyed = new Map<string, MarkupEntry[]>()
  for (const entry of previous.entries) {
    if (entry.key) {
      const matches = keyed.get(entry.key) ?? []
      matches.push(entry)
      keyed.set(entry.key, matches)
    }
  }
  const entries = incoming.entries.map((next, index) => {
    const candidate = next.key ? keyed.get(next.key)?.shift() : previous.entries[index]
    const retained = candidate && remaining.has(candidate) && sameKind(candidate, next) ? candidate : undefined
    const entry = retained ?? next
    if (retained) {
      remaining.delete(retained)
      updateEntry(retained, next)
    }
    return entry
  })
  for (const entry of remaining) {
    for (const node of entryNodes(entry)) {
      node.parentNode?.removeChild(node)
    }
  }
  let cursor: Node | null = previous.start.nextSibling
  for (const entry of entries) {
    if (entry.node !== cursor) {
      for (const node of entryNodes(entry)) {
        parent.insertBefore(node, cursor ?? previous.end)
      }
    }
    cursor = (entry.children && !entry.attributes ? entry.children.end : entry.node).nextSibling
  }
  previous.entries = entries
}

class LegacyMarkupDirective extends Directive {
  #source?: string
  #keySignature?: string
  #range?: MarkupRange

  constructor(partInfo: PartInfo) {
    super(partInfo)
    if (partInfo.type !== PartType.CHILD) {
      throw new TypeError('Legacy markup requires a child expression.')
    }
  }

  render(source: string, context: object) {
    const keySignature = resolveLegacyMarkupKeySignature(context)
    if (keySignature === undefined) {
      this.#source = undefined
      this.#range = undefined
      this.#keySignature = undefined
      return unsafeHTML(source)
    }
    if (source === this.#source && keySignature === this.#keySignature) {
      return noChange
    }
    const template = document.createElement('template')
    template.innerHTML = source
    const incoming = captureRange(template.content, context)
    this.#source = source
    this.#keySignature = keySignature
    if (this.#range?.start.parentNode && this.#range.start.parentNode === this.#range.end.parentNode) {
      reconcileRange(this.#range, incoming)
      return noChange
    }
    this.#range = incoming
    return template.content
  }
}

/** 字符串模板更新只提交自身文本和属性，保留宿主状态及正在冒泡的事件路径。 */
export const legacyMarkup = directive(LegacyMarkupDirective)
