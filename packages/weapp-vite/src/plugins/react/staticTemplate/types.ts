import type { JSXElement, JSXFragment } from '@weapp-vite/ast/babelTypes'

/** 仅描述合法 JSX 超出静态模板能力；解析或内部编译错误不得降级。 */
export class ReactStaticTemplateUnsupportedError extends Error {}

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
