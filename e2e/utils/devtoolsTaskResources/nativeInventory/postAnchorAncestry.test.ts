import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNativeInventory } from './closure'
import { fixtureInstallation, fixtureSelected } from './fixture'
import { normalizeNativeFrame } from './model'
import { postAnchorFrames, setRowIdentity } from './postAnchorFixture'
import { summarizeNativeInventory } from './summary'

beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(0))
afterEach(() => vi.restoreAllMocks())

describe('post-anchor proof never infers foreign ownership from an incomplete ancestor', () => {
  it.each(['late', 'absence', 'selected', 'cycle', 'unknown-parent', 'uid', 'task-uid', 'start', 'parent', 'path-error', 'permission', 'extra-gap', 'text-conflict'] as const)('rejects ancestor %s', (kind) => {
    const frames = postAnchorFrames('closure2', 33)
    const rows = frames.map(frame => frame.rows.find(row => row.pid === 33)!)
    if (kind === 'late' || kind === 'absence') {
      for (const index of kind === 'late' ? [0, 1, 2] : [1]) {
        frames[index]!.rows = frames[index]!.rows.filter(row => row.pid !== 33)
      }
      if (kind === 'late') {
        // 祖先与子进程同帧出现允许；这里让子进程先在 closure1 出现。
        const earlier = postAnchorFrames('closure1', 33)[2]!.rows.find(row => row.pid === 22)!
        frames[2]!.rows.push(earlier)
      }
    }
    else if (kind === 'selected' || kind === 'path-error') {
      rows[0]!.pathBefore.executable = kind === 'selected' ? fixtureSelected : null
    }
    else if (kind === 'cycle' || kind === 'unknown-parent') {
      rows.forEach(row => setRowIdentity(row, { parentPid: kind === 'cycle' ? 22 : 77 }))
    }
    else if (kind === 'uid' || kind === 'start' || kind === 'parent') {
      setRowIdentity(rows[3]!, kind === 'uid' ? { uid: 502 } : kind === 'start' ? { startedMicroseconds: '654321' } : { parentPid: 77 })
    }
    else if (kind === 'task-uid') {
      rows[0]!.task.identity!.uid++
    }
    else if (kind === 'permission') {
      rows[0]!.task = { count: 0, errno: 1, identity: null, rssBytes: null }
    }
    else if (kind === 'extra-gap') {
      rows[0]!.gaps.push('rss-identity-mismatch')
    }
    const inventory = createNativeInventory(fixtureInstallation)
    frames.forEach(frame => inventory.observe(normalizeNativeFrame(frame)))
    if (kind === 'text-conflict') {
      inventory.observeTextImages(33, ['/System/Library/ConflictingForeign'], 'closure1')
    }
    const report = summarizeNativeInventory({ inventory, installationRoot: fixtureInstallation, samplingStartedAt: 'fixture', deadline: 10_000, textProofs: [], textObservations: [] })
    expect(report.verifiedPostAnchorForeignProcesses).toEqual([])
    expect(report.closureOwnership.status).toBe('unavailable')
    expect(report.installationRssBytes.status).toBe('unavailable')
  })
})
