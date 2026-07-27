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
}

const DIRECTIVE_RE = /^\s*(?:(?:\/\/|\/\*+|<!--)\s*)?#(ifdef|ifndef|else|endif)\b(.*)$/
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
  const names = normalized.split('||').map(item => item.trim()).filter(Boolean)
  if (!names.length || names.some(name => !/^[A-Z][A-Z0-9_-]*$/.test(name))) {
    throw new Error(`[uni-app] ${filename}:${line} 包含无效的条件表达式 "${normalized}"`)
  }
  return names.some(name => defines.has(name))
}

/**
 * 按目标平台移除 uni-app 条件编译分支，并保留原始换行以稳定错误位置。
 */
export function transformUniAppConditionalCode(
  source: string,
  options: TransformUniAppSourceOptions,
) {
  const defines = new Set(options.target === 'h5' ? ['H5'] : ['MP-WEIXIN'])
  const frames: ConditionalFrame[] = []
  let active = true
  let changed = false
  let line = 0

  const code = source.replace(/[^\n]*(?:\n|$)/g, (chunk) => {
    if (!chunk) {
      return chunk
    }
    line += 1
    const newline = chunk.endsWith('\n') ? '\n' : ''
    const content = newline ? chunk.slice(0, -1) : chunk
    const match = content.match(DIRECTIVE_RE)
    if (!match) {
      return active ? chunk : newline
    }

    changed = true
    const directive = match[1]
    if (directive === 'ifdef' || directive === 'ifndef') {
      const condition = evaluateCondition(match[2], defines, options.filename, line)
      frames.push({ condition, elseSeen: false, parentActive: active })
      active = active && (directive === 'ifdef' ? condition : !condition)
      return newline
    }

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
      return newline
    }

    frames.pop()
    active = frame.parentActive
    return newline
  })

  if (frames.length) {
    throw new Error(`[uni-app] ${options.filename} 存在未闭合的条件编译块`)
  }
  return { changed, code }
}

function analyzeScript(source: string, filename: string): ScriptAnalysis {
  if (!source.trim()) {
    return { source, importSources: [], importEnd: 0, usesFreeUni: false }
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
  })

  return { source, importSources, importEnd, usesFreeUni }
}

function renderScript(analysis: ScriptAnalysis, injectUni: boolean) {
  const output = new MagicString(analysis.source)
  for (const source of analysis.importSources) {
    output.overwrite(source.start, source.end, JSON.stringify(source.replacement))
  }
  if (injectUni) {
    const insertion = analysis.importEnd > 0 ? analysis.importEnd : 0
    output.appendLeft(insertion, `${insertion > 0 ? '\n' : ''}const uni = wx\n`)
  }
  return output.toString()
}

function transformVueSfc(source: string, filename: string) {
  const { descriptor, errors } = parseSfc(source, { filename })
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
  const output = new MagicString(source)

  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index]!
    const analysis = analyses[index]
    const code = renderScript(analysis, index === injectIndex)
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
    const code = transformVueSfc(conditional.code, filename)
    return { changed: conditional.changed || code !== source, code }
  }
  if (blockType === 'script') {
    const analysis = analyzeScript(conditional.code, filename)
    const code = renderScript(analysis, analysis.usesFreeUni)
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
