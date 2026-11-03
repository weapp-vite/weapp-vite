import type { Document, ElementNode, Node } from '../types'
import { parse } from '../parser'

export interface NodeEdits {
  name?: string
  attributes?: Map<string, string | null | undefined>
  unvalidatedAttributes?: Set<string>
  literalText?: boolean
  before?: EditSource[]
  after?: EditSource[]
  prepend?: EditSource[]
  append?: EditSource[]
  replacement?: EditSource
  removed: boolean
}

export interface DeferredSnippet {
  readonly kind: 'snippet'
  readonly source: string
}

export type EditSource = string | DeferredSnippet

export interface EditSession {
  document: Document
  active: boolean
  hasStructuralInvalidations: boolean
  edits: Map<Node, NodeEdits>
  rawOwners?: Map<ElementNode, { isInvalidated: () => boolean }>
}

export function stateFor(session: EditSession, node: Node): NodeEdits {
  let state = session.edits.get(node)
  if (!state) {
    state = { removed: false }
    session.edits.set(node, state)
  }
  return state
}

export function assertName(name: string) {
  if (typeof name !== 'string' || !/^[A-Z_][\w:.-]*$/i.test(name)) {
    throw new TypeError(`Invalid WXML name: ${String(name)}.`)
  }
}

export function assertValid(document: Document) {
  const diagnostic = document.diagnostics.find(item => item.severity === 'error')
  if (diagnostic) {
    throw new TypeError(`Invalid WXML document: ${diagnostic.message}`)
  }
}

export function validateSnippet(session: EditSession, source: string, raw = false) {
  if (typeof source !== 'string') {
    throw new TypeError('Expected a WXML source string.')
  }
  if (!source) {
    return source
  }
  if (!raw) {
    if (session.document.options.resolveScriptBoundary) {
      return { kind: 'snippet', source } as const
    }
    assertValid(parse(source, session.document.options))
  }
  return source
}
