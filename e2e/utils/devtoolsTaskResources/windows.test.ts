import type { ManagedWechatProjectRecord } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/types'
import { describe, expect, it } from 'vitest'
import { summarizeTaskWindows } from './windows'

type JournalWindow = Parameters<typeof summarizeTaskWindows>[0][number]
const at = (second: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, second)).toISOString()

function record(id: string, start: number, end?: number): JournalWindow {
  return {
    id,
    createdAt: at(start),
    openedProjectWindow: true,
    windowClose: end === undefined ? undefined : { window: { nativeClosedAt: at(end), webContentsDestroyedAt: at(end + 1) } },
  } as JournalWindow
}

describe('IDE task window evidence', () => {
  it('keeps the configured budget, conservative intent overlap, and missing native sample distinct', () => {
    const usage = summarizeTaskWindows([record('first', 0, 4), record('second', 3, 8)], '1', at(10))
    expect(usage.managedBudget).toEqual({ status: 'observed', value: 1 })
    expect(usage.traceDerivedManagedOverlapUpperBound).toEqual({ status: 'observed', value: 2 })
    expect(usage.sampledNativeWindowMaximum.status).toBe('unavailable')
    expect(usage.semantics).toContain('launch intents')
    expect(usage.gaps).toEqual([])
  })

  it('does not reuse the budget as the measured overlap when intents do not overlap', () => {
    const usage = summarizeTaskWindows([record('first', 0, 2), record('second', 4, 6)], '2', at(10))
    expect(usage.managedBudget).toEqual({ status: 'observed', value: 2 })
    expect(usage.traceDerivedManagedOverlapUpperBound).toEqual({ status: 'observed', value: 1 })
  })

  it('holds an incomplete intent open and preserves the missing destruction evidence', () => {
    const usage = summarizeTaskWindows([record('unknown', 0), record('next', 4, 6)], undefined, at(10))
    expect(usage.traceDerivedManagedOverlapUpperBound).toEqual({ status: 'observed', value: 2 })
    expect(usage.gaps).toEqual([expect.stringContaining('no complete native/webContents destruction pair')])
  })

  it('does not count explicitly borrowed connections as owned launch intents', () => {
    const borrowed = { ...record('borrowed', 0), openedProjectWindow: false, releasedReason: 'borrowed' } satisfies Partial<ManagedWechatProjectRecord>
    expect(summarizeTaskWindows([borrowed], undefined, at(10)).traceDerivedManagedOverlapUpperBound).toEqual({ status: 'observed', value: 0 })
  })

  it('keeps invalid journal timestamps unavailable rather than reporting zero', () => {
    const invalid = { ...record('invalid', 0, 4), createdAt: 'invalid' }
    expect(summarizeTaskWindows([invalid], 'invalid', at(10))).toMatchObject({
      managedBudget: { status: 'unavailable' },
      traceDerivedManagedOverlapUpperBound: { status: 'unavailable' },
    })
  })
})
