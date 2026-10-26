import type { ResolvedConfig } from 'vite'
import type { CompilerContext } from '../../../context'
import path from 'pathe'
import { preprocessCSS } from 'vite'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'
import { syncCssImportDependencies } from '../../utils/invalidateEntry'
import { compilerSnapshotSourceId, getCompilerSourceSnapshot, readCompilerInput } from '../../utils/sourceSnapshot'
import { restoreCompiledPublicAssetUrls } from '../publicAssetUrls'

export interface StylePreprocessorHookContext {
  environment?: object
  addWatchFile?: (file: string) => void
}

type ProcessedStyle = Awaited<ReturnType<typeof preprocessCSS>>
interface StyleInput {
  diskSource: string
  source: string
  results: Map<string, ProcessedStyle>
}
interface StyleGeneration {
  phase: 'graph' | 'preparing' | 'output' | 'failed' | 'closed'
  files: Map<string, StyleInput | null>
  hasError: boolean
  error?: unknown
  compiled: Map<string, { code: string, diskSource: string }>
  raw: Map<string, { code: string, diskSource: string }>
}

const generations = new WeakMap<CompilerContext, WeakMap<object, StyleGeneration>>()
const compiledSources = new WeakMap<object, {
  config: ResolvedConfig
  environment?: object
  generation?: object
  input?: { code: string, diskSource: string }
}>()
const LEADING_BLANK_LINES_RE = /^(?:[ \t]*\r?\n)+/

function sourceKey(source: string) {
  return source.replace(LEADING_BLANK_LINES_RE, '')
}

/** 此记录来自 Vite CSS transform 之后，不能再次当作 Sass/Less 输入。 */
export function markCompiledStyleSource(source: object, config: ResolvedConfig, hook: StylePreprocessorHookContext, input?: { code: string, diskSource: string }) {
  compiledSources.set(source, { config, environment: hook.environment, input })
}

function isPhase(current: StyleGeneration, phase: StyleGeneration['phase']) {
  return current.phase === phase
}

function generation(ctx: CompilerContext, hook: StylePreprocessorHookContext) {
  return generations.get(ctx)?.get(hook.environment ?? ctx)
}

/** 每个环境、每轮构建独立冻结输入；输出阶段不能重新启动 Vite 已关闭的预处理池。 */
export function beginStylePreprocessing(ctx: CompilerContext, hook: StylePreprocessorHookContext) {
  let environments = generations.get(ctx)
  if (!environments) {
    environments = new WeakMap()
    generations.set(ctx, environments)
  }
  environments.set(hook.environment ?? ctx, { phase: 'graph', files: new Map(), compiled: new Map(), raw: new Map(), hasError: false })
}

export function hasStylePreprocessing(ctx: CompilerContext, hook: StylePreprocessorHookContext) {
  return Boolean(generation(ctx, hook))
}

export function closeStylePreprocessing(ctx: CompilerContext, hook: StylePreprocessorHookContext) {
  const current = generation(ctx, hook)
  if (current) {
    current.phase = 'closed'
    current.files.clear()
    current.compiled.clear()
    current.raw.clear()
  }
}

/** 冻结本仓库 source 插件之后、Vite CSS 编译之前的输入，保留源码转换及其依赖语义。 */
export function captureStylePreprocessorInput(
  ctx: CompilerContext,
  hook: StylePreprocessorHookContext,
  file: string,
  source: { code: string, diskSource: string },
) {
  const current = generation(ctx, hook)
  if (current?.phase === 'graph') {
    current.raw.set(normalizeFsResolvedId(file, { stripLeadingNullByte: true }), source)
  }
}

export function captureCompiledStyleSource(
  ctx: CompilerContext,
  hook: StylePreprocessorHookContext,
  file: string,
  source: { code: string, diskSource: string },
  config: ResolvedConfig,
) {
  const current = generation(ctx, hook)
  if (current?.phase === 'graph') {
    const normalized = normalizeFsResolvedId(file, { stripLeadingNullByte: true })
    compiledSources.set(source, { config, environment: hook.environment, generation: current, input: current.raw.get(normalized) })
    current.compiled.set(normalized, source)
  }
}

