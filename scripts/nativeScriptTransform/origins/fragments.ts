import type * as t from '@babel/types'
import type { DirectiveOwner, InlineOriginArgumentToken, InlineOriginFragment, OriginNode } from './types'
import { decodedMappings, TraceMap } from '@jridgewell/trace-mapping'
import { generate } from '@weapp-vite/ast/babel'

const GENERATE_OPTIONS = {
  compact: true,
  jsescOption: { quotes: 'single' as const, minimal: true },
}

interface Mapping {
  generatedLine: number
  generatedColumn: number
}

function isLineBreak(code: number | undefined) {
  return code === 0x0A || code === 0x0D || code === 0x2028 || code === 0x2029
}

function position(source: string, offset: number) {
  let line = 0
  let column = 0
  for (let index = 0; index < offset;) {
    const code = source.codePointAt(index)
    const width = code === undefined ? 0 : code > 0xFFFF ? 2 : 1
    if (code === 0x0D) {
      line++
      column = 0
      index += 1
      if (source.charCodeAt(index) === 0x0A) {
        index++
      }
      continue
    }
    if (isLineBreak(code)) {
      line++
      column = 0
    }
    else {
      column += width
    }
    index += width
  }
  return { line, column }
}

function offset(source: string, line: number, column: number) {
  let currentLine = 0
  let currentColumn = 0
  for (let index = 0; index < source.length;) {
    if (currentLine === line && currentColumn === column) {
      return index
    }
    const code = source.codePointAt(index)
    const width = code === undefined ? 0 : code > 0xFFFF ? 2 : 1
    if (code === 0x0D) {
      currentLine++
      currentColumn = 0
      index += 1
      if (source.charCodeAt(index) === 0x0A) {
        index++
      }
      continue
    }
    if (isLineBreak(code)) {
      currentLine++
      currentColumn = 0
    }
    else {
      currentColumn += width
    }
    index += width
  }
  return currentLine === line && currentColumn === column ? source.length : undefined
}

function primitive(node: t.Node): node is t.StringLiteral | t.NumericLiteral | t.BooleanLiteral | t.NullLiteral {
  return node.type === 'StringLiteral' || node.type === 'NumericLiteral'
    || node.type === 'BooleanLiteral' || node.type === 'NullLiteral'
}

/** 在原地改写前复制直接 primitive 参数的位置与原文；复杂参数只保留既有 callee 证据。 */
export function argumentTokens(owner: DirectiveOwner, original: OriginNode): readonly InlineOriginArgumentToken[] | undefined {
  const expression = original as unknown as t.Expression
  if (owner.inlineSource !== owner.expression.text || expression.type !== 'CallExpression'
    || original.optional || expression.callee.type !== 'Identifier'
    || !Array.isArray(expression.arguments) || !expression.arguments.length
    || typeof expression.callee.end !== 'number') {
    return undefined
  }
  const output: InlineOriginArgumentToken[] = []
  let boundary = expression.callee.end - 1
  for (const [index, argument] of expression.arguments.entries()) {
    const start = argument.start
    const end = argument.end
    if (!primitive(argument) || typeof start !== 'number' || typeof end !== 'number'
      || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)
      || start < 1 || end <= start || end > owner.inlineSource.length + 1
      || owner.inlineSource.slice(boundary, start - 1).trim() !== (index ? ',' : '(')) {
      return undefined
    }
    const text = owner.inlineSource.slice(start - 1, end - 1)
    output.push(Object.freeze({ start, end, text, type: argument.type, value: argument.type === 'NullLiteral' ? null : argument.value }))
    boundary = end - 1
  }
  // 类型包装等语法已被现有解析器抹去，须用相邻原文拒绝将其伪装成直接 literal。
  return owner.inlineSource.slice(boundary).trim() === ')' ? Object.freeze(output) : undefined
}

function mappingFor(decoded: ReturnType<typeof decodedMappings>, line: number, column: number): Mapping | undefined {
  const matches: Mapping[] = []
  for (let generatedLine = 0; generatedLine < decoded.length; generatedLine++) {
    for (const segment of decoded[generatedLine] ?? []) {
      if (segment.length >= 4 && segment[1] === 0 && segment[2] === line && segment[3] === column) {
        matches.push({ generatedLine, generatedColumn: segment[0] })
      }
    }
  }
  return matches.length === 1 ? matches[0] : undefined
}

/**
 * 只从 Babel 一次生成的 source map 读取稳定叶子 token；不搜索输出文本，也不把 AST 往返到 Rust。
 */
export function argumentFragments(
  owner: DirectiveOwner,
  tokens: readonly InlineOriginArgumentToken[],
  generated: OriginNode,
  generatedSource: string,
): InlineOriginFragment[] | undefined {
  const generatedExpression = generated as unknown as t.Expression
  if (!tokens.length || generatedExpression.type !== 'CallExpression'
    || !Array.isArray(generatedExpression.arguments)
    || generatedExpression.arguments.length !== tokens.length
    || !generatedExpression.arguments.every((argument, index) => primitive(argument)
      && argument.type === tokens[index]!.type
      && Object.is(argument.type === 'NullLiteral' ? null : argument.value, tokens[index]!.value))) {
    return undefined
  }
  const input = `(${owner.inlineSource})`
  const result = generate(generatedExpression, {
    ...GENERATE_OPTIONS,
    sourceMaps: true,
    sourceFileName: 'inline.ts',
  }, input)
  if (result.code !== generatedSource || !result.map) {
    return undefined
  }
  const decoded = decodedMappings(new TraceMap(result.map))
  const output: InlineOriginFragment[] = []
  let previousEnd = -1
  for (const [index, item] of tokens.entries()) {
    const nodeStart = item.start
    const nodeEnd = item.end
    const localStart = nodeStart - 1
    const localEnd = nodeEnd - 1
    const sourceStart = owner.expression.start + localStart
    const sourceEnd = owner.expression.start + localEnd
    const sourceText = owner.template.source.content.slice(sourceStart, sourceEnd)
    if (!sourceText || sourceText !== item.text || sourceStart < owner.expression.start || sourceEnd > owner.expression.end) {
      return undefined
    }
    const startPosition = position(input, nodeStart)
    const start = mappingFor(decoded, startPosition.line, startPosition.column)
    if (!start) {
      return undefined
    }
    const generatedStart = offset(result.code, start.generatedLine, start.generatedColumn)
    if (generatedStart === undefined) {
      return undefined
    }
    // Babel 的 token map 通常只为 token 起点发 segment；结束点可能没有独立 segment。
    // 只有整段输出仍逐 UTF-16 单元等于原 token 时，才按已证明的原文长度确定终点。
    const generatedEnd = generatedStart + sourceText.length
    const generatedText = result.code.slice(generatedStart, generatedEnd)
    if (generatedText !== sourceText || generatedStart <= previousEnd
      || result.code[generatedStart - 1] !== (index ? ',' : '(')
      || result.code[generatedEnd] !== (index === tokens.length - 1 ? ')' : ',')) {
      return undefined
    }
    previousEnd = generatedEnd
    output.push({
      kind: 'inline-handler-argument-literal',
      role: 'copied',
      generated: { start: generatedStart, end: generatedEnd, text: generatedText },
      source: { start: sourceStart, end: sourceEnd, text: sourceText },
    })
  }
  return output
}
