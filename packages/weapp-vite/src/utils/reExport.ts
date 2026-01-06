import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse } from './babel'

export interface ReExportResolutionCache {
  get: (file: string) => Map<string, string | undefined> | undefined
  set: (file: string, value: Map<string, string | undefined>) => unknown
}

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
   * 缓存：key 为 exporter 文件路径，value 为该文件导出的 name -> resolved file。
   */
  cache: Map<string, Map<string, string | undefined>>
  /**
   * 最大递归深度。
   * @default 4
   */
  maxDepth?: number
}

function getExportedName(spec: any) {
  const exported = spec?.exported
  if (!exported) {
    return undefined
  }
  if (exported.type === 'Identifier') {
    return exported.name as string
  }
  if (exported.type === 'StringLiteral') {
    return exported.value as string
  }
  return undefined
}

function getSourceValue(node: any) {
  const source = node?.source
  if (!source || source.type !== 'StringLiteral') {
    return undefined
  }
  return source.value as string
}

async function resolveReExportedInternal(
  exporterFile: string,
  exportName: string,
  depth: number,
  visited: Set<string>,
  options: ResolveReExportOptions,
): Promise<string | undefined> {
  if (depth <= 0) {
    return undefined
  }
  if (visited.has(exporterFile)) {
    return undefined
  }
  visited.add(exporterFile)

  let entry = options.cache.get(exporterFile)
  if (!entry) {
    entry = new Map()
    options.cache.set(exporterFile, entry)
  }

  if (entry.has(exportName)) {
    return entry.get(exportName)
  }

  let code: string
  try {
    code = await options.readFile(exporterFile)
  }
  catch {
    entry.set(exportName, undefined)
    return undefined
  }

  let ast: ReturnType<typeof babelParse>
  try {
    ast = babelParse(code, BABEL_TS_MODULE_PARSER_OPTIONS)
  }
  catch {
    entry.set(exportName, undefined)
    return undefined
  }

  const exportAllSources: string[] = []

  for (const node of (ast.program.body as any[]) ?? []) {
    if (node?.type === 'ExportNamedDeclaration') {
      const source = getSourceValue(node)
      if (!source) {
        continue
      }
      for (const spec of node.specifiers ?? []) {
        if (spec?.type !== 'ExportSpecifier') {
          continue
        }
        const exportedName = getExportedName(spec)
        if (!exportedName || exportedName !== exportName) {
          continue
        }
        const resolved = await options.resolveId(source, exporterFile)
        if (resolved) {
          entry.set(exportName, resolved)
          return resolved
        }
      }
    }

    if (node?.type === 'ExportAllDeclaration') {
      const source = getSourceValue(node)
      if (source) {
        exportAllSources.push(source)
      }
    }
  }

  for (const source of exportAllSources) {
    const hopId = await options.resolveId(source, exporterFile)
    if (!hopId) {
      continue
    }
    const nested = await resolveReExportedInternal(hopId, exportName, depth - 1, visited, options)
    if (nested) {
      entry.set(exportName, nested)
      return nested
    }
  }

  entry.set(exportName, undefined)
  return undefined
}

export async function resolveReExportedName(
  exporterFile: string,
  exportName: string,
  options: ResolveReExportOptions,
) {
  const maxDepth = options.maxDepth ?? 4
  return resolveReExportedInternal(exporterFile, exportName, maxDepth, new Set<string>(), options)
}
