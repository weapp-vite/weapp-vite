import type { CompilerGenerateResult } from 'weapp-tailwindcss/core'

/** 返回上游实际扫描边界中的文件，宿主将它们登记到现有 watcher。 */
export async function listTailwindSourceFiles(result: CompilerGenerateResult, cwd: string): Promise<string[]> {
  const root = result.root
  const scannedSources = [...result.sources]
  const { createTailwindV4CompiledSourceEntries, createTailwindV4SourceEntryMatcher, resolveProjectSourceFiles } = await import('@weapp-tailwindcss/engine')
  const sources = createTailwindV4CompiledSourceEntries(root, scannedSources, cwd)
  return resolveProjectSourceFiles({ cwd, sources, filter: createTailwindV4SourceEntryMatcher(sources) })
}
