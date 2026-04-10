/* eslint-disable ts/no-use-before-define */
import { posix as path } from 'pathe'
import { SHARED_CHUNK_VIRTUAL_PREFIX } from '../constants'

const ROLLDOWN_RUNTIME_FILE_NAME = 'rolldown-runtime.js'
const REGEXP_ESCAPE_PATTERN = /[.*+?^${}()|[\]\\]/g

export function createChunkSourceFileNameCandidates(fileName: string) {
  const candidates = [fileName]
  const normalized = resolveChunkSourceFileNameForRewrite(fileName)
  if (normalized !== fileName) {
    candidates.push(normalized)
  }
  return candidates
}

export function reserveUniqueFileName(reservedFileNames: Set<string>, fileName: string) {
  if (!reservedFileNames.has(fileName)) {
    reservedFileNames.add(fileName)
    return fileName
  }

  const { dir, name, ext } = path.parse(fileName)
  let index = 1
  let candidate = fileName
  while (reservedFileNames.has(candidate)) {
    const nextName = `${name}.${index}`
    candidate = dir ? path.join(dir, `${nextName}${ext}`) : `${nextName}${ext}`
    index += 1
  }
  reservedFileNames.add(candidate)
  return candidate
}

export function rewriteChunkImportSpecifiersInCode(
  sourceCode: string,
  options: {
    sourceFileName?: string
    sourceFileNames?: string[]
    targetFileName: string
    imports: string[]
    dynamicImports: string[]
    runtimeFileName: string
    resolveImportTarget?: (specifier: string) => string | undefined
  },
) {
  const { sourceFileName, sourceFileNames, targetFileName, imports, dynamicImports, runtimeFileName, resolveImportTarget } = options
  const sourceFileNameCandidates = (sourceFileNames ?? [sourceFileName ?? '']).filter(Boolean)
  const specifiers = new Set([...imports, ...dynamicImports].filter(Boolean))
  let rewrittenCode = sourceCode
  for (const specifier of specifiers) {
    const resolvedTargetSpecifier = path.basename(specifier) === ROLLDOWN_RUNTIME_FILE_NAME
      ? runtimeFileName
      : resolveImportTarget?.(specifier) ?? specifier
    const targetImportPath = createRelativeImportPath(targetFileName, resolvedTargetSpecifier)
    if (!targetImportPath) {
      continue
    }
    for (const sourceCandidate of sourceFileNameCandidates) {
      const sourceImportPath = createRelativeImportPath(sourceCandidate, specifier)
      if (!sourceImportPath || sourceImportPath === targetImportPath) {
        continue
      }
      rewrittenCode = replaceQuotedImportLiteralValue(rewrittenCode, sourceImportPath, targetImportPath)
    }
  }
  return rewrittenCode
}

function resolveChunkSourceFileNameForRewrite(fileName: string) {
  if (!fileName.startsWith(`${SHARED_CHUNK_VIRTUAL_PREFIX}/`)) {
    return fileName
  }
  return fileName.slice(SHARED_CHUNK_VIRTUAL_PREFIX.length + 1)
}

function replaceQuotedImportLiteralValue(sourceCode: string, sourcePath: string, targetPath: string) {
  const escapedSourcePath = escapeRegExpForPattern(sourcePath)
  return sourceCode.replace(
    new RegExp(`(['"\`])${escapedSourcePath}\\1`, 'g'),
    (_match, quote: string) => `${quote}${targetPath}${quote}`,
  )
}

function escapeRegExpForPattern(value: string) {
  return value.replace(REGEXP_ESCAPE_PATTERN, '\\$&')
}

function createRelativeImportPath(fromFileName: string, toFileName: string) {
  const relativePath = path.relative(path.dirname(fromFileName), toFileName)
  if (!relativePath || relativePath.startsWith('.')) {
    return relativePath || './'
  }
  return `./${relativePath}`
}
