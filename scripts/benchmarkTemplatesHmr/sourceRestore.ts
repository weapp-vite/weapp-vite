import { readFile, writeFile } from 'node:fs/promises'

/** 只恢复尚未还原的源码，避免清理写入触发下一场景的额外 HMR。 */
export async function restoreBenchmarkSource(filename: string, original: string) {
  if (await readFile(filename, 'utf8') === original) {
    return false
  }
  await writeFile(filename, original, 'utf8')
  return true
}
