import type {
  WevuBindingSourcePositionV1,
  WevuBindingUpdateMode,
  WevuRuntimeBindingManifestV1,
  WevuRuntimeBindingRecordV1,
} from '@weapp-core/constants'
import type { SetDataBindingDiagnostic } from './types'

const BINDING_UPDATE_MODES: Record<string, true> = {
  'exact-path': true,
  'snapshot-fallback': true,
  'top-level': true,
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}
function isFiniteInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)
}

function isSourcePosition(value: unknown): value is WevuBindingSourcePositionV1 {
  if (!value || typeof value !== 'object') {
    return false
  }
  const position = value as Record<string, unknown>
  return isFiniteInteger(position.offset)
    && position.offset >= 0
    && isFiniteInteger(position.line)
    && position.line >= 1
    && isFiniteInteger(position.column)
    && position.column >= 1
}

function isSourceLocation(value: unknown) {
  if (!value || typeof value !== 'object') {
    return false
  }
  const location = value as Record<string, unknown>
  const start = location.start
  const end = location.end
  return isSourcePosition(start)
    && isSourcePosition(end)
    && end.offset >= start.offset
}

function hasValidFeatures(value: object) {
  return Object.values(value).every(feature => feature === true)
}

function isBindingRecord(value: unknown): value is WevuRuntimeBindingRecordV1 {
  if (!value || typeof value !== 'object') {
    return false
  }
  const binding = value as Partial<WevuRuntimeBindingRecordV1>
  return typeof binding.id === 'string'
    && binding.id.length > 0
    && typeof binding.outputPath === 'string'
    && binding.outputPath.length > 0
    && (binding.updateMode === undefined
      || (typeof binding.updateMode === 'string' && BINDING_UPDATE_MODES[binding.updateMode] === true))
    && (binding.sourceRoots === undefined || isStringArray(binding.sourceRoots))
    && (binding.sourceLocation === undefined || isSourceLocation(binding.sourceLocation))
}

/**
 * 仅接受当前运行时理解的 Binding Manifest 版本。
 */
export function resolveBindingManifest(value: unknown): WevuRuntimeBindingManifestV1 | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }
  const manifest = value as Partial<WevuRuntimeBindingManifestV1>
  if (
    manifest.version !== 1
    || typeof manifest.sourceFile !== 'string'
    || !Array.isArray(manifest.bindings)
    || !manifest.bindings.every(isBindingRecord)
    || (manifest.features !== undefined
      && (!manifest.features
        || typeof manifest.features !== 'object'
        || Array.isArray(manifest.features)
        || !hasValidFeatures(manifest.features)))
  ) {
    return undefined
  }
  return manifest as WevuRuntimeBindingManifestV1
}

/**
 * 判断清单是否声明了指定输出路径。
 */
export function hasBindingOutputPath(
  manifest: WevuRuntimeBindingManifestV1 | undefined,
  outputPath: string,
) {
  return manifest?.bindings.some(binding => binding.outputPath === outputPath) ?? false
}

function normalizeBindingPath(path: string) {
  return path
    .replace(/\[(?:'([^']+)'|"([^"]+)"|([^\]]+))\]/g, (_match, single, double, bare) => `.${single ?? double ?? bare}`)
    .replace(/^\./, '')
}

function topLevelPath(path: string) {
  return normalizeBindingPath(path).split('.', 1)[0] ?? ''
}

function pathsOverlap(left: string, right: string) {
  const normalizedLeft = normalizeBindingPath(left)
  const normalizedRight = normalizeBindingPath(right)
  return normalizedLeft === normalizedRight
    || normalizedLeft.startsWith(`${normalizedRight}.`)
    || normalizedRight.startsWith(`${normalizedLeft}.`)
}

function getBindingUpdateMode(binding: WevuRuntimeBindingRecordV1): WevuBindingUpdateMode {
  return binding.updateMode ?? 'exact-path'
}

function matchesBindingPath(binding: WevuRuntimeBindingRecordV1, path: string) {
  if (!path) {
    return false
  }
  const updateMode = getBindingUpdateMode(binding)
  if (updateMode === 'snapshot-fallback' && binding.outputPath === '*') {
    return true
  }
  if (updateMode === 'exact-path') {
    return pathsOverlap(binding.outputPath, path)
  }

  const pathRoot = topLevelPath(path)
  if (topLevelPath(binding.outputPath) === pathRoot) {
    return true
  }
  return updateMode === 'snapshot-fallback'
    && (binding.sourceRoots ?? []).some(sourceRoot => topLevelPath(sourceRoot) === pathRoot)
}

/**
 * 按实际 setData 路径惰性解析相关模板绑定，保持清单顺序并按 id 去重。
 */
export function resolveBindingDiagnostics(
  manifest: WevuRuntimeBindingManifestV1,
  paths: Iterable<string>,
  wholeSnapshotFallback = false,
): SetDataBindingDiagnostic[] {
  const payloadPaths = [...paths]
  const seenIds = new Set<string>()
  const diagnostics: SetDataBindingDiagnostic[] = []

  for (const binding of manifest.bindings) {
    if (seenIds.has(binding.id)) {
      continue
    }
    const updateMode = getBindingUpdateMode(binding)
    const matches = payloadPaths.length > 0
      ? payloadPaths.some(path => matchesBindingPath(binding, path))
      : wholeSnapshotFallback && updateMode === 'snapshot-fallback'
    if (!matches) {
      continue
    }
    seenIds.add(binding.id)
    const diagnostic: SetDataBindingDiagnostic = {
      id: binding.id,
      outputPath: binding.outputPath,
      updateMode,
      sourceFile: manifest.sourceFile,
    }
    if (binding.sourceLocation) {
      diagnostic.sourceLocation = binding.sourceLocation
    }
    diagnostics.push(diagnostic)
  }

  return diagnostics
}
