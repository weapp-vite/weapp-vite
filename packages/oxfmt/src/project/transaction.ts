import type { FormatCandidate } from './prepare'
import * as fs from 'node:fs/promises'
import path from 'node:path'

type TransactionIO = Pick<typeof fs, 'readFile' | 'writeFile' | 'mkdtemp' | 'stat' | 'rename' | 'rm'>

/** 同卷暂存新旧完整内容，所有暂存成功后才原子替换；回滚只触及仍归本次操作的内容。 */
export async function commitFormatting(candidates: FormatCandidate[], io: TransactionIO = fs) {
  const staged: { candidate: FormatCandidate, directory: string, next: string, previous: string }[] = []
  const written: typeof staged = []
  const failures: unknown[] = []
  try {
    for (const candidate of candidates.filter(item => item.source !== item.formatted)) {
      const directory = await io.mkdtemp(path.join(path.dirname(candidate.file), '.weapp-vite-format-'))
      const entry = { candidate, directory, next: path.join(directory, 'next'), previous: path.join(directory, 'previous') }
      staged.push(entry)
      const { mode } = await io.stat(candidate.file)
      await io.writeFile(entry.previous, candidate.source, { mode })
      await io.writeFile(entry.next, candidate.formatted, { mode })
    }
    for (const candidate of candidates) {
      if (await io.readFile(candidate.file, 'utf8') !== candidate.source) {
        throw new Error('格式化期间项目文件发生变化，拒绝覆盖')
      }
    }
    for (const entry of staged) {
      if (await io.readFile(entry.candidate.file, 'utf8') !== entry.candidate.source) {
        throw new Error('格式化期间项目文件发生变化，拒绝覆盖')
      }
      await io.rename(entry.next, entry.candidate.file)
      written.push(entry)
    }
  }
  catch (error) {
    failures.push(error)
    for (const entry of written.reverse()) {
      try {
        if (await io.readFile(entry.candidate.file, 'utf8') === entry.candidate.formatted) {
          await io.rename(entry.previous, entry.candidate.file)
        }
      }
      catch (restoreError) {
        failures.push(restoreError)
      }
    }
  }
  finally {
    for (const entry of staged) {
      try {
        await io.rm(entry.directory, { recursive: true, force: true })
      }
      catch (cleanupError) {
        failures.push(cleanupError)
      }
    }
  }
  if (failures.length) {
    throw new AggregateError(failures, '格式化写入失败，已回滚仍归本次写入的文件')
  }
}
