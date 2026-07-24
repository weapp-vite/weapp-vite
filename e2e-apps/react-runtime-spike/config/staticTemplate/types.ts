import type { JSXElement, JSXFragment } from '@weapp-vite/ast/babelTypes'

export interface StaticTemplateSlot {
  bindings: string[]
  id: string
  tag: string
}

export interface StaticTemplateCompileResult {
  code: string
  slots: StaticTemplateSlot[]
  template: string
}

export interface StaticTemplateRenderContext {
  slots: StaticTemplateSlot[]
  slotSeed: number
}

export type StaticTemplateRoot = JSXElement | JSXFragment
