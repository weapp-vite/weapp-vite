import { statSync } from 'node:fs'
import { getCompilerRawSnapshot } from '../../plugins/compilerPlugin/hmr'
import { compilerRawFileVersion, readCompilerRawInput } from '../../plugins/compilerPlugin/rawInputs'
import { compilerNativeScriptVersion } from '../../plugins/utils/sourceSnapshot'

/** 提交边界只观察已冻结的真实原生输入；不修改编译版本、账本或 watcher。 */
export function createSnapshotNativeScriptDriftProbe(sources: ReadonlyMap<string, string | null> | undefined, versions: ReadonlyMap<string, string>) {
  const raw = sources && getCompilerRawSnapshot(sources)
  const inputs = [...versions].flatMap(([file, consumed]) => {
    if (!raw?.files.has(file)) {
      return []
    }
    const frozen = raw.reads.get(file)
    return [{ file, consumed, frozenVersion: frozen && compilerNativeScriptVersion(frozen.source) === consumed ? frozen.version : undefined }]
  })
  return () => {
    const drift = new Map<string, string | null>()
    for (const { file, consumed, frozenVersion } of inputs) {
      try {
        if (frozenVersion && compilerRawFileVersion(statSync(file, { bigint: true })) === frozenVersion) {
          continue
        }
        const current = readCompilerRawInput(file)
        if (current) {
          const version = compilerNativeScriptVersion(current.source)
          if (version !== consumed) {
            drift.set(file, version)
          }
        }
        else {
          drift.set(file, null)
        }
      }
      catch (error) {
        if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) {
          drift.set(file, null)
        }
        else {
          throw error
        }
      }
    }
    return drift
  }
}
