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

function toAlipayDirectiveEvent(prefix: string, eventName: string) {
  if (!eventName) {
    return 'on'
  }
  const first = eventName[0] ?? ''
  const pascalEvent = `${first.toUpperCase()}${eventName.slice(1)}`

  switch (prefix) {
    case 'catch':
      return `catch${pascalEvent}`
    case 'capture-bind':
      return `capture${pascalEvent}`
    case 'capture-catch':
      return `captureCatch${pascalEvent}`
    default:
      return toOnEventName(eventName)
  }
}

/**
 * 支付宝小程序平台适配器。
 */
export const alipayPlatform: MiniProgramPlatform = {
  name: 'alipay',

  wrapIf: (exp, content, renderMustache) => `<block a:if="${renderMustache(exp)}">${content}</block>`,
  wrapElseIf: (exp, content, renderMustache) => `<block a:elif="${renderMustache(exp)}">${content}</block>`,
  wrapElse: content => `<block a:else>${content}</block>`,

  forAttrs: (listExp, renderMustache, item, index) => {
    const attrs = [`a:for="${renderMustache(listExp)}"`]
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
    const { prefix, name } = parseEventBinding(eventName)
    if (name.includes(':')) {
      return `on:${name}`
    }
    return toAlipayDirectiveEvent(prefix, name)
  },
}
