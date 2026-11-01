import type { ProcessEntry } from './windowsProcessTree'
import { describe, expect, it, vi } from 'vitest'
import { collectWindowsProcessTree, UnconfirmedDevProcessTreeError } from './windowsProcessTree'

function entry(pid: number, ppid: number, fraction: string): ProcessEntry {
  const started = `2026-10-08T00:00:00.${fraction}Z`
  return { pid, ppid, started, identity: { pid, started, executable: 'fixture-node.exe' } }
}

async function captureUnconfirmed(operation: Promise<unknown>) {
  const error = await operation.catch((cause: unknown) => cause)
  if (!(error instanceof UnconfirmedDevProcessTreeError)) {
    throw new Error('Expected an unconfirmed process tree failure.')
  }
  return error
}

describe('Windows process generation ancestry', () => {
  it('keeps real descendants while excluding a reused PID parent cycle with an older generation', async () => {
    const root = entry(61, 71, '0000200')
    const child = entry(62, 61, '0000300')
    const external = entry(71, 62, '0000100')
    const inspect = vi.fn()
    expect(await collectWindowsProcessTree(61, [root, child, external], inspect)).toEqual([child, root])
    expect(inspect).not.toHaveBeenCalled()
  })

  it('does not claim an older unrelated child even without a cycle or executable metadata', async () => {
    const root = entry(61, 1, '0000200')
    const external = { ...entry(71, 61, '0000100'), identity: undefined }
    const inspect = vi.fn()
    expect(await collectWindowsProcessTree(61, [root, external], inspect)).toEqual([root])
    expect(inspect).not.toHaveBeenCalled()
  })

  it('does not keep a proven external generation in recovery candidates when another branch fails', async () => {
    const root = entry(61, 1, '0000200')
    const child = { ...entry(62, 61, '0000300'), identity: undefined }
    const external = entry(71, 61, '0000100')
    const externalChild = entry(72, 71, '0000400')
    await expect(collectWindowsProcessTree(61, [root, child, external, externalChild], vi.fn().mockResolvedValue([child]))).rejects.toMatchObject({ pids: [62] })
  })

  it('preserves 100ns creation ordering instead of rounding different generations to milliseconds', async () => {
    const root = entry(61, 1, '1234567')
    const earlier = entry(71, 61, '1234566')
    const later = entry(62, 61, '1234568')
    expect(await collectWindowsProcessTree(61, [root, earlier, later], vi.fn())).toEqual([later, root])
  })

  it('keeps unresolved equal-time cycles blocked', async () => {
    const root = entry(61, 62, '0000200')
    const child = entry(62, 61, '0000200')
    await expect(collectWindowsProcessTree(61, [root, child], vi.fn())).rejects.toMatchObject({
      pids: [62],
      cause: expect.objectContaining({ message: expect.stringContaining('unresolved parent cycle') }),
    })
  })

  it('rechecks a missing candidate identity once and requires the same parent and generation', async () => {
    const root = entry(61, 1, '0000200')
    const child = entry(62, 61, '0000300')
    const inspect = vi.fn().mockResolvedValue([child])
    expect(await collectWindowsProcessTree(61, [root, { ...child, identity: undefined }], inspect)).toEqual([child, root])
    expect(inspect).toHaveBeenCalledExactlyOnceWith([62])
  })

  it.each(['duplicate', 'parent', 'generation', 'metadata', 'inspection'] as const)('preserves the actual %s reinspection result without changing rejection', async (kind) => {
    const root = entry(61, 1, '0000208')
    const child = entry(62, 61, '0000309')
    const unexpected = entry(99, 1, '0000500')
    unexpected.identity!.executable = 'unexpected-private/process.exe'
    const current = kind === 'duplicate'
      ? [child, unexpected]
      : kind === 'parent'
        ? [{ ...child, ppid: 99 }]
        : kind === 'generation'
          ? [entry(62, 61, '0000409')]
          : [{ ...child, identity: undefined }]
    const cause = new Error('private-provider-message')
    const inspect = vi.fn().mockResolvedValue(current)
    if (kind === 'inspection') {
      inspect.mockRejectedValue(cause)
    }
    const failure = await captureUnconfirmed(collectWindowsProcessTree(61, [root, { ...child, identity: undefined }], inspect))
    const diagnostic = failure.diagnostics[0]!
    expect(failure.pids).toEqual([62])
    expect(diagnostic.guard.stage).toBe(kind === 'duplicate' ? 'duplicate-reinspection' : kind === 'inspection' ? 'identity-reinspection' : 'reinspection-contract')
    expect(diagnostic.guard.entry).toMatchObject({ pid: 62, ppid: 61, started: child.started, identityPresent: false })
    expect(diagnostic.guard.ancestorPath.map(row => row.pid)).toEqual([61, 62])
    expect(diagnostic.reinspections).toHaveLength(1)
    const reinspection = diagnostic.reinspections[0]!
    expect(reinspection).toMatchObject({ requestedPids: [62], completedAt: expect.any(String), status: kind === 'inspection' ? 'failed' : 'returned' })
    if (kind === 'inspection') {
      expect(failure.cause).toBe(cause)
      expect(reinspection.rows).toBeNull()
    }
    else {
      expect(reinspection.rows?.map(row => row.pid)).toEqual(kind === 'duplicate' ? [62, 99] : [62])
      expect(reinspection.rows?.[0]).toMatchObject({
        ppid: kind === 'parent' ? 99 : 61,
        started: kind === 'generation' ? '2026-10-08T00:00:00.0000409Z' : child.started,
        identityPresent: kind !== 'metadata',
      })
    }
    expect(inspect).toHaveBeenCalledExactlyOnceWith([62])
    expect(JSON.stringify(diagnostic)).not.toContain('private-provider-message')
    expect(JSON.stringify(diagnostic)).not.toContain('unexpected-private/process.exe')
  })

  it('confirms an exited candidate through the provider while preserving its verified descendant ancestry', async () => {
    const root = entry(61, 1, '0000200')
    const child = { ...entry(62, 61, '0000300'), identity: undefined }
    const grandchild = entry(63, 62, '0000400')
    const inspect = vi.fn().mockResolvedValue([])
    expect(await collectWindowsProcessTree(61, [root, child, grandchild], inspect)).toEqual([grandchild, root])
    expect(inspect).toHaveBeenCalledExactlyOnceWith([62])
  })

  it('retains the actual unknown parent and traversal ancestry without exporting unrelated processes', async () => {
    const root = entry(61, 1, '0000208')
    root.identity!.executable = 'owned-private/root.exe'
    const completedBranch = entry(64, 61, '0000250')
    const child = { pid: 62, ppid: 61 }
    const grandchild = entry(63, 62, '0000409')
    const unrelated = entry(71, 1, '0000100')
    unrelated.identity!.executable = 'unrelated-private/never-record.exe'
    const inspect = vi.fn().mockResolvedValue([])
    const failure = await captureUnconfirmed(collectWindowsProcessTree(61, [root, completedBranch, child, grandchild, unrelated], inspect))
    expect(failure.cause).toMatchObject({ message: 'Dev process parent generation is unknown; descendants remain unconfirmed.' })
    expect([...failure.pids].sort((left, right) => left - right)).toEqual([62, 63, 64])
    expect(failure.diagnostics).toHaveLength(1)
    const diagnostic = failure.diagnostics[0]!
    expect(diagnostic.guard).toMatchObject({
      stage: 'unknown-parent-generation',
      subjectPid: 62,
      entry: { pid: 62, ppid: 61, started: null, identityStarted: null, identityPresent: false },
      parentGeneration100ns: (BigInt(Date.parse('2026-10-08T00:00:00Z')) * 10_000n + 208n).toString(),
      childrenPids: [63],
    })
    expect(diagnostic.guard.ancestorPath.map(row => [row.pid, row.ppid])).toEqual([[61, 1], [62, 61]])
    expect(diagnostic.initialRows.map(row => row.pid).sort((left, right) => left - right)).toEqual([61, 62, 63, 64])
    expect(diagnostic.initialRows.find(row => row.pid === 63)?.started).toBe('2026-10-08T00:00:00.0000409Z')
    expect(failure.candidates.find(candidate => candidate.pid === 63)?.started).toBe('2026-10-08T00:00:00.0000400Z')
    expect(diagnostic.reinspections).toEqual([expect.objectContaining({ requestedPids: [62], status: 'returned', rows: [], completedAt: expect.any(String) })])
    expect(diagnostic.nativeErrorCodeAvailable).toBe(false)
    expect(inspect).toHaveBeenCalledExactlyOnceWith([62])
    const serialized = JSON.stringify(diagnostic)
    expect(serialized).not.toContain('owned-private/root.exe')
    expect(serialized).not.toContain('unrelated-private/never-record.exe')
    expect(JSON.stringify(failure)).not.toContain('unrelated-private/never-record.exe')
  })

  it.each(['invalid', '2026-02-30T00:00:00.0000000Z'])('rejects malformed creation time %s', async (started) => {
    const root = entry(61, 1, '0000200')
    const child = { ...entry(62, 61, '0000300'), started }
    const inspect = vi.fn()
    const failure = await captureUnconfirmed(collectWindowsProcessTree(61, [root, child], inspect))
    expect(failure.diagnostics[0]?.guard).toMatchObject({ stage: 'initial-creation-time', subjectPid: 62, entry: { pid: 62, ppid: 61, started } })
    expect(failure.diagnostics[0]?.guard.ancestorPath.map(row => row.pid)).toEqual([61, 62])
    expect(inspect).not.toHaveBeenCalled()
  })
})
