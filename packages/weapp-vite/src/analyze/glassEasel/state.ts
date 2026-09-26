import type { OutputBundle } from 'rolldown'
import type { CompilerContext } from '../../context'
import type { GlassEaselAnalyzeResult, GlassEaselDiagnostic } from './types'
import logger from '../../logger'
import { resolveGraphOutputOwner } from '../../moduleGraph/outputMetadata'
import { resolveRelativeOutputFileNameWithExtension } from '../../plugins/utils/outputFileName'
import { resolveCompilerOutputExtensions } from '../../utils/outputExtensions'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

const MIGRATION_GUIDE = 'https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/glass-easel/migration.html'

export function offsetToLocation(source: string, offset: number) {
  const before = source.slice(0, offset)
  const lines = before.split(/\r?\n/)
  return {
    line: lines.length,
    column: (lines[lines.length - 1]?.length ?? 0) + 1,
  }
}

function diagnosticKey(diagnostic: GlassEaselDiagnostic) {
  return [
    diagnostic.code,
    diagnostic.file,
    diagnostic.line ?? 0,
    diagnostic.column ?? 0,
    diagnostic.message,
  ].join(':')
}

export function normalizeOutputFileName(file: string) {
  return file.replaceAll('\\', '/').replace(/^\.\/+/, '')
}

export function normalizeSourceId(id: string) {
  return normalizeFsResolvedId(resolveGraphOutputOwner(id) ?? id, {
    stripLeadingNullByte: true,
  }).replaceAll('\\', '/')
}

function sourceOwner(sourceId: string) {
  return `source:${sourceId}`
}

export function outputOwner(scope: string, file: string) {
  return `output:${scope}:${file}`
}

function registerDiagnostic(
  ctx: CompilerContext,
  diagnostics: Map<string, GlassEaselDiagnostic>,
  diagnostic: GlassEaselDiagnostic,
) {
  const key = diagnosticKey(diagnostic)
  diagnostics.set(key, diagnostic)
  if (
    ctx.runtimeState.glassEasel.silent
    || ctx.runtimeState.glassEasel.warnedDiagnostics.has(key)
  ) {
    return
  }
  ctx.runtimeState.glassEasel.warnedDiagnostics.add(key)
  logger.warn(`[${diagnostic.code}] ${diagnostic.file}${diagnostic.line ? `:${diagnostic.line}:${diagnostic.column}` : ''} ${diagnostic.message}`)
}

export function replaceAnalysis(
  ctx: CompilerContext,
  owner: string,
  analysis: {
    kind: 'output' | 'source'
    scope?: string
    detected: boolean
    diagnostics: GlassEaselDiagnostic[]
    sourceIds: Set<string>
  },
) {
  const diagnostics = new Map<string, GlassEaselDiagnostic>()
  for (const diagnostic of analysis.diagnostics) {
    registerDiagnostic(ctx, diagnostics, diagnostic)
  }
  ctx.runtimeState.glassEasel.analysisByOwner.set(owner, {
    ...analysis,
    diagnostics,
  })
}

function addOutputSource(
  sourcesByOutput: Map<string, Set<string>>,
  outputFile: string,
  sourceId: string,
) {
  let outputSources = sourcesByOutput.get(outputFile)
  if (!outputSources) {
    outputSources = new Set<string>()
    sourcesByOutput.set(outputFile, outputSources)
  }
  outputSources.add(sourceId)
}

export function collectKnownOutputSources(ctx: CompilerContext) {
  const sourcesByOutput = new Map<string, Set<string>>()
  const {
    jsonExtension,
    scriptExtension,
    templateExtension,
  } = resolveCompilerOutputExtensions(ctx.configService.outputExtensions)
  const addSource = (sourceFile: string, normalizedSourceId: string, extension: string) => {
    addOutputSource(
      sourcesByOutput,
      normalizeOutputFileName(resolveRelativeOutputFileNameWithExtension(
        ctx.configService,
        sourceFile,
        extension,
      )),
      normalizedSourceId,
    )
  }

  for (const sourceFile of ctx.runtimeState.wxml.tokenMap.keys()) {
    addSource(sourceFile, normalizeSourceId(sourceFile), templateExtension)
  }
  for (const sourceFile of ctx.runtimeState.build.hmr.resolvedEntryMap.keys()) {
    const normalizedSourceId = normalizeSourceId(sourceFile)
    addSource(sourceFile, normalizedSourceId, scriptExtension)
    addSource(sourceFile, normalizedSourceId, jsonExtension)
  }
  return sourcesByOutput
}

