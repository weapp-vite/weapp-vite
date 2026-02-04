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

function toOnEventName(eventName: string) {
  if (!eventName) {
    return 'on'
  }
  const first = eventName[0] ?? ''
  return `on${first.toUpperCase()}${eventName.slice(1)}`
}

/**
 * 支付宝小程序平台适配器。
 */
export const alipayPlatform: MiniProgramPlatform = {
  name: 'alipay',

  wrapIf: (exp, content) => `<block a:if="{{${exp}}}">${content}</block>`,
  wrapElseIf: (exp, content) => `<block a:elif="{{${exp}}}">${content}</block>`,
  wrapElse: content => `<block a:else>${content}</block>`,

  forAttrs: (listExp, item, index) => {
    const attrs = [`a:for="{{${listExp}}}"`]
    if (item) {
      attrs.push(`a:for-item="${item}"`)
    }
    if (index) {
      attrs.push(`a:for-index="${index}"`)
    }
    return attrs
  },

  keyThisValue: '*this',
  keyAttr: value => `a:key="${value}"`,

  mapEventName: eventName => eventMap[eventName] || eventName,
  eventBindingAttr: (eventName) => {
    if (eventName.includes(':')) {
      return `on:${eventName}`
    }
    return toOnEventName(eventName)
  },
}
