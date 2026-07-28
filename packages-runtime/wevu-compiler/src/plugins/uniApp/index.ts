import * as t from '@weapp-vite/ast/babelTypes'
import MagicString from 'magic-string'
import path from 'pathe'
import { parse as parseSfc } from 'vue/compiler-sfc'
import { parse, traverse } from '../../utils/babel'

export type UniAppCompatibilityTarget = 'h5' | 'mp-weixin'

export interface TransformUniAppSourceOptions {
  blockType?: 'script' | 'sfc' | 'style' | 'template'
  filename: string
  target: UniAppCompatibilityTarget
}

interface ConditionalFrame {
  condition: boolean
  elseSeen: boolean
  parentActive: boolean
}

interface ScriptAnalysis {
  importSources: Array<{ end: number, replacement: string, start: number }>
  importEnd: number
  source: string
  usesFreeUni: boolean
  virtualHostTrueRanges: Array<{ end: number, start: number }>
}

const DIRECTIVE_TOKEN_RE = /\/\/\s*#(?:ifdef|ifndef|else|endif)\b[^\r\n]*|\/\*+\s*#(?:ifdef|ifndef|else|endif)\b[\s\S]*?\*\/|<!--\s*#(?:ifdef|ifndef|else|endif)\b[\s\S]*?-->/g
const SCRIPT_EXT_RE = /\.[cm]?[jt]sx?$/i
const STYLE_EXT_RE = /\.(?:css|less|sass|scss|styl|stylus)$/i
const UNI_APP_RUNTIME_MODULE = '@dcloudio/uni-app'

function resolveRuntimeImport(source: string) {
  if (source === 'vue' || source === UNI_APP_RUNTIME_MODULE) {
    return 'wevu'
  }
  return undefined
}

function evaluateCondition(expression: string, defines: ReadonlySet<string>, filename: string, line: number) {
  const normalized = expression.replace(/(?:\*\/|-->)\s*$/, '').trim()
  const tokens = normalized.match(/[A-Z][A-Z0-9_-]*|&&|\|\||[()!]/g) ?? []
  if (!tokens.length || tokens.join('') !== normalized.replace(/\s/g, '')) {
    throw new Error(`[uni-app] ${filename}:${line} 包含无效的条件表达式 "${normalized}"`)
  }
  let index = 0
  const parser = {
    parseAnd(): boolean {
      let value = parser.parsePrimary()
      while (tokens[index] === '&&') {
        index += 1
        const right = parser.parsePrimary()
        value = value && right
      }
      return value
    },
    parseOr(): boolean {
      let value = parser.parseAnd()
      while (tokens[index] === '||') {
        index += 1
        const right = parser.parseAnd()
        value = value || right
      }
      return value
    },
    parsePrimary(): boolean {
      const token = tokens[index]
      if (token === '!') {
        index += 1
        return !parser.parsePrimary()
      }
      if (token === '(') {
        index += 1
        const value = parser.parseOr()
        if (tokens[index] !== ')') {
          throw new Error(`[uni-app] ${filename}:${line} 包含无效的条件表达式 "${normalized}"`)
        }
        index += 1
        return value
      }
      if (!token || !/^[A-Z][A-Z0-9_-]*$/.test(token)) {
        throw new Error(`[uni-app] ${filename}:${line} 包含无效的条件表达式 "${normalized}"`)
      }
      index += 1
      return defines.has(token)
    },
  }
  const value = parser.parseOr()
  if (index !== tokens.length) {
    throw new Error(`[uni-app] ${filename}:${line} 包含无效的条件表达式 "${normalized}"`)
  }
  return value
}

/**
 * 按目标平台移除 uni-app 条件编译分支，并保留原始换行以稳定错误位置。
 */
