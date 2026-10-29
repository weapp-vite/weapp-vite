import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { ClassicLeaseCleanupError, cleanupClassicLeaseProject } from './classicLeaseRecovery'
import { runCleanupSteps } from './cleanupSteps'

it('restores files and environment after release failure and preserves all failures', async () => {
  const events: string[] = []
  const stopError = new Error('stop failed')
  const restoreError = new Error('restore failed')
  const output = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  try {
    const cleanup = runCleanupSteps([
      { label: 'stop', run: async () => {
        events.push('stop')
        throw stopError
      } },
      { label: 'restore', run: async () => {
        events.push('restore')
        throw restoreError
      } },
      { label: 'environment', run: () => { events.push('environment') } },
    ])
    await expect(cleanup).rejects.toMatchObject({
      errors: [expect.objectContaining({ cause: stopError }), expect.objectContaining({ cause: restoreError })],
    })
    expect(events).toEqual(['stop', 'restore', 'environment'])
    expect(output).toHaveBeenLastCalledWith(expect.stringContaining('environment status=passed'))
  }
  finally {
    output.mockRestore()
  }
})

it.each([false, true])('finishes other resources and preserves only uncertain classic cleanup evidence (uncertain=%s)', async (uncertain) => {
  const project = await mkdtemp(path.join(os.tmpdir(), 'classic-lease-cleanup-'))
  const journal = path.join(project, 'journal.json')
  const firstError = uncertain
    ? new AggregateError([new Error('product failed'), new ClassicLeaseCleanupError(new Error('unknown child state'))], 'preparation failed')
    : new Error('product failed')
  const events: string[] = []
  try {
    await writeFile(journal, 'owned cleanup evidence')
    await cleanupClassicLeaseProject(project, () => runCleanupSteps([
      { label: 'another registered CLI', run: () => { events.push('CLI') } },
      { label: 'registered IDE', run: () => { events.push('IDE') } },
    ]), firstError)
    expect(events).toEqual(['CLI', 'IDE'])
    if (uncertain) {
      expect(await readFile(journal, 'utf8')).toBe('owned cleanup evidence')
    }
    else {
      await expect(access(project)).rejects.toMatchObject({ code: 'ENOENT' })
    }
  }
  finally {
    await rm(project, { recursive: true, force: true })
  }
})

it('retains both the product failure and cleanup failure while preserving the classic project', async () => {
  const project = await mkdtemp(path.join(os.tmpdir(), 'classic-lease-cleanup-errors-'))
  const firstError = new Error('classic startup failed')
  const cleanupError = new Error('registered CLI cleanup failed')
  const events: string[] = []
  try {
    const failure: unknown = await cleanupClassicLeaseProject(project, () => runCleanupSteps([
      { label: 'registered CLI', run: () => { throw cleanupError } },
      { label: 'registered IDE', run: () => { events.push('IDE closed') } },
    ]), firstError).catch((error: unknown) => error)
    expect(failure).toMatchObject({
      cause: firstError,
      errors: [firstError, expect.objectContaining({ errors: [expect.objectContaining({ cause: cleanupError })] })],
    })
    expect(events).toEqual(['IDE closed'])
    await expect(access(project)).resolves.toBeUndefined()
  }
  finally {
    await rm(project, { recursive: true, force: true })
  }
})
