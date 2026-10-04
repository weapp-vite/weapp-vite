import type { BenchSessionResource } from './resources'
import type { BenchScenarioSummary, BenchUpdateSample, WorkerResult } from './types'
import fs from 'node:fs/promises'
import path from 'node:path'
import { assertBenchResourcesClosed } from './resources'

export interface BenchWorkerEvidence {
  schemaVersion: 1
  status: 'running' | 'passed' | 'failed'
  samples: Array<{
    scenario: string
    index: number
    sample: BenchUpdateSample | NonNullable<BenchScenarioSummary['samples']>[number]
  }>
  failures: string[]
  attemptFailures: Array<{ attempt: number, label: string, error: string }>
  cleanupErrors: string[]
  resources: BenchSessionResource[]
  metadata?: Pick<WorkerResult, 'runtime' | 'artifact'>
  result?: WorkerResult
}

export function describeBenchError(error: unknown): string {
  if (error instanceof AggregateError) {
    return `${error.message}: ${error.errors.map(describeBenchError).join('; ')}`
  }
  return error instanceof Error ? error.message : String(error)
}

/** 每次完成样本后原子落盘；后续场景失败不会丢失先前原始观测。 */
export function createBenchEvidence(filePath: string) {
  const evidence: BenchWorkerEvidence = { schemaVersion: 1, status: 'running', samples: [], failures: [], attemptFailures: [], cleanupErrors: [], resources: [] }
  const save = async () => {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    const temporaryPath = `${filePath}.tmp`
    await fs.writeFile(temporaryPath, `${JSON.stringify(evidence, null, 2)}\n`)
    await fs.rename(temporaryPath, filePath)
  }
  return {
    evidence,
    save,
    async onResource(resource: BenchSessionResource) {
      const index = evidence.resources.findIndex(item => item.id === resource.id)
      if (index === -1) {
        evidence.resources.push({ ...resource })
      }
      else {
        evidence.resources[index] = { ...resource }
      }
      await save()
    },
    onSample: (scenario: string) => async (sample: BenchWorkerEvidence['samples'][number]['sample'], index: number) => {
      evidence.samples.push({ scenario, index, sample })
      await save()
    },
    async onCleanupError(error: unknown) {
      const message = describeBenchError(error)
      if (!evidence.cleanupErrors.includes(message)) {
        evidence.cleanupErrors.push(message)
      }
      await save()
    },
    async onRetry({ attempt, error, label }: { attempt: number, error: unknown, label: string }) {
      const message = describeBenchError(error)
      evidence.attemptFailures.push({ attempt, label, error: message })
      evidence.failures.push(`${label}, attempt ${attempt}: ${message}`)
      await save()
    },
  }
}

/** 采样与资源释放各自留证，只有释放成功后才向父进程发布完整结果。 */
export async function finishBenchEvidence(
  journal: ReturnType<typeof createBenchEvidence>,
  operation: () => Promise<WorkerResult>,
  close: () => Promise<void>,
): Promise<WorkerResult> {
  const errors: unknown[] = []
  try {
    await journal.save()
    journal.evidence.result = await operation()
  }
  catch (error) {
    journal.evidence.failures.push(describeBenchError(error))
    errors.push(error)
  }
  finally {
    try {
      await close()
      if (journal.evidence.metadata?.runtime?.provider === 'devtools' || journal.evidence.result?.runtime?.provider === 'devtools') {
        assertBenchResourcesClosed(journal.evidence.resources)
      }
    }
    catch (error) {
      errors.push(error)
      await journal.onCleanupError(error)
    }
    journal.evidence.status = errors.length || journal.evidence.failures.length || journal.evidence.cleanupErrors.length ? 'failed' : 'passed'
    await journal.save()
  }
  if (!errors.length && journal.evidence.cleanupErrors.length) {
    errors.push(new Error(`Benchmark resource cleanup failed: ${journal.evidence.cleanupErrors.join('; ')}`))
  }
  if (!errors.length && journal.evidence.failures.length) {
    errors.push(new Error(`Benchmark contains failed attempts: ${journal.evidence.failures.join('; ')}`))
  }
  if (errors.length) {
    throw new AggregateError(errors, 'Runtime benchmark failed; inspect worker evidence')
  }
  return journal.evidence.result!
}

/** 缺失 checkpoint 可能表示 worker 尚未启动；其他读取错误不能降级成缺失。 */
export async function readBenchEvidence(filePath: string): Promise<BenchWorkerEvidence | undefined> {
  try {
    const evidence = JSON.parse(await fs.readFile(filePath, 'utf8')) as BenchWorkerEvidence
    if (evidence.schemaVersion !== 1 || !Array.isArray(evidence.samples)) {
      throw new Error('Invalid runtime benchmark worker evidence')
    }
    return evidence
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}
