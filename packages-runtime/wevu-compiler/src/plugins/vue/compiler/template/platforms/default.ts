import type { MiniProgramPlatform } from '../platform'
import { createMiniProgramDirectiveAttrs } from '../platform'

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

function shouldUseColonEventBinding(name: string) {
  return name.includes(':') || name.includes('-')
}

const directives = createMiniProgramDirectiveAttrs('wx')

/**
 * 默认小程序模板平台实现。
 *
 * 当前默认实现与微信模板语义保持一致，但应作为默认平台接入点使用，
 * 以避免内部链路继续绑定具体宿主命名。
 */
export const defaultMiniProgramPlatform: MiniProgramPlatform = {
  name: 'wechat',
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

  mapEventName: eventName => eventMap[eventName] || eventName,
  eventBindingAttr: (eventName) => {
    const { prefix, name } = parseEventBinding(eventName)
    switch (prefix) {
      case 'catch':
        return shouldUseColonEventBinding(name) ? `catch:${name}` : `catch${name}`
      case 'capture-bind':
        return `capture-bind:${name}`
      case 'capture-catch':
        return `capture-catch:${name}`
      case 'mut-bind':
        return `mut-bind:${name}`
      default:
        return shouldUseColonEventBinding(name) ? `bind:${name}` : `bind${name}`
    }
  },
}

/**
 * 默认模板平台对象的简写别名。
 */
export const defaultPlatform = defaultMiniProgramPlatform
