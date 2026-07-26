import postcss from 'postcss'

function findClosingParenthesis(source: string, openIndex: number) {
  let depth = 0
  let quote: string | undefined

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index]
    if (quote) {
      if (char === quote && source[index - 1] !== '\\') {
        quote = undefined
      }
      continue
    }
    if (char === '\u0022' || char === '\u0027') {
      quote = char
      continue
    }
    if (char === '(') {
      depth += 1
    }
    else if (char === ')' && --depth === 0) {
      return index
    }
  }

  return -1
}

function findTopLevelComma(source: string) {
  let depth = 0
  let quote: string | undefined

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quote) {
      if (char === quote && source[index - 1] !== '\\') {
        quote = undefined
      }
      continue
    }
    if (char === '\u0022' || char === '\u0027') {
      quote = char
    }
    else if (char === '(') {
      depth += 1
    }
    else if (char === ')') {
      depth -= 1
    }
    else if (char === ',' && depth === 0) {
      return index
    }
  }

  return -1
}

function resolveWxssVarFallback(source: string) {
  const openIndex = source.indexOf('(')
  const closeIndex = openIndex >= 0 ? findClosingParenthesis(source, openIndex) : -1
  if (openIndex < 0 || closeIndex < 0) {
    return 'initial'
  }

  const content = source.slice(openIndex + 1, closeIndex)
  const commaIndex = findTopLevelComma(content)
  if (commaIndex < 0) {
    return 'initial'
  }

  // eslint-disable-next-line ts/no-use-before-define
  return flattenWxssVarFallbacks(content.slice(commaIndex + 1))
}

function flattenWxssVarFallbacks(source: string) {
  let result = ''
  let cursor = 0

  while (cursor < source.length) {
    const varIndex = source.indexOf('var(', cursor)
    if (varIndex < 0) {
      result += source.slice(cursor)
      break
    }

    result += source.slice(cursor, varIndex)
    const closeIndex = findClosingParenthesis(source, varIndex + 3)
    if (closeIndex < 0) {
      result += source.slice(varIndex)
      break
    }
    result += resolveWxssVarFallback(source.slice(varIndex, closeIndex + 1))
    cursor = closeIndex + 1
  }

  return result
}

function lowerNestedWxssVarsInValue(source: string) {
  let result = ''
  let cursor = 0
  let changed = false

  while (cursor < source.length) {
    const varIndex = source.indexOf('var(', cursor)
    if (varIndex < 0) {
      result += source.slice(cursor)
      break
    }

    result += source.slice(cursor, varIndex)
    const closeIndex = findClosingParenthesis(source, varIndex + 3)
    if (closeIndex < 0) {
      result += source.slice(varIndex)
      break
    }

    const functionSource = source.slice(varIndex, closeIndex + 1)
    const content = functionSource.slice(4, -1)
    const commaIndex = findTopLevelComma(content)
    if (commaIndex >= 0 && content.slice(commaIndex + 1).includes('var(')) {
      const name = content.slice(0, commaIndex).trim()
      const fallback = flattenWxssVarFallbacks(content.slice(commaIndex + 1)).trim()
      result += `var(${name}, ${fallback})`
      changed = true
    }
    else {
      result += functionSource
    }
    cursor = closeIndex + 1
  }

  return changed ? result : source
}

/**
 * 压平 WXSS 不接受的嵌套 CSS 变量回退值。
 */
export function transformNestedWxssVars(source: string) {
  if (!source.includes('var(')) {
    return source
  }

  const root = postcss.parse(source)
  root.walkDecls((declaration) => {
    declaration.value = lowerNestedWxssVarsInValue(declaration.value)
  })
  return root.toString()
}
