function getVueCompilerLib(value: unknown) {
  if (Array.isArray(value)) {
    const resolved = value.filter(item => typeof item === 'string')
    return resolved.length > 0 ? resolved : undefined
  }
  if (typeof value === 'string') {
    return value
  }
  return undefined
}

function splitTopLevelTypeArgs(value: string) {
  const args: string[] = []
  let depth = 0
  let start = 0
  let quote: '"' | '\'' | '`' | null = null
  let escape = false
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i]
    if (quote) {
      if (escape) {
        escape = false
        continue
      }
      if (char === '\\') {
        escape = true
        continue
      }
      if (char === quote) {
        quote = null
      }
      continue
    }
    if (char === '"' || char === '\'' || char === '`') {
      quote = char
      continue
    }
    if (char === '<') {
      depth += 1
      continue
    }
    if (char === '>') {
      if (depth > 0) {
        depth -= 1
      }
      continue
    }
    if (char === ',' && depth === 0) {
      args.push(value.slice(start, i).trim())
      start = i + 1
    }
  }
  const tail = value.slice(start).trim()
  if (tail) {
    args.push(tail)
  }
  return args
}

function findMatchingAngleBracket(value: string, start: number) {
  let depth = 1
  let quote: '"' | '\'' | '`' | null = null
  let escape = false
  for (let i = start; i < value.length; i += 1) {
    const char = value[i]
    if (quote) {
      if (escape) {
        escape = false
        continue
      }
      if (char === '\\') {
        escape = true
        continue
      }
      if (char === quote) {
        quote = null
      }
      continue
    }
    if (char === '"' || char === '\'' || char === '`') {
      quote = char
      continue
    }
    if (char === '<') {
      depth += 1
      continue
    }
    if (char === '>') {
      depth -= 1
      if (depth === 0) {
        return i
      }
    }
  }
  return -1
}

export function rewriteVueComponentTypeToWevu(content: string) {
  const token = 'import("vue").DefineComponent<'
  const tokenSingle = 'import(\'vue\').DefineComponent<'
  if (!content.includes(token) && !content.includes(tokenSingle)) {
    return content
  }
  let result = ''
  let index = 0
  while (index < content.length) {
    const nextDouble = content.indexOf(token, index)
    const nextSingle = content.indexOf(tokenSingle, index)
    const next = nextDouble === -1
      ? nextSingle
      : nextSingle === -1
        ? nextDouble
        : Math.min(nextDouble, nextSingle)
    if (next === -1) {
      result += content.slice(index)
      break
    }
    const match = next === nextDouble ? token : tokenSingle
    result += content.slice(index, next)
    const start = next + match.length
    const end = findMatchingAngleBracket(content, start)
    if (end === -1) {
      result += content.slice(next)
      break
    }
    const args = splitTopLevelTypeArgs(content.slice(start, end))
    while (args.length < 5) {
      args.push('any')
    }
    result += `import(\"wevu\").WevuComponentConstructor<${args.slice(0, 5).join(', ')}>`
    index = end + 1
  }
  return result
}

export function getVueCompilerLibOrUndefined(value: unknown) {
  return getVueCompilerLib(value)
}

export function shouldRewriteWevuComponentType(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return value.includes('wevu')
  }
  if (typeof value === 'string') {
    return value === 'wevu'
  }
  return true
}
