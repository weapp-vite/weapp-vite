export interface MiniProgramDirectiveAttrs {
  ifAttr: string
  elifAttr: string
  elseAttr: string
  forAttr: string
  forItemAttr: string
  forIndexAttr: string
  keyAttr: string
}

/**
 * 小程序模板平台适配器定义。
 */
export interface MiniProgramPlatform {
  name: string
  directives: MiniProgramDirectiveAttrs

  wrapIf: (exp: string, content: string, renderMustache: (exp: string) => string) => string
  wrapElseIf: (exp: string, content: string, renderMustache: (exp: string) => string) => string
  wrapElse: (content: string) => string

  forAttrs: (listExp: string, renderMustache: (exp: string) => string, item?: string, index?: string) => string[]

  keyThisValue: string
  keyAttr: (value: string) => string

  mapEventName: (eventName: string) => string
  eventBindingAttr: (eventName: string) => string
}

/**
 * 创建结构指令属性名。
 */
export function createMiniProgramDirectiveAttrs(
  prefix: string,
  separator = ':',
): MiniProgramDirectiveAttrs {
  const resolveAttr = (suffix: string) => `${prefix}${separator}${suffix}`

  return {
    ifAttr: resolveAttr('if'),
    elifAttr: resolveAttr('elif'),
    elseAttr: resolveAttr('else'),
    forAttr: resolveAttr('for'),
    forItemAttr: resolveAttr('for-item'),
    forIndexAttr: resolveAttr('for-index'),
    keyAttr: resolveAttr('key'),
  }
}
