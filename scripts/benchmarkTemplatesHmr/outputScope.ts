import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

interface OutputFile {
  sha256: string
  bytes: number
}
type Manifest = Record<string, OutputFile>

/** 在计时窗口外读取实际磁盘集合；只描述字节变化，不冒充 bundler 的所有写入调用。 */
export async function snapshotBenchmarkOutputs(outDir: string): Promise<Manifest> {
  const result: Manifest = {}
  for (const entry of await readdir(outDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) {
      continue
    }
    const file = path.join(entry.parentPath, entry.name)
    const bytes = await readFile(file)
    result[path.relative(outDir, file).replaceAll('\\', '/')] = { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length }
  }
  return result
}

export function compareBenchmarkOutputs(before: Manifest, after: Manifest) {
  const added = Object.keys(after).filter(file => !before[file]).sort()
  const changed = Object.keys(after).filter(file => before[file] && before[file].sha256 !== after[file]!.sha256).sort()
  const removed = Object.keys(before).filter(file => !after[file]).sort()
  return { added, changed, removed, changedBytes: [...added, ...changed].reduce((sum, file) => sum + after[file]!.bytes, 0) }
}
