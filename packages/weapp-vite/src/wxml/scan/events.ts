import type { MpPlatform } from '../../types'
import { isBuiltinComponent } from '../../auto-import-components/builtin'

function toPascalCaseEvent(eventName: string) {
  if (!eventName) {
    return ''
  }
  const first = eventName[0] ?? ''
  return `${first.toUpperCase()}${eventName.slice(1)}`
}

function resolveEventDirective(raw: string, platform: MpPlatform) {
  if (!raw.startsWith('@')) {
    return undefined
  }

  let dir = ''
  let segment = ''
  let hasCatch = false
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
  if (hasCatch && hasCapture) {
    prefix = 'capture-catch'
  }
  else if (hasCatch) {
    prefix = 'catch'
  }
  else if (hasMut) {
    prefix = 'mut-bind'
  }
  else if (hasCapture) {
    prefix = 'capture-bind'
  }

  if (platform === 'alipay') {
    const pascalEvent = toPascalCaseEvent(dir)
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

  return `${prefix}:${dir}`
}

export function defaultExcludeComponent(tagName: string) {
  return isBuiltinComponent(tagName)
}

export function resolveEventDirectiveName(raw: string, platform: MpPlatform = 'weapp') {
  return resolveEventDirective(raw, platform)
}
