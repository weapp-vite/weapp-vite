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

export const ttPlatform: MiniProgramPlatform = {
  name: 'tt',

  wrapIf: (exp, content) => `<block tt:if="{{${exp}}}">${content}</block>`,
  wrapElseIf: (exp, content) => `<block tt:elif="{{${exp}}}">${content}</block>`,
  wrapElse: content => `<block tt:else>${content}</block>`,

  forAttrs: (listExp, item, index) => {
    const attrs = [`tt:for="{{${listExp}}}"`]
    if (item) {
      attrs.push(`tt:for-item="${item}"`)
    }
    if (index) {
      attrs.push(`tt:for-index="${index}"`)
    }
    return attrs
  },

  keyThisValue: '*this',
  keyAttr: value => `tt:key="${value}"`,

  mapEventName: eventName => eventMap[eventName] || eventName,
  eventBindingAttr: (eventName) => {
    return eventName.includes(':') ? `bind:${eventName}` : `bind${eventName}`
  },
}
