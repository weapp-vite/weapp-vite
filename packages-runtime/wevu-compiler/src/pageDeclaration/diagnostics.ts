import type { Node } from '@weapp-vite/ast/babelTypes'
import type { PageDeclarationScriptBlock } from './types'

interface SourceLocation {
  column: number
  line: number
}

function resolveSourceLocation(source: string, offset: number): SourceLocation {
  let line = 1
  let lineStart = 0
  const end = Math.min(Math.max(offset, 0), source.length)
  for (let index = 0; index < end; index += 1) {
    const char = source.charCodeAt(index)
    if (char === 10 || char === 0x2028 || char === 0x2029) {
      line += 1
      lineStart = index + 1
    }
    else if (char === 13) {
      line += 1
      if (source.charCodeAt(index + 1) === 10) {
        index += 1
      }
      lineStart = index + 1
    }
  }
  return { line, column: end - lineStart + 1 }
}

export function getAbsoluteOffset(
  block: PageDeclarationScriptBlock,
  node: Pick<Node, 'start'> | undefined,
) {
  return block.offset + (typeof node?.start === 'number' ? node.start : 0)
}

export function createPageDeclarationError(
  block: PageDeclarationScriptBlock,
  node: Pick<Node, 'start'> | undefined,
  message: string,
) {
  const location = resolveSourceLocation(block.source, getAbsoluteOffset(block, node))
  return new Error(`${block.filename}:${location.line}:${location.column} ${message}`)
}

export function createPageDeclarationParseError(
  block: PageDeclarationScriptBlock,
  error: unknown,
) {
  const parseError = error instanceof Error ? error : new Error(String(error))
  const offset = 'pos' in parseError && typeof parseError.pos === 'number' ? parseError.pos : 0
  const location = resolveSourceLocation(block.source, block.offset + offset)
  return new Error(`${block.filename}:${location.line}:${location.column} 解析页面声明失败：${parseError.message}`)
}
