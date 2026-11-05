import type { CanonicalAttribute } from '../encoding'
import type { ElementNode, Node, TemplateDocument } from '../types'

export interface CanonicalElement {
  readonly name: string
  readonly attributes: readonly CanonicalAttribute[]
}

export interface EditOverlay {
  readonly original: TemplateDocument
  readonly elements: ReadonlyMap<ElementNode, CanonicalElement>
  readonly text: ReadonlyMap<Node, string>
}

export const editOverlays = new WeakMap<TemplateDocument, EditOverlay>()
