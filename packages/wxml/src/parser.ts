import type { Document, ParseOptions } from './types'
import { parseContext } from './documentContext'
import { compatibilityContext } from './options'

/** 使用兼容平台选项建立保留完整源码的文档，核心扫描不承担平台归一化。 */
export function parse(source: string, options: ParseOptions = {}): Document {
  return parseContext(source, compatibilityContext(options))
}
