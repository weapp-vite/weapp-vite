export interface MiniProgramPlatform {
  name: string

  wrapIf: (exp: string, content: string) => string
  wrapElseIf: (exp: string, content: string) => string
  wrapElse: (content: string) => string

  forAttrs: (listExp: string, item?: string, index?: string) => string[]

  keyThisValue: string
  keyAttr: (value: string) => string

  mapEventName: (eventName: string) => string
  eventBindingAttr: (eventName: string) => string
}
