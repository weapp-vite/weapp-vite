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

/**
 * 微信小程序平台适配器。
 */
export const wechatPlatform: MiniProgramPlatform = {
  name: 'wechat',

  wrapIf: (exp, content) => `<block wx:if="{{${exp}}}">${content}</block>`,
  wrapElseIf: (exp, content) => `<block wx:elif="{{${exp}}}">${content}</block>`,
  wrapElse: content => `<block wx:else>${content}</block>`,

  forAttrs: (listExp, item, index) => {
    const attrs = [`wx:for="{{${listExp}}}"`]
    if (item) {
      attrs.push(`wx:for-item="${item}"`)
    }
    if (index) {
      attrs.push(`wx:for-index="${index}"`)
    }
    return attrs
  },

  keyThisValue: '*this',
  keyAttr: value => `wx:key="${value}"`,

  mapEventName: eventName => eventMap[eventName] || eventName,
  eventBindingAttr: (eventName) => {
    return eventName.includes(':') ? `bind:${eventName}` : `bind${eventName}`
  },
}
