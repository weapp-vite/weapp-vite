import type { CompilerGenerateResult } from 'weapp-tailwindcss/core'
import { createTailwindV4CompiledSourceEntries, createTailwindV4SourceEntryMatcher, resolveProjectSourceFiles } from '@weapp-tailwindcss/engine'

/** 返回上游实际扫描边界中的文件，宿主将它们登记到现有 watcher。 */
export function listTailwindSourceFiles(result: CompilerGenerateResult, cwd: string): Promise<string[]> {
  const sources = createTailwindV4CompiledSourceEntries(result.root, [...result.sources], cwd)
  return resolveProjectSourceFiles({ cwd, sources, filter: createTailwindV4SourceEntryMatcher(sources) })
}
