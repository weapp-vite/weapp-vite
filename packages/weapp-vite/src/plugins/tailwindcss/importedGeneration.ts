import type { CompilerGenerateRequest, CompilerGenerateResult } from 'weapp-tailwindcss/core'
import type { TailwindGenerationEntry } from './generation'
import path from 'pathe'
import { CompilerHmrResyncError, compilerSourceId } from '../compilerPlugin/hmr'
import { comparableGenerationRequest, copyGenerationValue, equalGenerationValue, generationRequest, withGenerationProperty } from './generation/inputs'

export interface ImportedTailwindGeneration {
  options: unknown
  roots: ReadonlyMap<number | string, { request: CompilerGenerateRequest, entry: TailwindGenerationEntry }>
}

/** 把磁盘入口映射成同一冻结来源的内存请求，只排除来源扫描的执行方式。 */
export async function importedGenerationRequest(request: CompilerGenerateRequest, sources: ReadonlyMap<string, string | null>) {
  const copied = comparableGenerationRequest(request)
  const descriptors = Object.getOwnPropertyDescriptors(copied)
  delete descriptors.sources
  delete descriptors.scanSources
  const input = Object.create(Object.getPrototypeOf(copied), descriptors) as CompilerGenerateRequest
  const sourceOptions = input.sourceOptions
  if (!sourceOptions) {
    throw new CompilerHmrResyncError([], 'Tailwind imported snapshot requires captured CSS options')
  }
  const cssSources = (sourceOptions.cssEntries ?? []).map((file) => {
    const css = sources.get(compilerSourceId(file))
    if (typeof css !== 'string') {
      throw new CompilerHmrResyncError([file], 'Tailwind imported snapshot requires a frozen CSS entry')
    }
    return { css, file, base: path.dirname(file), dependencies: [file] }
  })
  const options = withGenerationProperty(withGenerationProperty(sourceOptions, 'cssEntries', []), 'cssSources', [...sourceOptions.cssSources ?? [], ...cssSources])
  return generationRequest(withGenerationProperty(input, 'sourceOptions', options))
}

/** 只交接不可变生成投影，不跨快照共享活动 compiler 或可变 CSS AST。 */
export function captureImportedTailwindGeneration(requests: ReadonlyMap<number | string, CompilerGenerateRequest>, generated: ReadonlyMap<number | string, CompilerGenerateResult>, options: unknown): ImportedTailwindGeneration {
  return {
    options: copyGenerationValue(options),
    roots: new Map([...generated].map(([key, result]) => {
      const request = requests.get(key)
      if (!request) {
        throw new CompilerHmrResyncError([], 'Tailwind imported generation has no effective request')
      }
      return [key, {
        request: comparableGenerationRequest(request),
        entry: Object.freeze({ rawCss: result.rawCss, css: result.css, dependencies: Object.freeze([...result.dependencies]), snapshot: result.snapshot }),
      }]
    })),
  }
}

export async function takeImportedGeneration(generation: ImportedTailwindGeneration | undefined, key: number | string, request: CompilerGenerateRequest, sources: ReadonlyMap<string, string | null>, options: unknown) {
  const root = generation?.roots.get(key)
  const current = await importedGenerationRequest(request, sources)
  if (!root || !equalGenerationValue(generation!.options, options)
    || !equalGenerationValue(root.request, current)) {
    throw new CompilerHmrResyncError([], 'Tailwind imported snapshot inputs do not match their frozen generation')
  }
  return root.entry
}
