import type { CompilerGenerateRequest, CompilerGenerateResult } from 'weapp-tailwindcss/core'
import type { CompilerContext } from '../../../context'
import type { WeappCompilerHmrPreparation, WeappCompilerHmrRequest } from '../../../types/compilerPlugin'
import path from 'pathe'
import { CompilerHmrResyncError, compilerSourceId } from '../../compilerPlugin/hmr'
import { captureGenerationDependencies, copyGenerationValue, equalGenerationValue, generationRequest, isGenerationSourceFile } from './inputs'

export interface TailwindGenerationEntry {
  readonly rawCss: string
  readonly css: string
  readonly dependencies: readonly string[]
  readonly snapshot: CompilerGenerateResult['snapshot']
}

interface CapturedRoot {
  readonly request: CompilerGenerateRequest
  readonly sources: CompilerGenerateResult['sources']
  readonly entry: TailwindGenerationEntry
}

interface Generation {
  readonly request: WeappCompilerHmrRequest
  readonly sources: ReadonlyMap<string, string | null>
  readonly options: unknown
  readonly roots: readonly CapturedRoot[]
  readonly assertActive: () => void
  disposed: boolean
  rejection?: CompilerHmrResyncError
}

const generations = new WeakMap<WeappCompilerHmrPreparation, Generation>()
const revokedPreparations = new WeakSet<WeappCompilerHmrPreparation>()
const builds = new WeakMap<ReadonlyMap<string, string | null>, Generation>()
const contexts = new WeakMap<CompilerContext, Generation>()
const validations = new WeakMap<CompilerContext, (files: Iterable<string>, consumed: Iterable<string>) => Promise<void>>()

/** 封存本批投影，不把活动 compiler、PostCSS root 或输出容器交给快照。 */
export function rememberTailwindGeneration(
  preparation: WeappCompilerHmrPreparation,
  request: WeappCompilerHmrRequest,
  options: unknown,
  roots: readonly { request: CompilerGenerateRequest, sources: CompilerGenerateResult['sources'], result: CompilerGenerateResult }[],
  assertActive: () => void,
) {
  let generation: Generation
  try {
    generation = {
      request,
      sources: new Map(request.sources),
      options: copyGenerationValue(options),
      roots: roots.map(root => ({
        request: copyGenerationValue(root.request),
        sources: copyGenerationValue(root.sources),
        entry: Object.freeze({ rawCss: root.result.rawCss, css: root.result.css, dependencies: Object.freeze([...root.result.dependencies]), snapshot: root.result.snapshot }),
      })),
      assertActive,
      disposed: false,
    }
  }
  catch {
    // 不可封存的自定义配置沿普通独立编译路径处理。
    return
  }
  generations.set(preparation, generation)
  const dispose = preparation.dispose
  let disposal: Promise<void> | undefined
  preparation.dispose = () => {
    if (!disposal) {
      generation.disposed = true
      revokedPreparations.add(preparation)
      generations.delete(preparation)
      disposal = Promise.resolve().then(() => dispose?.())
    }
    return disposal
  }
}

function assertGeneration(generation: Generation) {
  try {
    if (generation.disposed || generation.request.sources.size !== generation.sources.size
      || [...generation.sources].some(([file, source]) => generation.request.sources.get(file) !== source)) {
      throw new CompilerHmrResyncError(generation.request.changedFiles, 'Tailwind snapshot generation is no longer available')
    }
    generation.assertActive()
  }
  catch (error) {
    if (error instanceof CompilerHmrResyncError) {
      generation.rejection = error
    }
    throw error
  }
}

/** 只在当前 rebuild 内提供同一 request 的 handoff，结束后立即解除。 */
export async function withTailwindSnapshotGeneration<T>(input: WeappCompilerHmrRequest, preparations: readonly WeappCompilerHmrPreparation[], build: () => Promise<T>): Promise<T> {
  if (preparations.some(preparation => revokedPreparations.has(preparation)
    || (generations.has(preparation) && generations.get(preparation)!.request !== input))) {
    throw new CompilerHmrResyncError(input.changedFiles, 'Tailwind snapshot preparation belongs to another or disposed generation')
  }
  const matching = preparations.flatMap((preparation) => {
    const generation = generations.get(preparation)
    return generation?.request === input ? [generation] : []
  })
  if (!matching.length) {
    return build()
  }
  if (matching.length !== 1) {
    throw new CompilerHmrResyncError(input.changedFiles, 'Tailwind snapshot generation has multiple preparation owners')
  }
  const generation = matching[0]!
  assertGeneration(generation)
  if (builds.has(input.sources)) {
    throw new CompilerHmrResyncError(input.changedFiles, 'Tailwind snapshot generation already has a build owner')
  }
  builds.set(input.sources, generation)
  generation.rejection = undefined
  try {
    const result = await build()
    assertGeneration(generation)
    return result
  }
  catch (error) {
    // Rolldown 包装 hook 异常；只还原本次准入拒绝，不覆盖其他构建首错。
    const wrapped = error && typeof error === 'object' && 'errors' in error ? error.errors : undefined
    if (generation.rejection && Array.isArray(wrapped) && wrapped.length === 1 && wrapped[0] === generation.rejection) {
      throw generation.rejection
    }
    throw error
  }
  finally {
    builds.delete(input.sources)
    generation.rejection = undefined
  }
}

