import type { CallExpression, File } from '@weapp-vite/ast/babelTypes'
import MagicString from 'magic-string'
import path from 'pathe'
import { parse, traverse } from '../utils/babel'
import { scanWxml } from '../wxml'

export interface TransformI18nTemplateOptions {
  assetFileName: string
  fileName: string
  functionName: string
  localeDataKey: string
  moduleName: string
}

function resolveAssetSource(fileName: string, assetFileName: string) {
  const relative = path.posix.relative(path.posix.dirname(fileName), assetFileName)
  return relative.startsWith('.') ? relative : `./${relative}`
}

function collectCallReplacements(
  expression: string,
  expressionOffset: number,
  options: TransformI18nTemplateOptions,
) {
  let ast: File
  try {
    ast = parse(`(${expression})`, { sourceType: 'module' }) as File
  }
  catch {
    return []
  }
  const calls: Array<{ start: number, end: number }> = []
  traverse(ast, {
    CallExpression(callPath) {
      const node = callPath.node as CallExpression
      if (node.callee.type !== 'Identifier' || node.callee.name !== options.functionName) {
        return
      }
      const start = (node.start ?? 1) - 1
      const end = (node.end ?? 1) - 1
      calls.push({ end, start })
    },
  })
  if (!calls.length) {
    return []
  }

  const renderSegment = (start: number, end: number): string => {
    const nestedCalls = calls
      .filter(call => call.start >= start && call.end <= end)
      .filter((call) => {
        return !calls.some(parent => parent !== call
          && parent.start >= start
          && parent.end <= end
          && parent.start <= call.start
          && parent.end >= call.end)
      })
      .sort((left, right) => left.start - right.start)
    let cursor = start
    let rendered = ''
    for (const call of nestedCalls) {
      rendered += expression.slice(cursor, call.start)
      const original = expression.slice(call.start, call.end)
      const openParen = original.indexOf('(')
      const argsStart = call.start + openParen + 1
      const args = openParen >= 0
        ? renderSegment(argsStart, call.end - 1).trim()
        : ''
      rendered += `${options.moduleName}.t(${options.localeDataKey}${args ? `, ${args}` : ''})`
      cursor = call.end
    }
    return rendered + expression.slice(cursor, end)
  }

  return [{
    start: expressionOffset,
    end: expressionOffset + expression.length,
    value: renderSegment(0, expression.length),
  }]
}

function collectMustacheRanges(source: string, start: number, end: number) {
  const ranges: Array<{ expressionEnd: number, expressionStart: number }> = []
  for (let cursor = start; cursor < end - 1;) {
    if (source[cursor] !== '{' || source[cursor + 1] !== '{') {
      cursor++
      continue
    }
    const expressionStart = cursor + 2
    let expressionEnd = expressionStart
    let braceDepth = 0
    let escaped = false
    let quote = ''
    for (; expressionEnd < end - 1; expressionEnd++) {
      const char = source[expressionEnd]
      if (quote) {
        if (escaped) {
          escaped = false
        }
        else if (char === '\\') {
          escaped = true
        }
        else if (char === quote) {
          quote = ''
        }
        continue
      }
      if (char === '\'' || char === '"' || char === '`') {
        quote = char
      }
      else if (char === '{') {
        braceDepth++
      }
      else if (char === '}' && braceDepth > 0) {
        braceDepth--
      }
      else if (char === '}' && source[expressionEnd + 1] === '}') {
        ranges.push({ expressionEnd, expressionStart })
        cursor = expressionEnd + 2
        break
      }
    }
    if (expressionEnd >= end - 1) {
      break
    }
  }
  return ranges
}

export function transformI18nTemplate(source: string, options: TransformI18nTemplateOptions) {
  const token = scanWxml(source, { platform: 'weapp' })
  const replacements: Array<{ start: number, end: number, value: string }> = []
  for (const templateToken of token.templateTokens ?? []) {
    for (const range of collectMustacheRanges(source, templateToken.start, templateToken.end)) {
      const expression = source.slice(range.expressionStart, range.expressionEnd)
      replacements.push(...collectCallReplacements(expression, range.expressionStart, options))
    }
  }
  if (!replacements.length) {
    return source
  }

  const conflict = token.scriptModules?.some((scriptModule) => {
    return scriptModule.attrs.module === options.moduleName
  })
  if (conflict) {
    throw new Error(`${options.fileName} 已存在 module=\"${options.moduleName}\" 的 WXS 模块，无法注入 i18n。`)
  }

  const ms = new MagicString(source)
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    ms.update(replacement.start, replacement.end, replacement.value)
  }
  const src = resolveAssetSource(options.fileName, options.assetFileName)
  return `<wxs module="${options.moduleName}" src="${src}"/>\n${ms.toString()}`
}
