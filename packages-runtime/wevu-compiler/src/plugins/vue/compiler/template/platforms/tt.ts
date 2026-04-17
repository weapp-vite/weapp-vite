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

/**
 * 抖音小程序平台适配器。
 */
const directives = createMiniProgramDirectiveAttrs('tt')

export const ttPlatform: MiniProgramPlatform = {
  name: 'tt',
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
