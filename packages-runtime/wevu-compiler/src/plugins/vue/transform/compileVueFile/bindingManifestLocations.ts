import type { InvalidOriginalMapping, OriginalMapping } from '@jridgewell/trace-mapping'
import type { WevuBindingManifestV1 } from '../../../../types/bindingManifest'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { isEncodedSourceMapLike } from '../../../../utils/sourcemap'

function createSourceLineStarts(source: string) {
  const lineStarts = [0]
  for (const match of source.matchAll(/\r\n?|\n/g)) {
    lineStarts.push(match.index + match[0].length)
  }
  return lineStarts
}

function clearBindingManifestLocations(manifest: WevuBindingManifestV1) {
  for (const binding of manifest.bindings) {
    if (!binding.sourceFile) {
      binding.sourceLocation = undefined
    }
  }
}

function normalizeSourceFile(filename: string) {
  return filename.replaceAll('\\', '/').replace(/^\.\//, '')
}

function sourceFilesMatch(left: string, right: string) {
  const normalizedLeft = normalizeSourceFile(left)
  const normalizedRight = normalizeSourceFile(right)
  return normalizedLeft === normalizedRight
    || normalizedLeft.endsWith(`/${normalizedRight}`)
    || normalizedRight.endsWith(`/${normalizedLeft}`)
}

function resolveMappedSource(
  sourceMap: unknown,
  originalSource: string,
  fallbackSource: string,
) {
  if (!isEncodedSourceMapLike(sourceMap)) {
    return { content: fallbackSource, sourceFile: originalSource, hasMappedContent: false }
  }
  const normalizedOriginal = normalizeSourceFile(originalSource)
  const sourceIndex = sourceMap.sources.findIndex((candidate) => {
    return sourceFilesMatch(candidate, normalizedOriginal)
  })
  const sourceFile = sourceIndex >= 0
    ? sourceMap.sources[sourceIndex]!
    : originalSource
  const mappedContent = sourceIndex >= 0
    ? sourceMap.sourcesContent?.[sourceIndex]
    : undefined
  return {
    content: mappedContent ?? fallbackSource,
    sourceFile,
    hasMappedContent: mappedContent != null,
  }
}

/**
 * 将生成脚本中的 JSX binding 坐标映射回各自的原始源码。
 */
export function remapJsxBindingManifestLocations(
  manifest: WevuBindingManifestV1,
  sourceMap: unknown,
  source: string | undefined,
  sourceFile?: string,
) {
  if (sourceFile) {
    manifest.sourceFile = sourceFile
  }
  if (!source || !sourceMap) {
    clearBindingManifestLocations(manifest)
    return
  }
  let traceMap: TraceMap
  try {
    // compiler-sfc 的 RawSourceMap 与 trace-mapping 输入结构一致，但两者版本字段类型声明不同。
    const traceMapInput = sourceMap as unknown as ConstructorParameters<typeof TraceMap>[0]
    traceMap = new TraceMap(traceMapInput)
  }
  catch {
    clearBindingManifestLocations(manifest)
    return
  }
  const lineStartsCache = new Map<string, number[]>()
  const remap = (line: number, column: number) => {
    let original: InvalidOriginalMapping | OriginalMapping
    try {
      original = originalPositionFor(traceMap, {
        line,
        column: Math.max(0, column - 1),
      })
    }
    catch {
      return undefined
    }
    if (original.source == null || original.line == null || original.column == null) {
      return undefined
    }
    const mapped = resolveMappedSource(sourceMap, original.source, source)
    const ownedSourceFile = sourceFile
      ?? (sourceFilesMatch(mapped.sourceFile, manifest.sourceFile) ? manifest.sourceFile : mapped.sourceFile)
    if (!mapped.hasMappedContent && !sourceFilesMatch(ownedSourceFile, manifest.sourceFile)) {
      return undefined
    }
    let lineStarts = lineStartsCache.get(mapped.content)
    if (!lineStarts) {
      lineStarts = createSourceLineStarts(mapped.content)
      lineStartsCache.set(mapped.content, lineStarts)
    }
    return {
      position: {
        offset: (lineStarts[original.line - 1] ?? 0) + original.column,
        line: original.line,
        column: original.column + 1,
      },
      sourceFile: sourceFilesMatch(ownedSourceFile, manifest.sourceFile)
        ? undefined
        : normalizeSourceFile(ownedSourceFile),
    }
  }
  for (const binding of manifest.bindings) {
    const location = binding.sourceLocation
    if (!location) {
      continue
    }
    if (binding.sourceFile && !sourceFilesMatch(binding.sourceFile, manifest.sourceFile)) {
      continue
    }
    const start = remap(location.start.line, location.start.column)
    const end = remap(location.end.line, location.end.column)
    if (!start || !end || start.sourceFile !== end.sourceFile) {
      binding.sourceLocation = undefined
      continue
    }
    binding.sourceFile = start.sourceFile
    binding.sourceLocation = { start: start.position, end: end.position }
  }
}
