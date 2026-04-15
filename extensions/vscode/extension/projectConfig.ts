export interface WeappGenerateConfigSnapshot {
  filenames: Partial<Record<'component' | 'page', string>>
  dirs: Partial<Record<'component' | 'page', string>>
  srcRoot?: string
}

function skipTrivia(sourceText: string, start: number) {
  let index = start

  while (index < sourceText.length) {
    const char = sourceText[index]
    const nextChar = sourceText[index + 1]

    if (char === ' ' || char === '\t' || char === '\r' || char === '\n') {
      index += 1
      continue
    }

    if (char === '/' && nextChar === '/') {
      index += 2

      while (index < sourceText.length && sourceText[index] !== '\n') {
        index += 1
      }

      continue
    }

    if (char === '/' && nextChar === '*') {
      index += 2

      while (index < sourceText.length - 1) {
        if (sourceText[index] === '*' && sourceText[index + 1] === '/') {
          index += 2
          break
        }

        index += 1
      }

      continue
    }

    break
  }

  return index
}

function findMatchingToken(sourceText: string, start: number, openToken: string, closeToken: string) {
  let depth = 0
  let index = start

  while (index < sourceText.length) {
    const char = sourceText[index]
    const nextChar = sourceText[index + 1]

    if (char === '\'' || char === '"' || char === '`') {
      const quote = char
      index += 1

      while (index < sourceText.length) {
        if (sourceText[index] === '\\') {
          index += 2
          continue
        }

        if (sourceText[index] === quote) {
          index += 1
          break
        }

        index += 1
      }

      continue
    }

    if (char === '/' && nextChar === '/') {
      index += 2

      while (index < sourceText.length && sourceText[index] !== '\n') {
        index += 1
      }

      continue
    }

    if (char === '/' && nextChar === '*') {
      index += 2

      while (index < sourceText.length - 1) {
        if (sourceText[index] === '*' && sourceText[index + 1] === '/') {
          index += 2
          break
        }

        index += 1
      }

      continue
    }

    if (char === openToken) {
      depth += 1
    }
    else if (char === closeToken) {
      depth -= 1

      if (depth === 0) {
        return index
      }
    }

    index += 1
  }

  return -1
}

function findTopLevelPropertyValueRange(sourceText: string, objectStart: number, propertyName: string) {
  const objectEnd = findMatchingToken(sourceText, objectStart, '{', '}')

  if (objectEnd < 0) {
    return null
  }

  let depth = 0
  let index = objectStart + 1

  while (index < objectEnd) {
    const char = sourceText[index]
    const nextChar = sourceText[index + 1]

    if (char === '\'' || char === '"' || char === '`') {
      const quote = char
      const quoteStart = index
      index += 1

      while (index < objectEnd) {
        if (sourceText[index] === '\\') {
          index += 2
          continue
        }

        if (sourceText[index] === quote) {
          index += 1
          break
        }

        index += 1
      }

      if (depth === 0 && quote !== '`') {
        const keyText = sourceText.slice(quoteStart + 1, index - 1)
        const colonIndex = skipTrivia(sourceText, index)

        if (keyText === propertyName && sourceText[colonIndex] === ':') {
          const valueStart = skipTrivia(sourceText, colonIndex + 1)
          return {
            end: objectEnd,
            start: valueStart,
          }
        }
      }

      continue
    }

    if (char === '/' && nextChar === '/') {
      index += 2

      while (index < objectEnd && sourceText[index] !== '\n') {
        index += 1
      }

      continue
    }

    if (char === '/' && nextChar === '*') {
      index += 2

      while (index < objectEnd - 1) {
        if (sourceText[index] === '*' && sourceText[index + 1] === '/') {
          index += 2
          break
        }

        index += 1
      }

      continue
    }

    if (char === '{' || char === '[' || char === '(') {
      depth += 1
      index += 1
      continue
    }

    if (char === '}' || char === ']' || char === ')') {
      depth -= 1
      index += 1
      continue
    }

    if (depth === 0 && /[$\w]/u.test(char)) {
      const keyStart = index
      index += 1

      while (index < objectEnd && /[$\w]/u.test(sourceText[index])) {
        index += 1
      }

      const keyText = sourceText.slice(keyStart, index)
      const colonIndex = skipTrivia(sourceText, index)

      if (keyText === propertyName && sourceText[colonIndex] === ':') {
        const valueStart = skipTrivia(sourceText, colonIndex + 1)
        return {
          end: objectEnd,
          start: valueStart,
        }
      }

      continue
    }

    index += 1
  }

  return null
}

