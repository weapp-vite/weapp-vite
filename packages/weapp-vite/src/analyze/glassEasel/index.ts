import type { OutputBundle } from 'rolldown'
import type { CompilerContext } from '../../context'
import type {
  GlassEaselAnalyzeResult,
  GlassEaselDiagnostic,
} from './types'
import { Buffer } from 'node:buffer'
import logger from '../../logger'
import { parseJsLike, traverse } from '../../utils/babel'
import { scanWxml } from '../../wxml'

const MIGRATION_GUIDE = 'https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/glass-easel/migration.html'
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

function offsetToLocation(source: string, offset: number) {
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

function registerDiagnostic(ctx: CompilerContext, diagnostic: GlassEaselDiagnostic) {
  const key = diagnosticKey(diagnostic)
  ctx.runtimeState.glassEasel.diagnostics.set(key, diagnostic)
  if (
    ctx.runtimeState.glassEasel.silent
    || ctx.runtimeState.glassEasel.warnedDiagnostics.has(key)
  ) {
    return
  }
  ctx.runtimeState.glassEasel.warnedDiagnostics.add(key)
  logger.warn(`[${diagnostic.code}] ${diagnostic.file}${diagnostic.line ? `:${diagnostic.line}:${diagnostic.column}` : ''} ${diagnostic.message}`)
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

function analyzeScript(file: string, source: string): GlassEaselDiagnostic[] {
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

export function analyzeGlassEaselBundle(ctx: CompilerContext, bundle: OutputBundle) {
  const entries = Object.entries(bundle)
  const localDiagnostics: GlassEaselDiagnostic[] = []
  let detected = ctx.runtimeState.glassEasel.detected

  for (const [bundleFileName, output] of entries) {
    const file = output.fileName || bundleFileName
    if (!file.endsWith('.json')) {
      continue
    }
    const result = analyzeJsonConfig(file, getOutputSource(output))
    detected ||= result.detected
    localDiagnostics.push(...result.diagnostics)
  }

  ctx.runtimeState.glassEasel.detected = detected
  if (!detected) {
    return
  }

  for (const [sourceFile, token] of ctx.runtimeState.wxml.tokenMap) {
    for (const finding of token.glassEaselFindings ?? []) {
      if (finding.code !== 'GE002') {
        continue
      }
      localDiagnostics.push({
        code: finding.code,
        severity: finding.severity,
        message: finding.message,
        file: ctx.configService.relativeAbsoluteSrcRoot(sourceFile),
        ...offsetToLocation(token.code, finding.start),
        normalized: finding.normalized,
      })
    }
  }

  for (const [bundleFileName, output] of entries) {
    const file = output.fileName || bundleFileName
    const source = getOutputSource(output)
    if (TEMPLATE_FILE_RE.test(file)) {
      const token = scanWxml(source, { platform: ctx.configService.platform })
      for (const finding of token.glassEaselFindings ?? []) {
        localDiagnostics.push({
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
      localDiagnostics.push(...analyzeScript(file, source))
    }
  }

  for (const diagnostic of localDiagnostics) {
    registerDiagnostic(ctx, diagnostic)
  }
}

export function createGlassEaselAnalyzeResult(ctx: CompilerContext): GlassEaselAnalyzeResult {
  const diagnostics = Array.from(ctx.runtimeState.glassEasel.diagnostics.values())
    .sort((left, right) => left.file.localeCompare(right.file)
      || (left.line ?? 0) - (right.line ?? 0)
      || left.code.localeCompare(right.code))
  return {
    detected: ctx.runtimeState.glassEasel.detected,
    minimumBaseLibrary: '3.8.12',
    migrationGuide: MIGRATION_GUIDE,
    diagnostics,
    summary: {
      errors: diagnostics.filter(item => item.severity === 'error').length,
      warnings: diagnostics.filter(item => item.severity === 'warning').length,
    },
  }
}

export type {
  GlassEaselAnalyzeResult,
  GlassEaselDiagnostic,
  GlassEaselDiagnosticCode,
  GlassEaselDiagnosticSeverity,
} from './types'
