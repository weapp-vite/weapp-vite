import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { completeSequenceEntry, preserveSequenceReport } from './reportLifecycle'

it('persists partial observations and all failures after run, profile and cleanup errors', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sequence-report-'))
  try {
    const entry = { status: 'failed', steps: [] as string[] }
    const phases: string[] = []
    const reportFile = path.join(root, 'reports/partial.json')
    await preserveSequenceReport(async () => {
      await completeSequenceEntry(entry, {
        fixtureRoot: () => root,
        run: async () => {
          entry.steps.push('observed first edit')
          phases.push('run')
          throw new Error(`build failed in ${root}`)
        },
        profile: async () => {
          phases.push('profile')
          throw new Error(`profile read denied at ${encodeURIComponent(root)}`)
        },
        cleanup: async () => {
          phases.push('cleanup')
          throw new Error(`cleanup locked ${root}`)
        },
      })
    }, reportFile, () => ({ entries: [entry] }))
    const saved: unknown = JSON.parse(await readFile(reportFile, 'utf8'))
    expect(saved).toMatchObject({ entries: [{ status: 'failed', steps: ['observed first edit'], errors: [
      { phase: 'run', message: 'build failed in <fixture>' },
      { phase: 'profile', message: 'profile read denied at <fixture>' },
      { phase: 'cleanup', message: 'cleanup locked <fixture>' },
    ] }] })
    expect(phases).toEqual(['run', 'profile', 'cleanup'])
    expect(JSON.stringify(saved)).not.toContain(root)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('does not declare success until collection and cleanup have completed', async () => {
  const entry = { status: 'failed' }
  const statuses: string[] = []
  await completeSequenceEntry(entry, {
    fixtureRoot: () => os.tmpdir(),
    run: async () => { statuses.push(entry.status) },
    profile: async () => { statuses.push(entry.status) },
    cleanup: async () => { statuses.push(entry.status) },
  })
  expect(statuses).toEqual(['failed', 'failed', 'failed'])
  expect(entry.status).toBe('passed')
})

it.each(['profile', 'cleanup'] as const)('fails completed observations when %s fails', async (failedPhase) => {
  const entry = { status: 'failed', steps: ['all observations passed'] }
  const fail = async () => {
    throw new Error('post-run failure')
  }
  await completeSequenceEntry(entry, {
    fixtureRoot: () => os.tmpdir(),
    run: async () => {},
    profile: failedPhase === 'profile' ? fail : async () => {},
    cleanup: failedPhase === 'cleanup' ? fail : async () => {},
  })
  expect(entry).toMatchObject({ status: 'failed', steps: ['all observations passed'], errors: [{ phase: failedPhase, message: 'post-run failure' }] })
})

it('writes an available snapshot before propagating an unexpected orchestration error', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sequence-report-'))
  try {
    const reportFile = path.join(root, 'partial.json')
    const error = new Error('unexpected preparation failure')
    await expect(preserveSequenceReport(async () => {
      throw error
    }, reportFile, () => ({ completedSteps: 2 }))).rejects.toBe(error)
    expect(JSON.parse(await readFile(reportFile, 'utf8')) as unknown).toEqual({ completedSteps: 2 })
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
