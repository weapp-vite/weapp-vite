import type { WorkerResult } from './runtimeBench'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  createRecoverableSession,
  readRuntimeBenchCheckpoint,
  resolveRuntimeBenchCheckpointPath,

  writeRuntimeBenchCheckpoint,
} from './runtimeBench'

function createWorkerResult(project = 'runtime-bench-react'): WorkerResult {
  const update = {
    wallMsMedian: 1,
    metricMsMedian: 1,
    computeMsMedian: 0,
    commitMsMedian: 1,
    dispatchMsMedian: 1,
    flushMsMedian: 0,
    setDataCallsMedian: 1,
    setDataDiagnosticsMedian: {
      flushes: 0,
      patchFlushes: 0,
      diffFlushes: 0,
      fallbackFlushes: 0,
      avgPayloadKeys: 0,
      maxPayloadKeys: 0,
      avgPendingPatchKeys: 0,
      maxPendingPatchKeys: 0,
      avgBytes: 0,
      maxBytes: 0,
    },
    fallbackReasons: {},
  }
  return {
    project,
    firstScreen: { wallMsMedian: 1, readyMsMedian: 1, firstCommitMsMedian: 1 },
    detailNavigation: { wallMsMedian: 1, readyMsMedian: 1, firstCommitMsMedian: 1 },
    updateSingleCommit: { diff: update },
    updateMicroCommit: { diff: update },
  }
}

describe('runtime benchmark recovery', () => {
  it('relaunches one session and reruns the whole failed sample', async () => {
    const sessions = [{ id: 1 }, { id: 2 }]
    const launch = vi.fn(async () => sessions.shift()!)
    const safeClose = vi.fn(async () => {})
    const onRetry = vi.fn(async () => {})
    const operation = vi.fn(async (session: { id: number }) => {
      if (session.id === 1) {
        throw new Error('Timeout in raw reLaunch /pages/index/index after 30000ms')
      }
      return session.id
    })
    const controller = await createRecoverableSession({
      launch,
      safeClose,
      onRetry,
      isRetryable: error => String(error).includes('raw reLaunch'),
    })

    await expect(controller.run('first screen sample 1/3', operation)).resolves.toBe(2)
    expect(operation).toHaveBeenCalledTimes(2)
    expect(launch).toHaveBeenCalledTimes(2)
    expect(safeClose).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({
      attempt: 1,
      label: 'first screen sample 1/3',
    }))
  })

  it('does not retry product errors', async () => {
    const launch = vi.fn(async () => ({ id: 1 }))
    const safeClose = vi.fn(async () => {})
    const controller = await createRecoverableSession({
      launch,
      safeClose,
      isRetryable: () => false,
    })

    await expect(controller.run('sample', async () => {
      throw new Error('benchmark assertion failed')
    })).rejects.toThrow('benchmark assertion failed')
    expect(launch).toHaveBeenCalledTimes(1)
    expect(safeClose).not.toHaveBeenCalled()
  })

  it('writes and resumes commit-scoped checkpoints', async () => {
    const checkpointRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'runtime-bench-checkpoint-'))
    const checkpointPath = resolveRuntimeBenchCheckpointPath({
      checkpointRoot,
      commit: 'abc123',
      project: 'runtime-bench-react',
      provider: 'devtools',
    })
    const result = createWorkerResult()

    await writeRuntimeBenchCheckpoint(checkpointPath, result)
    await expect(readRuntimeBenchCheckpoint(checkpointPath)).resolves.toEqual(result)
    await expect(readRuntimeBenchCheckpoint(`${checkpointPath}.missing`)).resolves.toBeUndefined()
  })
})
