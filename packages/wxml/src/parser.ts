import type { Document, ParseOptions } from './types'
import { scanDocument } from './scanner'

/** 在一次扫描中建立保留完整原文与属性形式的模板文档。 */
export function parse(source: string, options: ParseOptions = {}): Document {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Expected a parse options object.')
  }
  const selectedPlatform = options.platform ?? 'weapp'
  const rawTags = options.rawTags
  const snapshot: ParseOptions = Object.freeze({
    platform: selectedPlatform,
    syntax: options.syntax ?? (selectedPlatform === 'weapp' ? 'legacy' : 'xml'),
    rawTags: Array.isArray(rawTags) ? Object.freeze(rawTags.slice()) : rawTags,
    resolveScriptBoundary: options.resolveScriptBoundary,
  })
  const { tokens, diagnostics, children, platform, syntax } = scanDocument(source, snapshot, true)
  return { source, platform, syntax, tokens, diagnostics, children, options: snapshot }
}
