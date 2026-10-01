import { randomUUID } from 'node:crypto'
import { rename, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { setTimeout } from 'node:timers/promises'
import { redactValue } from '@weapp-agent/core/project'

/** 通过一次临时文件写入和原子替换发布完整、已脱敏的报告。 */
export async function atomicJson(file: string, data: unknown, platform = process.platform): Promise<void> {
  const temp = `${file}.${randomUUID()}.tmp`
  await writeFile(temp, JSON.stringify(redactValue(data), null, 2), { mode: 0o600 })
  for (let retry = 0; ; retry++) {
    try {
      await rename(temp, file)
      return
    }
    catch (error) {
      if (platform !== 'win32' || retry >= 20 || !['EPERM', 'EACCES', 'EBUSY'].includes((error as NodeJS.ErrnoException).code ?? '')) {
        throw error
      }
      // 最多等待 1550ms，仅重试原子替换；保留旧报告与同一临时文件，不复制或双写。
      await setTimeout(Math.min((retry + 1) * 10, 100))
    }
  }
}
