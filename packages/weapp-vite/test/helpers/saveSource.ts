import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import { renameAtomicFile } from '../../../../scripts/utils/atomicRename'

/** 完整写入临时源码后原子发布，避免 watcher 将截断阶段当作一次编辑。 */
export async function saveSource(filename: string, content: string): Promise<void> {
  const temporary = `${filename}.${randomUUID()}.tmp`
  try {
    await fs.writeFile(temporary, content)
    await renameAtomicFile(temporary, filename)
  }
  finally {
    await fs.rm(temporary, { force: true })
  }
}
