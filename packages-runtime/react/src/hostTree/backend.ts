import type { HostProps } from '../types'
import type { HostElement } from './nodes'

export interface HostRendererBackend {
  readonly container: object
  appendChild: (parent: object, child: object) => void
  createElement: (type: string) => object
  createText: (value: string) => object
  disposeNode: (node: object) => void
  flush: () => void
  insertBefore: (parent: object, child: object, before: object) => void
  removeChild: (parent: object, child: object) => void
  setElementProps: (element: HostElement, previous: HostProps, next: HostProps) => void
  setText: (node: object, value: string) => void
}
