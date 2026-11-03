export interface SourceRange {
  start: number
  end: number
}

/** 微信现行 WXML 转义与其他平台的 XML 属性边界不同。 */
export type WxmlSyntax = 'legacy' | 'xml'

export function failAt(code: string, fileName: string, offset: number, message: string): never {
  let line = 1
  let column = 1
  for (let i = 0; i < offset; i++) {
    if (code[i] === '\r' || code[i] === '\n') {
      if (code[i] === '\r' && code[i + 1] === '\n') {
        i++
      }
      line++
      column = 1
    }
    else {
      column++
    }
  }
  throw new Error(`[weapp.wxml] ${fileName}:${line}:${column}: ${message}`)
}
