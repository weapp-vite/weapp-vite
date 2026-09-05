import type { MiniProgramPlatform } from '../platform'
import { createMiniProgramDirectiveAttrs, normalizeMiniProgramEventName } from '../platform'
import { ALIPAY_JSX_EVENT_NAME_ALIASES } from './generatedEventAliases'

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
  touchcancel: 'touchCancel',
  longtap: 'longTap',
  longpress: 'longTap',
}

const PASCALIZE_EVENT_RE = /(^|-)([a-z0-9])/g

function toPascalEventName(eventName: string) {
  return eventName.replace(PASCALIZE_EVENT_RE, (_match, _separator, character: string) => character.toUpperCase())
}

function toOnEventName(eventName: string) {
  return `on${toPascalEventName(eventName)}`
}

const EVENT_BINDING_PREFIX_RE = /^(bind|catch|capture-bind|capture-catch|mut-bind):(.+)$/

function parseEventBinding(eventName: string) {
  const prefixed = EVENT_BINDING_PREFIX_RE.exec(eventName)
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
  const pascalEvent = toPascalEventName(eventName)

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
const directives = createMiniProgramDirectiveAttrs('a')

export const alipayPlatform: MiniProgramPlatform = {
  name: 'alipay',
  directives,

  wrapIf: (exp, content, renderMustache) => `<block ${directives.ifAttr}="${renderMustache(exp)}">${content}</block>`,
  wrapElseIf: (exp, content, renderMustache) => `<block ${directives.elifAttr}="${renderMustache(exp)}">${content}</block>`,
  wrapElse: content => `<block ${directives.elseAttr}>${content}</block>`,

  forAttrs: (listExp, renderMustache, item, index) => {
    const attrs = [`${directives.forAttr}="${renderMustache(listExp)}"`]
    if (item) {
      attrs.push(`${directives.forItemAttr}="${item}"`)
    }
    if (index) {
      attrs.push(`${directives.forIndexAttr}="${index}"`)
    }
    return attrs
  },

  keyThisValue: '*this',
  keyAttr: value => `${directives.keyAttr}="${value}"`,

  mapEventName: eventName => eventMap[eventName.toLowerCase()] || eventName,
  eventBindingAlias: (eventName, tagName) => tagName ? ALIPAY_JSX_EVENT_NAME_ALIASES[tagName]?.[eventName] : undefined,
  eventBindingAttr: (eventName) => {
    const { prefix, name } = parseEventBinding(eventName)
    return toAlipayDirectiveEvent(prefix, normalizeMiniProgramEventName(name))
  },
}
