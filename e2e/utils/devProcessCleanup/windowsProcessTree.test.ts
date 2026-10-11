import type { ProcessEntry } from './windowsProcessTree'
import { describe, expect, it, vi } from 'vitest'
import { collectWindowsProcessTree, UnconfirmedDevProcessTreeError } from './windowsProcessTree'

function entry(pid: number, ppid: number, fraction: string): ProcessEntry {
  const started = `2026-10-08T00:00:00.${fraction}Z`
  return { pid, ppid, started, identity: { pid, started, executable: 'fixture-node.exe' } }
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

  it.each(['parent', 'generation', 'metadata', 'inspection'] as const)('retains unconfirmed ownership when candidate %s cannot be verified', async (failure) => {
    const root = entry(61, 1, '0000200')
    const child = entry(62, 61, '0000300')
    const inspect = vi.fn().mockResolvedValue([
      failure === 'parent'
        ? { ...child, ppid: 99 }
        : failure === 'generation'
          ? entry(62, 61, '0000400')
          : { ...child, identity: undefined },
    ])
    if (failure === 'inspection') {
      inspect.mockRejectedValue(new Error('CIM inspection denied'))
    }
    await expect(collectWindowsProcessTree(61, [root, { ...child, identity: undefined }], inspect)).rejects.toMatchObject({ pids: [62] })
    expect(inspect).toHaveBeenCalledExactlyOnceWith([62])
  })

  it('confirms an exited candidate through the provider while preserving its verified descendant ancestry', async () => {
    const root = entry(61, 1, '0000200')
    const child = { ...entry(62, 61, '0000300'), identity: undefined }
    const grandchild = entry(63, 62, '0000400')
    const inspect = vi.fn().mockResolvedValue([])
    expect(await collectWindowsProcessTree(61, [root, child, grandchild], inspect)).toEqual([grandchild, root])
    expect(inspect).toHaveBeenCalledExactlyOnceWith([62])
  })

  it('does not drop descendants behind an exited parent with unknown creation time', async () => {
    const root = entry(61, 1, '0000200')
    const child = { pid: 62, ppid: 61 }
    const grandchild = entry(63, 62, '0000400')
    await expect(collectWindowsProcessTree(61, [root, child, grandchild], vi.fn().mockResolvedValue([]))).rejects.toMatchObject({ pids: [62, 63] })
  })

  it.each(['invalid', '2026-02-30T00:00:00.0000000Z'])('rejects malformed creation time %s', async (started) => {
    const root = entry(61, 1, '0000200')
    const child = { ...entry(62, 61, '0000300'), started }
    await expect(collectWindowsProcessTree(61, [root, child], vi.fn())).rejects.toBeInstanceOf(UnconfirmedDevProcessTreeError)
  })
})