export function bindTailwindSnapshotGeneration(ctx: CompilerContext, sources?: ReadonlyMap<string, string | null>) {
  const generation = sources && builds.get(sources)
  if (generation) {
    assertGeneration(generation)
    if (contexts.has(ctx)) {
      throw new CompilerHmrResyncError(generation.request.changedFiles, 'Tailwind snapshot context already has a generation owner')
    }
    contexts.set(ctx, generation)
  }
  return () => {
    contexts.delete(ctx)
    validations.delete(ctx)
  }
}

export async function validateTailwindSnapshotGeneration(ctx: CompilerContext, files: Iterable<string>, consumed: Iterable<string> = []) {
  await validations.get(ctx)?.(files, consumed)
}

async function admitGeneration(ctx: CompilerContext, generation: Generation, requests: readonly CompilerGenerateRequest[], options: unknown, eligible: boolean) {
  const reject = (file?: string) => {
    throw new CompilerHmrResyncError(generation.request.changedFiles, `Tailwind snapshot inputs do not match their frozen generation${file ? `: ${file}` : ''}`)
  }
  assertGeneration(generation)
  if (!eligible || !equalGenerationValue(generation.options, options) || requests.length !== generation.roots.length) {
    return reject()
  }
  const { resolveProjectSourceFiles, createTailwindV4SourceEntryMatcher } = await import('@weapp-tailwindcss/engine')
  const files = new Set<string>()
  for (const [index, request] of requests.entries()) {
    const root = generation.roots[index]!
    if (!equalGenerationValue(root.request, await generationRequest(request))) {
      return reject()
    }
    const sourceRules = root.sources.map(source => ({ ...source }))
    const selected = await resolveProjectSourceFiles({ cwd: ctx.configService.cwd, sources: sourceRules, filter: createTailwindV4SourceEntryMatcher(sourceRules) })
    assertGeneration(generation)
    for (const file of selected) {
      if (typeof generation.sources.get(compilerSourceId(file)) !== 'string') {
        return reject()
      }
      files.add(file)
    }
  }
  const dependencies = [...new Set(generation.roots.flatMap(root => [...root.entry.dependencies]))]
  const validateDependencies = captureGenerationDependencies(dependencies, generation.sources, generation.request.changedFiles)
  const validate = () => {
    assertGeneration(generation)
    try {
      validateDependencies()
    }
    catch (error) {
      if (error instanceof CompilerHmrResyncError) {
        generation.rejection = error
      }
      throw error
    }
  }
  validate()
  validations.set(ctx, async (inputFiles, consumed) => {
    validate()
    for (const root of generation.roots) {
      const sourceRules = root.sources.map(source => ({ ...source }))
      const matches = createTailwindV4SourceEntryMatcher(sourceRules)
      const selected = await resolveProjectSourceFiles({ cwd: ctx.configService.cwd, sources: sourceRules, filter: matches })
      const actual = [...consumed].filter(file => path.isAbsolute(file) && matches?.(file))
      const discovered = [...selected, ...inputFiles].filter(file => path.isAbsolute(file) && matches?.(file) && isGenerationSourceFile(file))
      // 已编译模块即使随后删除也属于真实输入；不存在的解析候选仅来自依赖声明。
      for (const file of [...actual, ...discovered]) {
        if (typeof generation.sources.get(compilerSourceId(file)) !== 'string') {
          reject(file)
        }
      }
      validate()
    }
  })
  return { entries: generation.roots.map(root => root.entry), files: [...files], validate }
}

/** 全部 root、配置及扫描范围通过同一准入后才交付生成结果。 */
export async function takeTailwindSnapshotGeneration(ctx: CompilerContext, requests: readonly CompilerGenerateRequest[], options: unknown, eligible: boolean) {
  const generation = contexts.get(ctx)
  if (!generation) {
    return undefined
  }
  try {
    return await admitGeneration(ctx, generation, requests, options, eligible)
  }
  catch (error) {
    if (error instanceof CompilerHmrResyncError) {
      generation.rejection = error
    }
    throw error
  }
}
