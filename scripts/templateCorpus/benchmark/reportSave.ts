import { open, rename } from 'node:fs/promises'
import path from 'node:path'

/** 新报告先完整写入独立文件并同步，再原子替换；取消或写入失败不会截断上一份报告。 */
export async function atomicReport(file: string, value: unknown): Promise<void> {
  const content = `${JSON.stringify(value, null, 2)}\n`
  const temporary = `${file}.next`
  const handle = await open(temporary, 'w')
  try {
    await handle.writeFile(content)
    await handle.sync()
  }
  finally {
    await handle.close()
  }
  await rename(temporary, file)
}

/** 最后一次报告保存失败也返回明确结论；保留旧报告，并尽力写入独立的小型失败证据。 */
export async function saveFinalReport(file: string, value: unknown, describe: (error: unknown) => string = String): Promise<{ saved: true } | { saved: false, error: string, evidence: string, evidenceError?: string }> {
  try {
    await atomicReport(file, value)
    return { saved: true }
  }
  catch (error) {
    const evidence = path.join(path.dirname(file), 'report-save-error.json')
    const failure = { saved: false as const, error: describe(error), evidence }
    try {
      await atomicReport(evidence, { schemaVersion: 1, status: 'failed', phase: 'final-report-save', report: path.basename(file), error: failure.error })
      return failure
    }
    catch (evidenceError) {
      return { ...failure, evidenceError: describe(evidenceError) }
    }
  }
}
