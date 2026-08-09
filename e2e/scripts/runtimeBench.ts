import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

export interface BenchUpdateSummary {
  wallMsMedian: number
  metricMsMedian: number
  computeMsMedian: number
  commitMsMedian: number
  dispatchMsMedian: number
  flushMsMedian: number
  setDataCallsMedian: number
  setDataDiagnosticsMedian: {
    flushes: number
    patchFlushes: number
    diffFlushes: number
    fallbackFlushes: number
    avgPayloadKeys: number
    maxPayloadKeys: number
    avgPendingPatchKeys: number
    maxPendingPatchKeys: number
    avgBytes: number
    maxBytes: number
  }
  fallbackReasons: Record<string, number>
}

export interface WorkerResult {
  project: string
  firstScreen: {
    wallMsMedian: number
    readyMsMedian: number
    firstCommitMsMedian: number
  }
  detailNavigation: {
    wallMsMedian: number
    readyMsMedian: number
    firstCommitMsMedian: number
  }
  updateSingleCommit: {
    diff: BenchUpdateSummary
    patch?: BenchUpdateSummary
  }
  updateMicroCommit: {
    diff: BenchUpdateSummary
    patch?: BenchUpdateSummary
  }
  staticBinding?: {
    updateSingleCommit: BenchUpdateSummary
    updateMicroCommit: BenchUpdateSummary
  }
}

export interface RecoverableSession<T> {
  close: () => Promise<void>
  run: <R>(label: string, operation: (session: T) => Promise<R>) => Promise<R>
}

export async function createRecoverableSession<T>(options: {
  isRetryable: (error: unknown) => boolean
  launch: () => Promise<T>
  maxAttempts?: number
  onRetry?: (context: { attempt: number, error: unknown, label: string }) => Promise<void> | void
  safeClose: (session: T) => Promise<void>
}): Promise<RecoverableSession<T>> {
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 2))
  let session = await options.launch()

  return {
    async close() {
      await options.safeClose(session)
    },
    async run(label, operation) {
      let lastError: unknown
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          return await operation(session)
        }
        catch (error) {
          lastError = error
          if (attempt >= maxAttempts || !options.isRetryable(error)) {
            throw error
          }
          await options.safeClose(session)
          await options.onRetry?.({ attempt, error, label })
          session = await options.launch()
        }
      }
      throw lastError
    },
  }
}

export function resolveRuntimeBenchCheckpointPath(options: {
  checkpointRoot: string
  commit: string
  project: string
  provider: string
}) {
  return path.join(options.checkpointRoot, options.commit, options.provider, `${options.project}.json`)
}

export async function readRuntimeBenchCheckpoint(filePath: string): Promise<WorkerResult | undefined> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as WorkerResult
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}

export async function writeRuntimeBenchCheckpoint(filePath: string, result: WorkerResult) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const temporaryPath = `${filePath}.${process.pid}.tmp`
  await fs.writeFile(temporaryPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  await fs.rename(temporaryPath, filePath)
}
