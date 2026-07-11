import path from 'node:path'

export interface StyleClassMatch {
  className: string
  filePath: string
  offset: number
}

interface ClassToken {
  className: string
  offset: number
}

function maskCommentsAndStrings(sourceText: string) {
  const chars = [...sourceText]
  let quote = ''

  for (let index = 0; index < chars.length; index++) {
    const char = chars[index]
    const next = chars[index + 1]

    if (quote) {
      if (char === '\\') {
        chars[index] = ' '
        if (index + 1 < chars.length) {
          chars[index + 1] = ' '
          index += 1
        }
        continue
      }
      if (char === quote) {
        quote = ''
      }
      chars[index] = char === '\n' ? '\n' : ' '
      continue
    }

    if (char === '"' || char === '\'') {
      quote = char
      chars[index] = ' '
      continue
    }

    if (char === '/' && next === '*') {
      chars[index] = ' '
      chars[index + 1] = ' '
      index += 2
      while (index < chars.length && !(chars[index] === '*' && chars[index + 1] === '/')) {
        chars[index] = chars[index] === '\n' ? '\n' : ' '
        index += 1
      }
      if (index < chars.length) {
        chars[index] = ' '
        chars[index + 1] = ' '
        index += 1
      }
      continue
    }

    if (char === '/' && next === '/') {
      chars[index] = ' '
      chars[index + 1] = ' '
      index += 2
      while (index < chars.length && chars[index] !== '\n') {
        chars[index] = ' '
        index += 1
      }
      index -= 1
    }
  }

  return chars.join('')
}

function collectSelectorTokens(selectorText: string, selectorOffset: number, parentClasses: ClassToken[]) {
  const tokens: ClassToken[] = []
  const directClassPattern = /\.([_a-zA-Z][\w-]*)/gu

  for (const match of selectorText.matchAll(directClassPattern)) {
    if (match.index == null) {
      continue
    }
    const tokenEnd = match.index + match[0].length
    if (selectorText.slice(tokenEnd).trimStart().startsWith('(') && match.index === selectorText.search(/\S/u)) {
      continue
    }
    tokens.push({
      className: match[1],
      offset: selectorOffset + match.index + 1,
    })
  }

  const suffixPattern = /&([-_a-zA-Z][\w-]*)/gu
  for (const match of selectorText.matchAll(suffixPattern)) {
    if (match.index == null) {
      continue
    }
    for (const parentClass of parentClasses) {
      tokens.push({
        className: `${parentClass.className}${match[1]}`,
        offset: selectorOffset + match.index,
      })
    }
  }

  return tokens
}

function collectBraceSyntaxMatches(sourceText: string, filePath: string) {
  const maskedText = maskCommentsAndStrings(sourceText)
  const matches: StyleClassMatch[] = []
  const stack: ClassToken[][] = []
  let statementStart = 0

  for (let index = 0; index < maskedText.length; index++) {
    const char = maskedText[index]

    if (char === '{') {
      const selectorText = maskedText.slice(statementStart, index)
      const parentClasses = stack.at(-1) ?? []
      const selectorClasses = selectorText.trimStart().startsWith('@')
        ? []
        : collectSelectorTokens(selectorText, statementStart, parentClasses)

      matches.push(...selectorClasses.map(token => ({ ...token, filePath })))
      stack.push(selectorClasses.length > 0 ? selectorClasses : parentClasses)
      statementStart = index + 1
    }
    else if (char === '}' || char === ';') {
      if (char === '}') {
        stack.pop()
      }
      statementStart = index + 1
    }
  }

  return matches
}

function isSassPropertyOrDirective(value: string) {
  return !value
    || value.startsWith('$')
    || value.startsWith('//')
    || value.startsWith('/*')
    || value.startsWith('@include')
    || value.startsWith('@extend')
    || value.startsWith('@use')
    || value.startsWith('@forward')
    || /^[\w-]+\s*:/u.test(value)
}

function collectIndentedSassMatches(sourceText: string, filePath: string) {
  const maskedText = maskCommentsAndStrings(sourceText)
  const matches: StyleClassMatch[] = []
  const stack: Array<{ classes: ClassToken[], indent: number }> = []
  let lineOffset = 0

  for (const line of maskedText.split(/\r?\n/u)) {
    const leading = line.match(/^\s*/u)?.[0] ?? ''
    const selectorText = line.slice(leading.length).trimEnd()
    const indent = leading.replace(/\t/gu, '  ').length

    while (stack.length > 0 && stack.at(-1)!.indent >= indent) {
      stack.pop()
    }

    if (!isSassPropertyOrDirective(selectorText)) {
      const parentClasses = stack.at(-1)?.classes ?? []
      const selectorClasses = selectorText.startsWith('@')
        ? []
        : collectSelectorTokens(selectorText, lineOffset + leading.length, parentClasses)
      matches.push(...selectorClasses.map(token => ({ ...token, filePath })))
      stack.push({
        classes: selectorClasses.length > 0 ? selectorClasses : parentClasses,
        indent,
      })
    }

    lineOffset += line.length + 1
  }

  return matches
}

export function collectStyleClassMatches(sourceText: string, filePath: string) {
  const extension = path.extname(filePath).toLowerCase()
  const matches = extension === '.sass' || extension === '.styl' || extension === '.stylus'
    ? collectIndentedSassMatches(sourceText, filePath)
    : collectBraceSyntaxMatches(sourceText, filePath)
  const uniqueMatches = new Map<string, StyleClassMatch>()

  for (const match of matches) {
    uniqueMatches.set(`${match.className}:${match.offset}`, match)
  }

  return [...uniqueMatches.values()]
}
