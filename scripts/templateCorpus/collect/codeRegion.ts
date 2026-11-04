import assert from 'node:assert/strict'

export function throughRegion(source: string, start: number, ending: string): number {
  const end = source.indexOf(ending, start)
  assert.ok(end >= 0, `Unterminated container ${ending} region`)
  return end + ending.length
}

function regexpEnd(source: string, start: number): number {
  let characterClass = false
  for (let index = start + 1; index < source.length; index++) {
    const character = source[index]
    if (character === '\\') {
      index++
    }
    else if (character === '[') {
      characterClass = true
    }
    else if (character === ']') {
      characterClass = false
    }
    else if (character === '/' && !characterClass) {
      while (/[a-z]/i.test(source[index + 1] ?? '')) {
        index++
      }
      return index + 1
    }
    else if (character === '\n' || character === '\r') {
      break
    }
  }
  throw new Error('Unterminated container regular expression')
}

export interface CodeToken {
  end: number
  canStartRegexp: boolean
}

const codeRegions = {
  token(source: string, start: number, canStartRegexp: boolean, allowRegexp = true): CodeToken {
    const character = source[start]!
    if (/\s/.test(character)) {
      return { end: start + 1, canStartRegexp }
    }
    if (character === '"' || character === '\'' || character === '`') {
      return { end: this.quote(source, start), canStartRegexp: false }
    }
    if (source.startsWith('/*', start)) {
      return { end: throughRegion(source, start + 2, '*/'), canStartRegexp }
    }
    if (allowRegexp && source.startsWith('//', start)) {
      const end = source.indexOf('\n', start + 2)
      return { end: end < 0 ? source.length : end, canStartRegexp }
    }
    if (character === '/' && canStartRegexp && allowRegexp) {
      return { end: regexpEnd(source, start), canStartRegexp: false }
    }
    if (/[\w$]/.test(character)) {
      let end = start + 1
      while (/[\w$]/.test(source[end] ?? '')) {
        end++
      }
      return { end, canStartRegexp: /^(?:return|throw|case|delete|void|typeof|in|of|yield|await|new|instanceof|else|do)$/.test(source.slice(start, end)) }
    }
    if (source.startsWith('++', start) || source.startsWith('--', start)) {
      return { end: start + 2, canStartRegexp }
    }
    return { end: start + 1, canStartRegexp: /[([{=;:,?!~+\-*/%&|^<>]/.test(character) }
  },
  quote(source: string, start: number): number {
    const quote = source[start]
    for (let index = start + 1; index < source.length; index++) {
      if (source[index] === '\\') {
        index++
      }
      else if (source[index] === quote) {
        return index + 1
      }
      else if (quote === '`' && source.startsWith('${', index)) {
        index = this.braces(source, index + 2) - 1
      }
    }
    throw new Error('Unterminated container string')
  },
  braces(source: string, start: number): number {
    let depth = 0
    let canStartRegexp = true
    for (let index = start; index < source.length;) {
      if (source[index] === '{') {
        depth++
      }
      else if (source[index] === '}') {
        if (depth === 0) {
          return index + 1
        }
        depth--
      }
      const token = this.token(source, index, canStartRegexp)
      index = token.end
      canStartRegexp = token.canStartRegexp
    }
    throw new Error('Unterminated container template string expression')
  },
}

/** 词法定位仅用于容器边界，保留原文而不执行上游脚本。 */
export function codeToken(source: string, start: number, canStartRegexp: boolean, allowRegexp = true): CodeToken {
  return codeRegions.token(source, start, canStartRegexp, allowRegexp)
}

export function quotedEnd(source: string, start: number): number {
  return codeRegions.quote(source, start)
}

export function expressionEnd(source: string, start: number): number {
  let depth = 0
  let canStartRegexp = true
  for (let index = start + 2; index < source.length;) {
    if (source[index] === '{') {
      depth++
    }
    else if (source[index] === '}') {
      if (depth === 0 && source[index + 1] === '}') {
        return index + 2
      }
      depth--
      assert.ok(depth >= 0, 'Unbalanced container expression')
    }
    const token = codeToken(source, index, canStartRegexp)
    index = token.end
    canStartRegexp = token.canStartRegexp
  }
  throw new Error('Unterminated container expression')
}
