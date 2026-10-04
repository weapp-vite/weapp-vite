import type { WorkerResult } from './runtimeBench/types'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBenchEvidence, finishBenchEvidence, readBenchEvidence } from './runtimeBench/evidence'

const roots: string[] = []

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'runtime-bench-evidence-unit-'))
  roots.push(root)
  const file = path.join(root, 'evidence.json')
  return { file, journal: createBenchEvidence(file) }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

describe('runtime benchmark incremental evidence', () => {
  it('persists earlier raw samples and both collection and cleanup failures', async () => {
    const { file, journal } = await fixture()
    const raw = { wallMs: 15, readyMs: 5, firstCommitMs: null }
    const operation = async (): Promise<WorkerResult> => {
      await journal.onSample('firstScreen')(raw, 0)
      expect((await readBenchEvidence(file))?.samples).toEqual([{ scenario: 'firstScreen', index: 0, sample: raw }])
      throw new Error('second sample failed')
    }
    const close = vi.fn(async () => {
      throw new Error('owned host close failed')
    })
    await expect(finishBenchEvidence(journal, operation, close)).rejects.toThrow('Runtime benchmark failed')
    expect(close).toHaveBeenCalledOnce()
    expect(await readBenchEvidence(file)).toMatchObject({
      status: 'failed',
      samples: [{ scenario: 'firstScreen', index: 0, sample: raw }],
      failures: ['second sample failed'],
      cleanupErrors: ['owned host close failed'],
    })
  })

  it('does not publish a result before close finishes and preserves results on close failure', async () => {
    const { file, journal } = await fixture()
    const result = { schemaVersion: 2, project: 'mock' } as WorkerResult
    await expect(finishBenchEvidence(journal, async () => result, async () => {
      expect(journal.evidence.status).toBe('running')
      throw new Error('close rejected')
    })).rejects.toThrow('Runtime benchmark failed')
    expect(await readBenchEvidence(file)).toMatchObject({ status: 'failed', result, cleanupErrors: ['close rejected'] })
  })

  it('archives successful evidence after close and does not invent first-commit timing', async () => {
    const { file, journal } = await fixture()
    const result = { schemaVersion: 2, project: 'mock' } as WorkerResult
    await journal.onSample('detailNavigation')({ wallMs: 12, readyMs: 4, firstCommitMs: null }, 0)
    expect(await finishBenchEvidence(journal, async () => result, async () => {})).toBe(result)
    expect(await readBenchEvidence(file)).toMatchObject({ status: 'passed', result, samples: [{ sample: { firstCommitMs: null } }] })
    await expect(readBenchEvidence(`${file}.absent`)).resolves.toBeUndefined()
    await fs.writeFile(file, '{}')
    await expect(readBenchEvidence(file)).rejects.toThrow('Invalid runtime benchmark worker evidence')
  })

  it('rejects standalone worker completion when a prior cleanup error was already recorded', async () => {
    const { file, journal } = await fixture()
    await journal.onCleanupError(new Error('previous host close rejected'))
    const result = { schemaVersion: 2, project: 'mock' } as WorkerResult
    await expect(finishBenchEvidence(journal, async () => result, async () => {})).rejects.toThrow('Runtime benchmark failed')
    expect(await readBenchEvidence(file)).toMatchObject({ status: 'failed', result, cleanupErrors: ['previous host close rejected'] })
  })
})
