import type { AstEngineName } from '../ast'
import { parseJsLikeWithEngine } from '@weapp-vite/ast'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse } from './babel'

interface ExportName {
  type: string
  name?: string
  value?: string
}

interface ExportSpecifier {
  type: string
  local?: ExportName
  exported?: ExportName
}

interface ExportNode {
  type: string
  source?: { type: string, value: string }
  specifiers?: ExportSpecifier[]
}

interface ReExportFacts {
  source: string
  named: Map<string, { source: string, imported: string }>
  exportAll: string[]
}

/** 仅缓存当前源码的导出事实，目标地址始终由本轮 resolver 决定。 */
export type ReExportResolutionCache = Map<string, ReExportFacts>

export interface ResolveReExportOptions {
  /**
   * 解析 `export ... from "source"` 的 source，返回可读取的文件路径（或任意可继续递归的 id）。
   */
  resolveId: (source: string, importer: string) => Promise<string | undefined>
  /**
   * 读取文件内容（由调用方决定缓存/mtime 策略）。
   */
  readFile: (file: string) => Promise<string>
  /**
   * 缓存当前源码的导出声明，不缓存递归目标或未解析的目标。
   */
  cache: ReExportResolutionCache
  /**
   * AST 引擎。
   * @default 'babel'
   */
  astEngine?: AstEngineName
  /**
   * 最大递归深度。
   * @default 4
   */
  maxDepth?: number
}

function getSpecifierName(name: ExportName | undefined) {
  if (name?.type === 'Identifier') {
    return name.name
  }
  if (name?.type === 'StringLiteral' || name?.type === 'Literal') {
    return name.value
  }
  return undefined
}

function getSourceValue(node: ExportNode) {
  const source = node?.source
  if (!source || (source.type !== 'StringLiteral' && source.type !== 'Literal')) {
    return undefined
  }
  return source.value
}

export function getReExportCacheKey(file: string, astEngine?: AstEngineName) {
  return `${astEngine ?? 'babel'}::${file}`
}

function parseModuleForReExport(code: string, astEngine?: AstEngineName) {
  if (astEngine === 'oxc') {
    return parseJsLikeWithEngine(code, {
      engine: 'oxc',
      filename: 'inline.ts',
    })
  }
  return babelParse(code, BABEL_TS_MODULE_PARSER_OPTIONS).program
}

async function readReExportFacts(exporterFile: string, options: ResolveReExportOptions) {
  const cacheKey = getReExportCacheKey(exporterFile, options.astEngine)
  let source: string
  try {
    source = await options.readFile(exporterFile)
  }
  catch {
    options.cache.delete(cacheKey)
    return undefined
  }
  const cached = options.cache.get(cacheKey)
  if (cached?.source === source) {
    return cached
  }
  const facts: ReExportFacts = { source, named: new Map(), exportAll: [] }
  try {
    // Babel 与 Oxc 在此仅消费共同的静态导出字段。
    const ast = parseModuleForReExport(source, options.astEngine) as unknown as { body: ExportNode[] }
    for (const node of ast.body) {
      const source = getSourceValue(node)
      if (!source) {
        continue
      }
      if (node?.type === 'ExportNamedDeclaration') {
        for (const spec of node.specifiers ?? []) {
          if (spec?.type !== 'ExportSpecifier') {
            continue
          }
          const name = getSpecifierName(spec.exported)
          const imported = getSpecifierName(spec.local)
          if (name && imported) {
            facts.named.set(name, { source, imported })
          }
        }
      }
      else if (node?.type === 'ExportAllDeclaration') {
        facts.exportAll.push(source)
      }
    }
  }
  catch {
    // 无法解析的版本也可缓存，但下一版源码必须重新解析。
  }
  options.cache.set(cacheKey, facts)
  return facts
}

async function resolveReExportedInternal(
  exporterFile: string,
  exportName: string,
  depth: number,
  visited: Map<string, number>,
  options: ResolveReExportOptions,
): Promise<string | undefined> {
  const key = `${exporterFile}\0${exportName}`
  if (depth <= 0 || (visited.get(key) ?? 0) >= depth) {
    return undefined
  }
  visited.set(key, depth)
  const facts = await readReExportFacts(exporterFile, options)
  if (!facts) {
    return undefined
  }
  const binding = facts.named.get(exportName)
  if (binding) {
    const resolved = await options.resolveId(binding.source, exporterFile)
    if (!resolved) {
      return undefined
    }
    if (binding.imported !== 'default') {
      return resolveReExportedInternal(resolved, binding.imported, depth - 1, visited, options)
    }
    if (/\.(?:[cm]?ts|[cm]?js)$/.test(resolved)) {
      const target = await readReExportFacts(resolved, options)
      if (target?.named.has('default')) {
        return resolveReExportedInternal(resolved, 'default', depth - 1, visited, options)
      }
    }
    return resolved
  }
  for (const source of facts.exportAll) {
    const hopId = await options.resolveId(source, exporterFile)
    if (!hopId) {
      continue
    }
    const nested = await resolveReExportedInternal(hopId, exportName, depth - 1, visited, options)
    if (nested) {
      return nested
    }
  }
  return undefined
}

export async function resolveReExportedName(
  exporterFile: string,
  exportName: string,
  options: ResolveReExportOptions,
) {
  const maxDepth = options.maxDepth ?? 4
  return resolveReExportedInternal(exporterFile, exportName, maxDepth, new Map(), options)
}
