import type { MpPlatform } from '../../types'
import { isBuiltinComponent } from '../../auto-import-components/builtin'

function toPascalCaseEvent(eventName: string) {
  if (!eventName) {
    return ''
  }
  const first = eventName[0] ?? ''
  return `${first.toUpperCase()}${eventName.slice(1)}`
}

function resolveAlipayEventName(prefix: 'bind' | 'catch' | 'capture-bind' | 'capture-catch' | 'mut-bind', eventName: string) {
  const pascalEvent = toPascalCaseEvent(eventName)
  switch (prefix) {
    case 'bind':
      return `on${pascalEvent}`
    case 'catch':
      return `catch${pascalEvent}`
    case 'capture-bind':
      return `capture${pascalEvent}`
    case 'capture-catch':
      return `captureCatch${pascalEvent}`
    default:
      return `on${pascalEvent}`
  }
}

function resolveAlipayNativeEventBinding(raw: string) {
  const colonMatch = /^(bind|catch|capture-bind|capture-catch|mut-bind):(.+)$/.exec(raw)
  if (colonMatch) {
    const prefix = colonMatch[1] as 'bind' | 'catch' | 'capture-bind' | 'capture-catch' | 'mut-bind'
    const eventName = colonMatch[2]
    if (!eventName) {
      return undefined
    }
    return resolveAlipayEventName(prefix, eventName)
  }

  const plainMatch = /^(bind|catch)([A-Za-z].*)$/.exec(raw)
  if (plainMatch) {
    const prefix = plainMatch[1] as 'bind' | 'catch'
    const eventName = plainMatch[2]
    if (!eventName) {
      return undefined
    }
    const normalized = eventName[0].toLowerCase() + eventName.slice(1)
    return resolveAlipayEventName(prefix, normalized)
  }

  return undefined
}

function resolveEventDirective(raw: string, platform: MpPlatform) {
  if (!raw.startsWith('@')) {
    return undefined
  }

  let dir = ''
  let segment = ''
  let hasCatch = false
  let hasStop = false
  let hasCapture = false
  let hasMut = false

  const flush = () => {
    if (!segment) {
      return
    }
    if (!dir) {
      dir = segment
    }
    else {
      if (segment === 'catch') {
        hasCatch = true
      }
      else if (segment === 'stop') {
        hasStop = true
      }
      else if (segment === 'capture') {
        hasCapture = true
      }
      else if (segment === 'mut') {
        hasMut = true
      }
    }
    segment = ''
  }

  for (let i = 1; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === '.') {
      flush()
    }
    else {
      segment += ch
    }
  }
  flush()

  if (!dir) {
    return undefined
  }

  let prefix = 'bind'
  if ((hasCatch || hasStop) && hasCapture) {
    prefix = 'capture-catch'
  }
  else if (hasCatch || hasStop) {
    prefix = 'catch'
  }
  else if (hasMut) {
    prefix = 'mut-bind'
  }
  else if (hasCapture) {
    prefix = 'capture-bind'
  }

  if (platform === 'alipay') {
    return resolveAlipayEventName(prefix as 'bind' | 'catch' | 'capture-bind' | 'capture-catch' | 'mut-bind', dir)
  }

  return `${prefix}:${dir}`
}

export function defaultExcludeComponent(tagName: string) {
  return isBuiltinComponent(tagName)
}

export function resolveEventDirectiveName(raw: string, platform: MpPlatform = 'weapp') {
  const directive = resolveEventDirective(raw, platform)
  if (directive) {
    return directive
  }

  if (platform === 'alipay') {
    return resolveAlipayNativeEventBinding(raw)
  }

  return undefined
}
