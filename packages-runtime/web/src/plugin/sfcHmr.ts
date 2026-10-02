import type { ScanState } from './types'
import { normalizePath } from './path'
import { resolveWebVueSfcStyleLanguage } from './vueSfc'

/** 将外部 SFC 块还原为其注册模块和合成样式，交给 Vite 的 HMR 传播与写入生命周期。 */
export function collectSfcHmrFiles(state: ScanState, changedFile: string) {
  const changed = normalizePath(changedFile)
  const files = new Set<string>()
  for (const [filename, result] of state.sfcResults) {
    if (filename !== changed && !result.meta?.sfcSrcDeps?.some(dependency => normalizePath(dependency) === changed)) {
      continue
    }
    files.add(filename)
    files.add(`${filename}.${resolveWebVueSfcStyleLanguage(result, filename)}`)
  }
  return files
}