function readStringLiteralAt(sourceText: string, start: number) {
  const quote = sourceText[start]

  if (quote !== '\'' && quote !== '"') {
    return null
  }

  let index = start + 1
  let value = ''

  while (index < sourceText.length) {
    const char = sourceText[index]

    if (char === '\\') {
      const escaped = sourceText[index + 1]

      if (escaped == null) {
        return null
      }

      value += escaped
      index += 2
      continue
    }

    if (char === quote) {
      return value
    }

    value += char
    index += 1
  }

  return null
}

function findReturnedObjectLiteral(sourceText: string, bodyStart: number) {
  const bodyEnd = findMatchingToken(sourceText, bodyStart, '{', '}')

  if (bodyEnd < 0) {
    return null
  }

  const returnIndex = sourceText.indexOf('return', bodyStart + 1)

  if (returnIndex < 0 || returnIndex >= bodyEnd) {
    return null
  }

  const objectStart = sourceText.indexOf('{', returnIndex + 'return'.length)

  if (objectStart < 0 || objectStart >= bodyEnd) {
    return null
  }

  return objectStart
}

function findExportObjectStart(sourceText: string) {
  const exportIndex = sourceText.indexOf('export default')

  if (exportIndex < 0) {
    return null
  }

  let expressionStart = skipTrivia(sourceText, exportIndex + 'export default'.length)

  if (sourceText[expressionStart] === '{') {
    return expressionStart
  }

  if (!sourceText.startsWith('defineConfig', expressionStart)) {
    return null
  }

  const callStart = sourceText.indexOf('(', expressionStart)

  if (callStart < 0) {
    return null
  }

  const argumentStart = skipTrivia(sourceText, callStart + 1)

  if (sourceText[argumentStart] === '{') {
    return argumentStart
  }

  if (sourceText[argumentStart] === '(') {
    const arrowIndex = sourceText.indexOf('=>', argumentStart)

    if (arrowIndex < 0) {
      return null
    }

    expressionStart = skipTrivia(sourceText, arrowIndex + 2)

    if (sourceText[expressionStart] === '(') {
      const objectStart = skipTrivia(sourceText, expressionStart + 1)
      return sourceText[objectStart] === '{' ? objectStart : null
    }

    if (sourceText[expressionStart] === '{') {
      return findReturnedObjectLiteral(sourceText, expressionStart)
    }
  }

  return null
}

function readStringMap(sourceText: string, objectStart: number | null, keys: Array<'component' | 'page'>) {
  const result: Partial<Record<'component' | 'page', string>> = {}

  if (objectStart == null) {
    return result
  }

  for (const key of keys) {
    const valueRange = findTopLevelPropertyValueRange(sourceText, objectStart, key)

    if (!valueRange) {
      continue
    }

    const value = readStringLiteralAt(sourceText, valueRange.start)

    if (value) {
      result[key] = value
    }
  }

  return result
}

export function readWeappGenerateConfigSnapshot(sourceText: string) {
  const exportObjectStart = findExportObjectStart(sourceText)

  if (exportObjectStart == null) {
    return null
  }

  const weappValueRange = findTopLevelPropertyValueRange(sourceText, exportObjectStart, 'weapp')

  if (!weappValueRange || sourceText[weappValueRange.start] !== '{') {
    return null
  }

  const generateValueRange = findTopLevelPropertyValueRange(sourceText, weappValueRange.start, 'generate')
  const dirsValueRange = generateValueRange && sourceText[generateValueRange.start] === '{'
    ? findTopLevelPropertyValueRange(sourceText, generateValueRange.start, 'dirs')
    : null
  const filenamesValueRange = generateValueRange && sourceText[generateValueRange.start] === '{'
    ? findTopLevelPropertyValueRange(sourceText, generateValueRange.start, 'filenames')
    : null
  const srcRootValueRange = findTopLevelPropertyValueRange(sourceText, weappValueRange.start, 'srcRoot')

  return {
    srcRoot: srcRootValueRange ? readStringLiteralAt(sourceText, srcRootValueRange.start) ?? undefined : undefined,
    dirs: readStringMap(sourceText, dirsValueRange?.start ?? null, ['component', 'page']),
    filenames: readStringMap(sourceText, filenamesValueRange?.start ?? null, ['component', 'page']),
  } satisfies WeappGenerateConfigSnapshot
}