export function replaceSourceAnalysis(ctx: CompilerContext) {
  for (const [sourceFile, token] of ctx.runtimeState.wxml.tokenMap) {
    const normalizedSourceId = normalizeSourceId(sourceFile)
    const diagnostics: GlassEaselDiagnostic[] = []

    for (const finding of token.glassEaselFindings ?? []) {
      if (finding.code !== 'GE002') {
        continue
      }
      diagnostics.push({
        code: finding.code,
        severity: finding.severity,
        message: finding.message,
        file: ctx.configService.relativeAbsoluteSrcRoot(sourceFile),
        ...offsetToLocation(token.code, finding.start),
        normalized: finding.normalized,
      })
    }

    replaceAnalysis(ctx, sourceOwner(normalizedSourceId), {
      kind: 'source',
      detected: false,
      diagnostics,
      sourceIds: new Set([normalizedSourceId]),
    })
  }
}

export function collectOutputSourceIds(
  output: OutputBundle[string],
  file: string,
  sourcesByOutput?: Map<string, Set<string>>,
) {
  const sourceIds = new Set<string>([file])
  for (const sourceId of sourcesByOutput?.get(file) ?? []) {
    sourceIds.add(sourceId)
  }
  if (output.type === 'chunk') {
    if (output.facadeModuleId) {
      sourceIds.add(normalizeSourceId(output.facadeModuleId))
    }
    for (const moduleId of output.moduleIds ?? []) {
      sourceIds.add(normalizeSourceId(moduleId))
    }
  }
  else {
    for (const originalFileName of output.originalFileNames ?? []) {
      sourceIds.add(normalizeSourceId(originalFileName))
    }
  }
  return sourceIds
}

export function isGlassEaselDetected(ctx: CompilerContext) {
  for (const analysis of ctx.runtimeState.glassEasel.analysisByOwner.values()) {
    if (analysis.detected) {
      return true
    }
  }
  return false
}

export function reconcileFullOutputScope(
  ctx: CompilerContext,
  scope: string,
  currentOwners: Set<string>,
) {
  for (const [owner, analysis] of ctx.runtimeState.glassEasel.analysisByOwner) {
    if (
      analysis.kind === 'output'
      && analysis.scope === scope
      && !currentOwners.has(owner)
    ) {
      ctx.runtimeState.glassEasel.analysisByOwner.delete(owner)
    }
  }
}

export function invalidateGlassEaselSource(ctx: CompilerContext, sourceFile: string) {
  const normalizedSourceId = normalizeSourceId(sourceFile)
  const relativeSourceId = normalizeOutputFileName(
    ctx.configService.relativeAbsoluteSrcRoot(normalizedSourceId),
  )

  for (const [owner, analysis] of ctx.runtimeState.glassEasel.analysisByOwner) {
    let invalidated = false
    for (const sourceId of analysis.sourceIds) {
      if (sourceId === normalizedSourceId || sourceId === relativeSourceId) {
        invalidated = true
        break
      }
    }
    if (invalidated) {
      ctx.runtimeState.glassEasel.analysisByOwner.delete(owner)
    }
  }
}

export function createGlassEaselAnalyzeResult(ctx: CompilerContext): GlassEaselAnalyzeResult {
  const detected = isGlassEaselDetected(ctx)
  const diagnosticsByKey = new Map<string, GlassEaselDiagnostic>()
  if (detected) {
    for (const analysis of ctx.runtimeState.glassEasel.analysisByOwner.values()) {
      for (const [key, diagnostic] of analysis.diagnostics) {
        diagnosticsByKey.set(key, diagnostic)
      }
    }
  }
  const diagnostics = Array.from(diagnosticsByKey.values())
    .sort((left, right) => left.file.localeCompare(right.file)
      || (left.line ?? 0) - (right.line ?? 0)
      || left.code.localeCompare(right.code)
      || (left.column ?? 0) - (right.column ?? 0)
      || left.message.localeCompare(right.message))
  let errors = 0
  let warnings = 0
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === 'error') {
      errors += 1
    }
    else {
      warnings += 1
    }
  }
  return {
    detected,
    minimumBaseLibrary: '3.8.12',
    migrationGuide: MIGRATION_GUIDE,
    diagnostics,
    summary: { errors, warnings },
  }
}
