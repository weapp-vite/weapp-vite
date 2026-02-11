/**
 * 小程序模板平台适配器定义。
 */
export interface MiniProgramPlatform {
  name: string

  wrapIf: (exp: string, content: string, renderMustache: (exp: string) => string) => string
  wrapElseIf: (exp: string, content: string, renderMustache: (exp: string) => string) => string
  wrapElse: (content: string) => string

  forAttrs: (listExp: string, renderMustache: (exp: string) => string, item?: string, index?: string) => string[]

  keyThisValue: string
  keyAttr: (value: string) => string

  mapEventName: (eventName: string) => string
  eventBindingAttr: (eventName: string) => string
}
