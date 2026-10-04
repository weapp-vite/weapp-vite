import type { AnalyzeSubpackagesResult } from '../../analyze/subpackages/types'

/** 取每个原始模块 ID 的最大已知贡献，缺少产物贡献时使用原始体积。 */
export function createModuleByteMap(result: Pick<AnalyzeSubpackagesResult, 'packages'>): Map<string, number> {
  const bytes = new Map<string, number>()
  for (const pkg of result.packages) {
    for (const file of pkg.files) {
      for (const mod of file.modules ?? []) {
        bytes.set(mod.id, Math.max(bytes.get(mod.id) ?? 0, mod.bytes ?? mod.originalBytes ?? 0))
      }
    }
  }
  return bytes
}
