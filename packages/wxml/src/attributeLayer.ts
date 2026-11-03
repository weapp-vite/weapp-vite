import { TemplateLexicalError } from './lexical'

interface AttributeSource {
  source: string
  start: number
  end: number
  origin: number
  escapes?: number[]
}

/** 宿主属性层只移除每对反斜杠与后续字符中的第一字符，不解释 JS 转义。 */
export function decodeLegacyAttributeLayer(value: string) {
  return value.replace(/\\([\s\S])/g, '$1')
}

/** 外层引号是否结束属性只由宿主层的连续反斜杠奇偶决定。 */
export function legacyAttributeEnd(source: string, start: number, quote: string) {
  let end = source.indexOf(quote, start)
  while (end >= 0) {
    let previous = end - 1
    while (previous >= start && source.charCodeAt(previous) === 92) {
      previous--
    }
    if ((end - previous) % 2 !== 0) {
      return end
    }
    end = source.indexOf(quote, end + 1)
  }
  return -1
}

/** 无转义不建立偏移表；有转义时只记录被移除字符的逻辑偏移。 */
export function legacyAttributeSource(source: string, start: number, end: number): AttributeSource {
  const content = source.slice(start, end)
  if (!content.includes('\\')) {
    return { source: content, start: 0, end: content.length, origin: start }
  }
  const escapes: number[] = []
  const value = content.replace(/\\([\s\S])/g, (_match, character: string, offset: number) => {
    escapes.push(offset - escapes.length)
    return character
  })
  return { source: value, start: 0, end: value.length, origin: start, escapes }
}

/** 逻辑字符仍映射到包含宿主层反斜杠的原始 UTF-16 位置。 */
export function attributeSourcePosition(view: AttributeSource, offset: number) {
  const escapes = view.escapes
  let lower = 0
  let upper = escapes?.length ?? 0
  while (lower < upper) {
    const middle = (lower + upper) >>> 1
    if (escapes![middle]! < offset) {
      lower = middle + 1
    }
    else {
      upper = middle
    }
  }
  return view.origin + offset + lower
}

/** 诊断和可恢复插值范围始终引用原始源码，而非解码后的临时视图。 */
export function attributeSourceError(view: AttributeSource, error: unknown): never {
  if (error instanceof TemplateLexicalError) {
    const recovery = error.recovery
    throw new TemplateLexicalError(attributeSourcePosition(view, error.offset), error.message, recovery && {
      kind: recovery.kind,
      start: attributeSourcePosition(view, recovery.start),
      end: attributeSourcePosition(view, recovery.end),
    })
  }
  throw error
}
