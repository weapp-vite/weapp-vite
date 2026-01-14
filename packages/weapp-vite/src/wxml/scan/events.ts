import { isBuiltinComponent } from '../../auto-import-components/builtin'

function resolveEventDirective(raw: string) {
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

  return `${prefix}:${dir}`
}

export function defaultExcludeComponent(tagName: string) {
  return isBuiltinComponent(tagName)
}

export function resolveEventDirectiveName(raw: string) {
  return resolveEventDirective(raw)
}
