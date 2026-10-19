import type { CompilerGenerateResult } from 'weapp-tailwindcss/core'
import type { WeappCompilerHmrRequest } from '../../types/compilerPlugin'
import path from 'pathe'
import { CompilerHmrResyncError, compilerSourceId } from '../compilerPlugin/hmr'
import { captureGenerationDependencies, isGenerationSourceFile } from './generation/inputs'

interface ImportedSnapshotRoot {
  sources: CompilerGenerateResult['sources'][number][]
  watchFiles: readonly string[]
  rawSources: ReadonlyMap<string, string | null | undefined>
}

/** 原生快照仍会扫描磁盘，因此要锁住整个候选集合、CSS 依赖及其文件版本。 */
export async function createImportedTailwindValidation(
  roots: readonly ImportedSnapshotRoot[],
  generated: readonly CompilerGenerateResult[],
  request: WeappCompilerHmrRequest,
  cwd: string,
  assertCurrent: () => void,
) {
  const sources = new Map(request.sources)
  const changedFiles = [...request.changedFiles]
  const { createTailwindV4SourceEntryMatcher, resolveProjectSourceFiles } = await import('@weapp-tailwindcss/engine')
  const scan = async () => {
    const files = await Promise.all(roots.map(root => resolveProjectSourceFiles({ cwd, sources: root.sources, filter: createTailwindV4SourceEntryMatcher(root.sources) })))
    return [...new Set(files.flat().map(compilerSourceId))].sort()
  }
  const fail = (cause: unknown): never => {
    if (cause instanceof CompilerHmrResyncError) {
      throw cause
    }
    const error = new CompilerHmrResyncError(changedFiles, 'Tailwind imported snapshot input is no longer available')
    error.cause = cause
    throw error
  }
  try {
    assertCurrent()
    const candidates = await scan()
    const files = [...new Set([
      ...candidates,
      ...generated.flatMap(entry => entry.dependencies),
      ...roots.flatMap(root => [...root.watchFiles, ...root.rawSources.keys()]),
    ])]
    const validateDependencies = captureGenerationDependencies(files, sources, changedFiles)
    const matchers = roots.map(root => createTailwindV4SourceEntryMatcher(root.sources))
    const validate = async (inputFiles: Iterable<string> = [], consumed: Iterable<string> = []) => {
      try {
        assertCurrent()
        if (request.sources.size !== sources.size || [...sources].some(([file, source]) => request.sources.get(file) !== source)) {
          throw new CompilerHmrResyncError(changedFiles, 'Tailwind imported snapshot frozen sources changed')
        }
        const consumedFiles = new Set(consumed)
        for (const file of new Set([...inputFiles, ...consumedFiles])) {
          if (path.isAbsolute(file) && matchers.some(matches => matches?.(file))
            && (consumedFiles.has(file) || isGenerationSourceFile(file)) && typeof sources.get(compilerSourceId(file)) !== 'string') {
            throw new CompilerHmrResyncError(changedFiles, `Tailwind imported snapshot consumed an unfrozen source: ${file}`)
          }
        }
        validateDependencies()
        const current = await scan()
        if (current.length !== candidates.length || current.some((file, index) => file !== candidates[index])) {
          throw new CompilerHmrResyncError(changedFiles, 'Tailwind imported snapshot source membership changed')
        }
        // 扫描集合本身含异步读盘，结束后再次核对版本与入口所有权。
        validateDependencies()
        assertCurrent()
      }
      catch (error) {
        fail(error)
      }
    }
    await validate()
    return validate
  }
  catch (error) {
    return fail(error)
  }
}
