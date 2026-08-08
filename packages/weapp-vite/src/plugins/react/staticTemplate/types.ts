import type { JSXElement, JSXFragment } from '@weapp-vite/ast/babelTypes'

export interface StaticTemplateSlot {
  bindings: string[]
  id: string
  tag: string
}

export interface StaticTemplateCompileResult {
  code: string
  nativeComponents: string[]
  slots: StaticTemplateSlot[]
  template: string
}

export interface StaticTemplateRenderContext {
  nativeComponentTags: Map<string, string>
  slots: StaticTemplateSlot[]
  slotSeed: number
  slotComponentNames: Set<string>
  usedNativeComponents: Set<string>
}

export type StaticTemplateRoot = JSXElement | JSXFragment