/** 延迟抛出准备阶段的原始错误，让 Vite 普通 buildEnd 仍有机会关闭预处理池。 */
export function recordStylePreprocessingError(ctx: CompilerContext, hook: StylePreprocessorHookContext, error: unknown) {
  const current = generation(ctx, hook)
  if (!current) {
    throw error
  }
  current.files.clear()
  if (!isPhase(current, 'closed')) {
    current.phase = 'failed'
  }
  if (!current.hasError) {
    current.hasError = true
    current.error = error
  }
}

export async function prepareStylePreprocessing(
  ctx: CompilerContext,
  hook: StylePreprocessorHookContext,
  config: ResolvedConfig,
  files: Iterable<string>,
  shouldProcess: (file: string) => boolean = () => true,
) {
  const current = generation(ctx, hook)
  if (!current || current.phase !== 'graph') {
    throw new Error('[weapp-vite] 样式预处理缺少当前构建的图阶段。')
  }
  current.phase = 'preparing'
  try {
    const prepared = await Promise.allSettled([...new Set(files)].map(async (file) => {
      const normalized = normalizeFsResolvedId(file, { stripLeadingNullByte: true })
      if (!path.isAbsolute(normalized)) {
        return
      }
      const snapshot = getCompilerSourceSnapshot(ctx.configService)
      if (snapshot?.get(compilerSnapshotSourceId(snapshot, normalized)) === null) {
        current.files.set(normalized, null)
        return
      }
      let diskSource: string
      try {
        diskSource = await readCompilerInput(ctx.configService, normalized)
      }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          current.files.set(normalized, null)
          return
        }
        throw error
      }
      const cached = current.compiled.get(normalized) ?? ctx.runtimeState?.css?.transformedSidecarSource.get(normalized)
      const compiled = cached ? compiledSources.get(cached) : undefined
      const sameConfig = !compiled || (compiled.config === config && compiled.environment === hook.environment)
      const memory = sameConfig && (!compiled || compiled.generation === current) ? cached : undefined
      const source = memory?.diskSource === diskSource ? memory.code : diskSource
      if (memory && memory.diskSource !== diskSource) {
        ctx.runtimeState.css.transformedSidecarSource.delete(normalized)
      }
      const input: StyleInput = { diskSource, source, results: new Map() }
      current.files.set(normalized, input)
      const transformed = memory && compiledSources.has(memory) && memory.diskSource === diskSource
      const raw = current.raw.get(normalized) ?? (sameConfig ? compiled?.input : undefined)
      const code = sourceKey(raw?.diskSource === diskSource ? raw.code : transformed ? diskSource : source)
      const processed = shouldProcess(normalized) ? await preprocessCSS(code, normalized, config) : { code, deps: new Set<string>() }
      // 完整 deps 只能由预处理器给出，不能把全局 watchFiles 误归属给每份样式。
      // 图阶段编译正文保留原生内联、重定位与插件转换，仅精确恢复 public URL。
      const result = transformed ? { ...processed, code: await restoreCompiledPublicAssetUrls(source, processed.code, normalized, config.publicDir) } : processed
      input.source = transformed ? result.code : source
      for (const value of [diskSource, source, code, result.code]) {
        input.results.set(sourceKey(value), result)
      }
      syncCssImportDependencies(ctx, normalized, diskSource, result.deps)
      for (const dependency of result.deps ?? []) {
        hook.addWatchFile?.(normalizeFsResolvedId(path.resolve(path.dirname(normalized), dependency)))
      }
    }))
    const errors = prepared.flatMap(result => result.status === 'rejected' ? [result.reason as unknown] : [])
    if (errors.length) {
      throw errors.length === 1 ? errors[0] : new AggregateError(errors, '[weapp-vite] 样式图阶段预处理失败。')
    }
    if (!isPhase(current, 'preparing')) {
      throw new Error('[weapp-vite] 样式预处理完成前，构建已关闭。')
    }
    current.phase = 'output'
  }
  catch (error) {
    recordStylePreprocessingError(ctx, hook, error)
  }
}

