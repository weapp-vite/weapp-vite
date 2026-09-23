import type { OutputBundle } from 'rolldown'
import type { CompilerContext } from '../../context'
import type {
  AnalyzeGlassEaselBundleOptions,
  GlassEaselDiagnostic,
} from './types'
import { Buffer } from 'node:buffer'
import { parseJsLike, traverse } from '../../utils/babel'
import { scanWxml } from '../../wxml'
import {
  collectKnownOutputSources,
  collectOutputSourceIds,
  isGlassEaselDetected,
  normalizeOutputFileName,
  offsetToLocation,
  outputOwner,
  reconcileFullOutputScope,
  replaceAnalysis,
  replaceSourceAnalysis,
} from './state'

const TEMPLATE_FILE_RE = /\.(?:wxml|axml|swan|ttml|jxml|qml|ksml|xhsml)$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getOutputSource(output: OutputBundle[string]) {
  if (output.type === 'chunk') {
    return output.code
  }
  if (typeof output.source === 'string') {
    return output.source
  }
  return Buffer.from(output.source).toString('utf8')
}

function analyzeJsonConfig(file: string, source: string) {
  let config: unknown
  try {
    config = JSON.parse(source) as unknown
  }
  catch {
    return { detected: false, diagnostics: [] as GlassEaselDiagnostic[] }
  }
  if (!isRecord(config)) {
    return { detected: false, diagnostics: [] as GlassEaselDiagnostic[] }
  }

  const isHostConfig = file === 'app.json'
    || file.endsWith('/app.json')
    || file === 'plugin.json'
    || file.endsWith('/plugin.json')
    || config.component !== true
  if (!isHostConfig || config.glassEaselWebview !== true) {
    return { detected: false, diagnostics: [] as GlassEaselDiagnostic[] }
  }

  const componentFramework = config.componentFramework
  if (componentFramework === 'glass-easel') {
    return { detected: true, diagnostics: [] as GlassEaselDiagnostic[] }
  }

  return {
    detected: true,
    diagnostics: [{
      code: 'GE001',
      severity: 'error',
      file,
      message: 'WebView glass-easel 需成对配置 componentFramework: "glass-easel" 与 glassEaselWebview: true。',
    }] satisfies GlassEaselDiagnostic[],
  }
}

function getMemberPropertyName(node: any) {
  if (!node || (node.type !== 'MemberExpression' && node.type !== 'OptionalMemberExpression')) {
    return undefined
  }
  if (!node.computed && node.property?.type === 'Identifier') {
    return node.property.name as string
  }
  if (node.property?.type === 'StringLiteral') {
    return node.property.value as string
  }
}

function isWxCreateSelectorQueryCall(node: any) {
  if (!node || node.type !== 'CallExpression') {
    return false
  }
  const callee = node.callee
  return getMemberPropertyName(callee) === 'createSelectorQuery'
    && callee.object?.type === 'Identifier'
    && callee.object.name === 'wx'
}

export function analyzeScript(file: string, source: string): GlassEaselDiagnostic[] {
  const diagnostics: GlassEaselDiagnostic[] = []
  try {
    const ast = parseJsLike(source)
    traverse(ast, {
      CallExpression(callPath: any) {
        const node = callPath.node
        const method = getMemberPropertyName(node.callee)
        if (method === 'select' || method === 'selectAll') {
          const selector = node.arguments?.[0]
          if (selector?.type === 'StringLiteral' && /(?:^|[\s>+~,])[.#]\d/.test(selector.value)) {
            diagnostics.push({
              code: 'GE005',
              severity: 'error',
              file,
              line: selector.loc?.start.line,
              column: selector.loc ? selector.loc.start.column + 1 : undefined,
              message: `SelectorQuery 选择器 ${JSON.stringify(selector.value)} 含数字开头的 id 或 class。`,
            })
          }
        }

        if (
          method === 'in'
          && isWxCreateSelectorQueryCall(node.callee.object)
          && node.arguments?.[0]?.type === 'ThisExpression'
        ) {
          diagnostics.push({
            code: 'GE006',
            severity: 'warning',
            file,
            line: node.loc?.start.line,
            column: node.loc ? node.loc.start.column + 1 : undefined,
            message: '可将 wx.createSelectorQuery().in(this) 改为 this.createSelectorQuery()，减少兼容层开销。',
          })
        }
      },
    })
  }
  catch {
    // 构建产物解析失败不应阻断原有构建，由现有编译链继续报告语法错误。
  }
  return diagnostics
}

export function analyzeGlassEaselBundle(
  ctx: CompilerContext,
  bundle: OutputBundle,
  options: AnalyzeGlassEaselBundleOptions = {
    mode: 'partial',
    outputScope: 'default',
  },
) {
  const entries = Object.entries(bundle)
  const currentOutputOwners = new Set<string>()
  let sourcesByOutput = isGlassEaselDetected(ctx)
    ? collectKnownOutputSources(ctx)
    : undefined

  for (const [bundleFileName, output] of entries) {
    const file = normalizeOutputFileName(output.fileName || bundleFileName)
    const owner = outputOwner(options.outputScope, file)
    currentOutputOwners.add(owner)
    if (!file.endsWith('.json')) {
      continue
    }

    const result = analyzeJsonConfig(file, getOutputSource(output))
    if (!sourcesByOutput && result.detected) {
      sourcesByOutput = collectKnownOutputSources(ctx)
    }
    replaceAnalysis(ctx, owner, {
      kind: 'output',
      scope: options.outputScope,
      detected: result.detected,
      diagnostics: result.diagnostics,
      sourceIds: collectOutputSourceIds(output, file, sourcesByOutput),
    })
  }

  if (options.mode === 'full') {
    reconcileFullOutputScope(ctx, options.outputScope, currentOutputOwners)
  }

  if (!isGlassEaselDetected(ctx)) {
    return
  }
  sourcesByOutput ??= collectKnownOutputSources(ctx)
  replaceSourceAnalysis(ctx)

  for (const [bundleFileName, output] of entries) {
    const file = normalizeOutputFileName(output.fileName || bundleFileName)
    if (file.endsWith('.json')) {
      continue
    }

    const diagnostics: GlassEaselDiagnostic[] = []
    const source = getOutputSource(output)
    if (TEMPLATE_FILE_RE.test(file)) {
      const token = scanWxml(source, { platform: ctx.configService.platform })
      for (const finding of token.glassEaselFindings ?? []) {
        diagnostics.push({
          code: finding.code,
          severity: finding.severity,
          message: finding.message,
          file,
          ...offsetToLocation(source, finding.start),
          normalized: finding.normalized,
        })
      }
    }
    else if (output.type === 'chunk') {
      diagnostics.push(...analyzeScript(file, source))
    }
    else {
      ctx.runtimeState.glassEasel.analysisByOwner.delete(outputOwner(options.outputScope, file))
      continue
    }

    replaceAnalysis(ctx, outputOwner(options.outputScope, file), {
      kind: 'output',
      scope: options.outputScope,
      detected: false,
      diagnostics,
      sourceIds: collectOutputSourceIds(output, file, sourcesByOutput),
    })
  }
}

export { createGlassEaselAnalyzeResult, invalidateGlassEaselSource } from './state'

export type {
  AnalyzeGlassEaselBundleOptions,
  GlassEaselAnalyzeResult,
  GlassEaselDiagnostic,
  GlassEaselDiagnosticCode,
  GlassEaselDiagnosticSeverity,
} from './types'
