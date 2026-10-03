import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { redactSequenceEvidenceText } from './evidenceRedaction'

export interface SequenceEntryFailure {
  phase: 'run' | 'profile' | 'cleanup'
  message: string
  stack?: string
}

interface SequenceEntryState {
  status: string
  errors?: SequenceEntryFailure[]
}

/** 执行、取证、清理各自记录错误；后续失败不能替换主错误，也不能提前宣告通过。 */
export async function completeSequenceEntry(entry: SequenceEntryState, actions: {
  run: () => Promise<void>
  profile: () => Promise<void>
  cleanup: () => Promise<void>
  fixtureRoot: () => string
}) {
  entry.status = 'failed'
  entry.errors = []
  for (const phase of ['run', 'profile', 'cleanup'] as const) {
    try {
      await actions[phase]()
    }
    catch (error) {
      entry.errors.push({
        phase,
        message: redactSequenceEvidenceText(error instanceof Error ? error.message : String(error), actions.fixtureRoot()),
        stack: error instanceof Error && error.stack ? redactSequenceEvidenceText(error.stack, actions.fixtureRoot()) : undefined,
      })
    }
  }
  entry.status = entry.errors.length ? 'failed' : 'passed'
}

/** 最外层 finally 持久化当前快照，即使准备、取证或清理异常仍保留部分证据。 */
export async function preserveSequenceReport(run: () => Promise<void>, reportFile: string | undefined, snapshot: () => unknown) {
  try {
    await run()
  }
  finally {
    if (reportFile) {
      await mkdir(path.dirname(reportFile), { recursive: true })
      await writeFile(reportFile, `${JSON.stringify(snapshot(), null, 2)}\n`)
    }
  }
}