export function transformUniAppConditionalCode(
  source: string,
  options: TransformUniAppSourceOptions,
) {
  const defines = new Set(options.target === 'h5' ? ['H5', 'VUE3'] : ['MP', 'MP-WEIXIN', 'VUE3'])
  const frames: ConditionalFrame[] = []
  let active = true
  let changed = false
  let cursor = 0
  let line = 1
  let code = ''
  for (const match of source.matchAll(DIRECTIVE_TOKEN_RE)) {
    const offset = match.index
    const segment = source.slice(cursor, offset)
    code += active ? segment : segment.replace(/[^\r\n]/g, '')
    line += segment.split('\n').length - 1
    const directiveSource = match[0].slice(match[0].indexOf('#'))
    const directiveMatch = directiveSource.match(/^#(ifdef|ifndef|else|endif)\b/)
    if (!directiveMatch) {
      continue
    }
    changed = true
    const directive = directiveMatch[1]
    if (directive === 'ifdef' || directive === 'ifndef') {
      const expression = directiveSource.slice(directiveMatch[0].length)
      const condition = evaluateCondition(expression, defines, options.filename, line)
      frames.push({ condition, elseSeen: false, parentActive: active })
      active = active && (directive === 'ifdef' ? condition : !condition)
    }
    else {
      const frame = frames[frames.length - 1]
      if (!frame) {
        throw new Error(`[uni-app] ${options.filename}:${line} 存在未配对的 #${directive}`)
      }
      if (directive === 'else') {
        if (frame.elseSeen) {
          throw new Error(`[uni-app] ${options.filename}:${line} 同一条件块不能出现多个 #else`)
        }
        frame.elseSeen = true
        active = frame.parentActive && !frame.condition
      }
      else {
        frames.pop()
        active = frame.parentActive
      }
    }
    code += match[0].replace(/[^\r\n]/g, '')
    line += match[0].split('\n').length - 1
    cursor = offset + match[0].length
  }
  const trailing = source.slice(cursor)
  code += active ? trailing : trailing.replace(/[^\r\n]/g, '')

  if (frames.length) {
    throw new Error(`[uni-app] ${options.filename} 存在未闭合的条件编译块`)
  }
  return { changed, code }
}

function normalizeAuxiliaryWxsScripts(source: string) {
  const wxsBlocks: string[] = []
  const withoutScripts = source.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (block, attributes: string, content: string) => {
    const src = attributes.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1]
    const moduleName = attributes.match(/\bmodule\s*=\s*["']([^"']+)["']/i)?.[1]
    const isWxs = /\blang\s*=\s*["']wxs["']/i.test(attributes) || src?.endsWith('.wxs')
    if (!isWxs || !moduleName) {
      return block
    }
    wxsBlocks.push(src
      ? `<wxs module="${moduleName}" src="${src}" />`
      : `<wxs module="${moduleName}">${content}</wxs>`)
    return block.replace(/[^\r\n]/g, '')
  })
  if (!wxsBlocks.length) {
    return source
  }
  return withoutScripts.replace(/<template\b[^>]*>/i, match => `${match}\n${wxsBlocks.join('\n')}`)
}

function analyzeScript(source: string, filename: string): ScriptAnalysis {
  if (!source.trim()) {
    return { source, importSources: [], importEnd: 0, usesFreeUni: false, virtualHostTrueRanges: [] }
  }
  const isJsx = /\.[cm]?[jt]sx$/i.test(filename)
  const ast = parse(source, {
    sourceType: 'module',
    plugins: [
      'typescript',
      'decorators-legacy',
      ...(isJsx ? ['jsx' as const] : []),
    ],
  })
  const importSources: Array<{ end: number, replacement: string, start: number }> = []
  let importEnd = 0
  let usesFreeUni = false
  const virtualHostTrueRanges: Array<{ end: number, start: number }> = []

  traverse(ast, {
    ImportDeclaration(path: any) {
      const sourceNode = path.node.source
      if (typeof path.node.end === 'number') {
        importEnd = Math.max(importEnd, path.node.end)
      }
      const replacement = t.isStringLiteral(sourceNode) ? resolveRuntimeImport(sourceNode.value) : undefined
      if (replacement) {
        importSources.push({ start: sourceNode.start!, end: sourceNode.end!, replacement })
      }
    },
    ExportAllDeclaration(path: any) {
      const sourceNode = path.node.source
      const replacement = t.isStringLiteral(sourceNode) ? resolveRuntimeImport(sourceNode.value) : undefined
      if (replacement) {
        importSources.push({ start: sourceNode.start!, end: sourceNode.end!, replacement })
      }
    },
    ExportNamedDeclaration(path: any) {
      const sourceNode = path.node.source
      const replacement = t.isStringLiteral(sourceNode) ? resolveRuntimeImport(sourceNode.value) : undefined
      if (replacement) {
        importSources.push({ start: sourceNode.start!, end: sourceNode.end!, replacement })
      }
    },
    ReferencedIdentifier(path: any) {
      if (path.node.name === 'uni' && !path.scope.hasBinding('uni')) {
        usesFreeUni = true
      }
    },
    ObjectProperty(path: any) {
      const key = path.node.key
      const isVirtualHost = !path.node.computed && (
        t.isIdentifier(key, { name: 'virtualHost' })
        || t.isStringLiteral(key, { value: 'virtualHost' })
      )
      if (
        !isVirtualHost
        || !t.isBooleanLiteral(path.node.value, { value: true })
        || !path.parentPath?.isObjectExpression()
      ) {
        return
      }
      const optionsProperty = path.parentPath.parentPath
      if (
        !optionsProperty?.isObjectProperty()
        || optionsProperty.node.computed
        || !(
          t.isIdentifier(optionsProperty.node.key, { name: 'options' })
          || t.isStringLiteral(optionsProperty.node.key, { value: 'options' })
        )
      ) {
        return
      }
      const { start, end } = path.node.value
      if (typeof start === 'number' && typeof end === 'number') {
        virtualHostTrueRanges.push({ start, end })
      }
    },
  })

  return { source, importSources, importEnd, usesFreeUni, virtualHostTrueRanges }
}

