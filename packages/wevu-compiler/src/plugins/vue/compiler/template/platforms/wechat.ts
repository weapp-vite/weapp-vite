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

function parseEventBinding(eventName: string) {
  const prefixed = /^(bind|catch|capture-bind|capture-catch|mut-bind):(.+)$/.exec(eventName)
  if (prefixed) {
    return {
      prefix: prefixed[1],
      name: prefixed[2],
    }
  }

  return {
    prefix: 'bind',
    name: eventName,
  }
}

/**
 * 微信小程序平台适配器。
 */
export const wechatPlatform: MiniProgramPlatform = {
  name: 'wechat',

  wrapIf: (exp, content, renderMustache) => `<block wx:if="${renderMustache(exp)}">${content}</block>`,
  wrapElseIf: (exp, content, renderMustache) => `<block wx:elif="${renderMustache(exp)}">${content}</block>`,
  wrapElse: content => `<block wx:else>${content}</block>`,

  forAttrs: (listExp, renderMustache, item, index) => {
    const attrs = [`wx:for="${renderMustache(listExp)}"`]
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
    const { prefix, name } = parseEventBinding(eventName)
    switch (prefix) {
      case 'catch':
        return name.includes(':') ? `catch:${name}` : `catch${name}`
      case 'capture-bind':
        return `capture-bind:${name}`
      case 'capture-catch':
        return `capture-catch:${name}`
      case 'mut-bind':
        return `mut-bind:${name}`
      default:
        return name.includes(':') ? `bind:${name}` : `bind${name}`
    }
  },
}