export function assertStylePreprocessing(ctx: CompilerContext, hook: StylePreprocessorHookContext) {
  const current = generation(ctx, hook)
  if (current?.hasError) {
    throw current.error
  }
}

function preparedInput(ctx: CompilerContext, hook: StylePreprocessorHookContext, file: string) {
  const current = generation(ctx, hook)
  if (!current) {
    return undefined
  }
  assertStylePreprocessing(ctx, hook)
  const input = current.files.get(normalizeFsResolvedId(file, { stripLeadingNullByte: true }))
  if (current.phase !== 'output' || !input) {
    throw new Error(`[weapp-vite] 样式 ${path.relative(ctx.configService.cwd, file)} 没有本轮图阶段的预处理结果；请在图阶段登记或编译样式。`)
  }
  return input
}

export function getPreparedStyleSource(ctx: CompilerContext, hook: StylePreprocessorHookContext, file: string, disk = false) {
  const input = preparedInput(ctx, hook, file)
  return disk ? input?.diskSource : input?.source
}

/** 可选 sidecar 只跳过本轮图阶段已确认消失的来源；未登记输入仍须严格校验。 */
export function isPreparedStyleMissing(ctx: CompilerContext, hook: StylePreprocessorHookContext, file: string) {
  const current = generation(ctx, hook)
  assertStylePreprocessing(ctx, hook)
  return current?.phase === 'output' && current.files.get(normalizeFsResolvedId(file, { stripLeadingNullByte: true })) === null
}

export function findPreparedStyleSource(ctx: CompilerContext, hook: StylePreprocessorHookContext, file: string) {
  const current = generation(ctx, hook)
  assertStylePreprocessing(ctx, hook)
  return current?.phase === 'output' ? current.files.get(normalizeFsResolvedId(file, { stripLeadingNullByte: true }))?.diskSource : undefined
}

export function findPreparedStyleDependencies(ctx: CompilerContext, hook: StylePreprocessorHookContext, file: string) {
  const current = generation(ctx, hook)
  assertStylePreprocessing(ctx, hook)
  const input = current?.phase === 'output' ? current.files.get(normalizeFsResolvedId(file, { stripLeadingNullByte: true })) : undefined
  return input ? [...input.results.get(sourceKey(input.diskSource))?.deps ?? []] : []
}

export async function consumeStylePreprocessing(
  ctx: CompilerContext,
  hook: StylePreprocessorHookContext,
  config: ResolvedConfig,
  file: string,
  source: string,
) {
  const input = preparedInput(ctx, hook, file)
  if (!input) {
    // 未参加受管构建的独立 helper 仍使用公开 API；受管代次绝不走此分支。
    return await preprocessCSS(source, file, config)
  }
  const result = input.results.get(sourceKey(source))
  if (!result) {
    throw new Error(`[weapp-vite] 样式 ${path.relative(ctx.configService.cwd, file)} 在输出阶段改变了未经编译的内容；请将样式转换移到图阶段。`)
  }
  return result
}

export function getPreparedSharedStyle(ctx: CompilerContext, hook: StylePreprocessorHookContext, file: string) {
  const input = preparedInput(ctx, hook, file)
  if (!input) {
    return undefined
  }
  const result = input.results.get(sourceKey(input.diskSource))!
  const base = path.dirname(file)
  return {
    css: result.code,
    dependencies: [...new Set([...(result.deps ?? [])].map(dependency => path.isAbsolute(dependency) ? dependency : path.resolve(base, dependency)))],
    source: input.diskSource,
  }
}
