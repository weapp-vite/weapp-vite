import type { MiniProgramPlatform } from '../platform'

const eventMap: Record<string, string> = {
  click: 'tap',
  dblclick: 'tap',
  mousedown: 'touchstart',
  mouseup: 'touchend',
  tap: 'tap',
  input: 'input',
  change: 'change',
  submit: 'submit',
  focus: 'focus',
  blur: 'blur',
  confirm: 'confirm',
  cancel: 'cancel',
  load: 'load',
  error: 'error',
  scroll: 'scroll',
  scrolltoupper: 'scrolltoupper',
  scrolltolower: 'scrolltolower',
  touchcancel: 'touchcancel',
  longtap: 'longtap',
  longpress: 'longpress',
}

export const swanPlatform: MiniProgramPlatform = {
  name: 'swan',

  wrapIf: (exp, content) => `<block s-if="{{${exp}}}">${content}</block>`,
  wrapElseIf: (exp, content) => `<block s-elif="{{${exp}}}">${content}</block>`,
  wrapElse: content => `<block s-else>${content}</block>`,

  forAttrs: (listExp, item, index) => {
    const attrs = [`s-for="{{${listExp}}}"`]
    if (item) {
      attrs.push(`s-for-item="${item}"`)
    }
    if (index) {
      attrs.push(`s-for-index="${index}"`)
    }
    return attrs
  },

  keyThisValue: '*this',
  keyAttr: value => `s-key="${value}"`,

  mapEventName: eventName => eventMap[eventName] || eventName,
  eventBindingAttr: (eventName) => {
    return eventName.includes(':') ? `bind:${eventName}` : `bind${eventName}`
  },
}
