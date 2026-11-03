import type { CanonicalAttribute } from '../encoding'
import type { Document, ElementNode, Node } from '../types'

export interface CanonicalElement {
  readonly name: string
  readonly attributes: readonly CanonicalAttribute[]
}

export interface EditOverlay {
  readonly original: Document
  readonly elements: ReadonlyMap<ElementNode, CanonicalElement>
  readonly text: ReadonlyMap<Node, string>
}

export const editOverlays = new WeakMap<Document, EditOverlay>()