function renderScript(analysis: ScriptAnalysis, injectUni: boolean, disableVirtualHost: boolean) {
  const output = new MagicString(analysis.source)
  for (const source of analysis.importSources) {
    output.overwrite(source.start, source.end, JSON.stringify(source.replacement))
  }
  if (injectUni) {
    const insertion = analysis.importEnd > 0 ? analysis.importEnd : 0
    output.prepend(`import { createUniAppHost as __wevuCreateUniAppHost } from 'wevu/internal-runtime'\n`)
    output.appendLeft(insertion, `${insertion > 0 ? '\n' : ''}const uni = __wevuCreateUniAppHost(wx)\n`)
  }
  if (disableVirtualHost) {
    for (const range of analysis.virtualHostTrueRanges) {
      output.overwrite(range.start, range.end, 'false')
    }
  }
  return output.toString()
}

function transformVueSfc(source: string, filename: string, target: UniAppCompatibilityTarget) {
  const normalizedSource = normalizeAuxiliaryWxsScripts(source)
  const { descriptor, errors } = parseSfc(normalizedSource, { filename })
  if (errors.length) {
    const error = errors[0]
    throw new Error(`[uni-app] 解析 ${filename} 失败：${error.message}`)
  }

  const blocks = [descriptor.script, descriptor.scriptSetup].filter(Boolean)
  const analyses = blocks.map((block) => {
    const lang = block!.lang ?? 'js'
    return analyzeScript(block!.content, `${filename}.${lang}`)
  })
  const injectIndex = analyses.findIndex(analysis => analysis.usesFreeUni)
  const output = new MagicString(normalizedSource)

  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index]!
    const analysis = analyses[index]
    const code = renderScript(analysis, index === injectIndex, target === 'mp-weixin')
    output.overwrite(block.loc.start.offset, block.loc.end.offset, code)
  }
  return output.toString()
}

/**
 * 转换单个受控 uni-app 源文件；未命中语法时返回原文。
 */
export function transformUniAppSource(source: string, options: TransformUniAppSourceOptions) {
  const conditional = transformUniAppConditionalCode(source, options)
  const filename = options.filename.split('?', 1)[0]
  const blockType = options.blockType ?? (filename.endsWith('.vue')
    ? 'sfc'
    : SCRIPT_EXT_RE.test(filename)
      ? 'script'
      : STYLE_EXT_RE.test(filename)
        ? 'style'
        : undefined)
  if (blockType === 'sfc') {
    const code = transformVueSfc(conditional.code, filename, options.target)
    return { changed: conditional.changed || code !== source, code }
  }
  if (blockType === 'script') {
    const analysis = analyzeScript(conditional.code, filename)
    const code = renderScript(
      analysis,
      analysis.usesFreeUni,
      options.target === 'mp-weixin' && filename.endsWith('.vue'),
    )
    return { changed: conditional.changed || code !== source, code }
  }
  if (blockType === 'style' || blockType === 'template') {
    return conditional
  }
  return { changed: false, code: source }
}

/**
 * 判断文件是否属于项目源码或显式允许的 npm 包。
 */
export function isUniAppCompatibilityFile(
  filename: string,
  srcRoot: string,
  include: readonly string[],
) {
  const clean = filename.split('?', 1)[0]
  const relative = path.relative(srcRoot, clean)
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    return true
  }
  const normalized = clean.replace(/\\/g, '/')
  return include.some((packageName) => {
    const packagePath = packageName.replace(/^\/+|\/+$/g, '')
    return normalized.includes(`/node_modules/${packagePath}/`)
  })
}
