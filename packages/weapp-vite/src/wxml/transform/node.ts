import type { WxmlAttribute, WxmlElementInfo, WxmlTransformNode } from '../../types'
import type { WxmlSyntax } from '../template/lexical'
import type { SourceEdit } from '../template/ranges'
import type { Attribute, Element } from '../template/scan'
import type { createLocator } from './encoding'
import { isProtectedAttribute, structuralTags } from '../remove/safety'
import { failAt } from '../template/lexical'
import { encodeAttribute } from './encoding'

interface EditableAttribute {
  name: string
  source?: Attribute
  replacement?: string
  value: WxmlAttribute
  removed?: boolean
}

export interface EditorState {
  active: boolean
  code: string
  fileName: string
  syntax: WxmlSyntax
  locate: ReturnType<typeof createLocator>
}

export function createEditableNode(state: EditorState, node: Element, parent?: WxmlElementInfo) {
  const { code, fileName } = state
  let tagName = node.tag
  const attrs: EditableAttribute[] = node.attrs.map(attr => ({
    name: attr.name,
    source: attr,
    value: Object.freeze({
      name: attr.name,
      rawValue: attr.end === attr.nameEnd ? null : code.slice(attr.valueStart, attr.valueEnd),
      quote: attr.quote,
    }),
  }))
  const fail = (message: string): never => failAt(code, fileName, node.start, message)
  const assertActive = () => {
    if (!state.active || node.removed) {
      fail('This template node is no longer editable.')
    }
  }
  const assertName = (name: string) => {
    if (typeof name !== 'string' || !/^[A-Z_][\w:.-]*$/i.test(name)) {
      fail(`Invalid template name: ${String(name)}.`)
    }
  }
  const assertAttribute = (name: string, rawValue = '') => {
    assertActive()
    assertName(name)
    const synthetic: Attribute = { name, nameEnd: 0, start: 0, end: rawValue.length, valueStart: 0, valueEnd: rawValue.length }
    if (isProtectedAttribute(rawValue, { ...node, tag: tagName }, synthetic, true)
      || attrs.some(attr => !attr.removed && attr.name === name && attr.source && isProtectedAttribute(code, node, attr.source, true))) {
      fail(`Cannot modify protected attribute ${name}.`)
    }
  }
  const find = (name: string) => attrs.find(attr => !attr.removed && attr.name === name)
  const set = (name: string, rawValue: string | null) => {
    assertAttribute(name, rawValue ?? '')
    let attr = find(name)
    for (const item of attrs) {
      if (!item.removed && item.name === name && item !== attr) {
        item.removed = true
      }
    }
    if (!attr) {
      attr = { name, value: { name, rawValue, quote: undefined } }
      attrs.push(attr)
    }
    attr.replacement = rawValue === null ? name : `${name}="${rawValue}"`
    attr.value = Object.freeze({ name, rawValue, quote: rawValue === null ? undefined : '"' })
  }
  const info: WxmlElementInfo = Object.freeze({
    get tagName() { return tagName },
    get attributes() { return Object.freeze(attrs.filter(attr => !attr.removed).map(attr => attr.value)) },
    parent,
    location: state.locate(node.start),
    hasAttribute: (name: string) => Boolean(find(name)),
    getAttribute: (name: string) => find(name)?.value,
  })
  const handle: WxmlTransformNode = Object.freeze<WxmlTransformNode>({
    get tagName() { return info.tagName },
    get attributes() { return info.attributes },
    parent,
    location: info.location,
    hasAttribute: info.hasAttribute,
    getAttribute: info.getAttribute,
    setAttribute(name, value) {
      let encoded: string
      try {
        encoded = encodeAttribute(value, state.syntax)
      }
      catch (error) {
        fail(error instanceof Error ? error.message : String(error))
      }
      set(name, encoded!)
    },
    setBooleanAttribute: name => set(name, null),
    removeAttribute(name) {
      assertAttribute(name)
      for (const attr of attrs) {
        if (attr.name === name) {
          attr.removed = true
        }
      }
    },
    renameAttribute(from, to) {
      assertAttribute(from)
      assertAttribute(to)
      if (from === to || !find(from)) {
        return
      }
      if (find(to)) {
        fail(`Cannot rename ${from} to existing attribute ${to}.`)
      }
      for (const attr of attrs) {
        if (attr.removed || attr.name !== from) {
          continue
        }
        assertAttribute(to, attr.value.rawValue ?? '')
        const source = attr.replacement ?? code.slice(attr.source!.start, attr.source!.end)
        attr.replacement = to + source.slice(from.length)
        attr.name = to
        attr.value = Object.freeze({ ...attr.value, name: to })
      }
    },
    renameTag(name) {
      assertActive()
      assertName(name)
      if (structuralTags.has(node.tag) || structuralTags.has(name)) {
        fail(`Cannot rename structural tag <${node.tag}> to <${name}>.`)
      }
      tagName = name
    },
    remove() {
      assertActive()
      if (structuralTags.has(node.tag)) {
        fail(`Cannot remove structural tag <${node.tag}>.`)
      }
      node.removed = true
    },
  })
  return {
    info,
    handle,
    edits(): SourceEdit[] {
      if (node.removed) {
        return [{ start: node.start, end: node.end }]
      }
      const edits: SourceEdit[] = []
      if (tagName !== node.tag) {
        edits.push({ start: node.nameStart, end: node.nameEnd, text: tagName })
        if (node.closingName) {
          edits.push({ ...node.closingName, text: tagName })
        }
      }
      const additions: string[] = []
      for (const attr of attrs) {
        if (attr.source && (attr.removed || attr.replacement !== undefined)) {
          edits.push({ ...attr.source, text: attr.removed ? '' : attr.replacement })
        }
        else if (!attr.source && !attr.removed) {
          additions.push(` ${attr.replacement}`)
        }
      }
      if (additions.length) {
        const position = node.openingEnd - (node.selfClosing ? 2 : 1)
        edits.push({ start: position, end: position, text: additions.join('') })
      }
      return edits
    },
  }
}
