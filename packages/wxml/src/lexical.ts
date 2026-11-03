import type { InterpolationRecovery } from './types'

const lineEndPattern = /[\n\r\u2028\u2029]/g

/** JS 行注释在任意行终止符处结束；正则只定位下一处，不逐字符分配结果。 */
export function findLineEnd(source: string, start: number) {
  lineEndPattern.lastIndex = start
  return lineEndPattern.exec(source)?.index ?? -1
}

/** 词法错误携带原文偏移，由调用方选择报告或抛出。 */
export class TemplateLexicalError extends Error {
  constructor(public readonly offset: number, message: string, public readonly recovery?: InterpolationRecovery) {
    super(message)
  }
}

export function isSpaceCode(code: number) {
  if (code <= 32) {
    return code === 32 || (code >= 9 && code <= 13)
  }
  return code >= 0xA0 && (code === 0xA0 || code === 0x1680 || (code >= 0x2000 && code <= 0x200A) || code === 0x2028 || code === 0x2029 || code === 0x202F || code === 0x205F || code === 0x3000 || code === 0xFEFF)
}

export function isWordCode(code: number) {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 95 || code === 36 || code >= 128
}

export function isNameCode(code: number) {
  return isWordCode(code) || code === 58 || code === 46 || code === 45
}

export function isTagStartCode(code: number) {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95
}

export function skipSpace(source: string, start: number) {
  while (isSpaceCode(source.charCodeAt(start))) {
    start++
  }
  return start
}
