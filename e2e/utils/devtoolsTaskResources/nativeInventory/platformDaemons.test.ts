import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNativeInventory } from './closure'
import { fixtureForeign, fixtureInstallation, fixtureSelected } from './fixture'
import { normalizeNativeFrame } from './model'
import { postAnchorFrames } from './postAnchorFixture'
import { summarizeNativeInventory } from './summary'

beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(0))
afterEach(() => vi.restoreAllMocks())

function daemonFrames() {
  const frames = postAnchorFrames('closure2')
  const row = frames[3]!.rows.find(row => row.pid === 22)!
  row.pathBefore = row.pathAfter = { count: fixtureForeign.length, errno: 0, executable: fixtureForeign }
  row.task = { count: 0, errno: 1, identity: null, rssBytes: null }
  row.absolute!.birthBefore = { result: -1, errno: 1, startedAtTicks: '3301', endedAtTicks: '3302', birthTicks: null, exitTicks: null }
  row.absolute!.birthAfter = { result: -1, errno: 1, startedAtTicks: '3380', endedAtTicks: '3381', birthTicks: null, exitTicks: null }
  row.confirmation = null
  row.gaps = ['enumeration-identity-changed', 'rss-unavailable']
  return frames
}

function summarize(frames: ReturnType<typeof daemonFrames>) {
  const inventory = createNativeInventory(fixtureInstallation)
  frames.forEach(frame => inventory.observe(normalizeNativeFrame(frame)))
  return summarizeNativeInventory({ inventory, installationRoot: fixtureInstallation, samplingStartedAt: 'fixture', deadline: 10_000, textProofs: [], textObservations: [] })
}

function selectedPath(frames: ReturnType<typeof daemonFrames>) {
  const row = frames[3]!.rows.find(row => row.pid === 22)!
  row.pathBefore = row.pathAfter = { count: fixtureSelected.length, errno: 0, executable: fixtureSelected }
}

function nonLaunchdParent(frames: ReturnType<typeof daemonFrames>) {
  const row = frames[3]!.rows.find(row => row.pid === 22)!
  row.enumeratedIdentity.parentPid = 33
  row.before.identity!.parentPid = 33
  row.after.identity!.parentPid = 33
}

function generationDrift(frames: ReturnType<typeof daemonFrames>) {
  const row = frames[3]!.rows.find(row => row.pid === 22)!
  row.after.identity!.startedMicroseconds = '654321'
}

function nonPermissionTaskFailure(frames: ReturnType<typeof daemonFrames>) {
  const row = frames[3]!.rows.find(row => row.pid === 22)!
  row.task.errno = 3
}

describe('platform daemon closure proof', () => {
  it('accepts a stable launchd child with denied task and birth reads as foreign', () => {
    const report = summarize(daemonFrames())
    expect(report).toMatchObject({
      installationRssBytes: { status: 'observed', value: 1000 },
      closureOwnership: { status: 'observed', value: 'verified' },
      verifiedPlatformDaemonProcessCount: 1,
      verifiedPlatformDaemonProcesses: [{ process: { pid: 22 }, deniedReads: 'task-rss-and-birth', phases: ['closure2'] }],
      newProcesses: [{ pid: 22, classification: 'verified-foreign' }],
    })
  })

  it.each([
    ['selected path', selectedPath],
    ['non-launchd parent', nonLaunchdParent],
    ['generation drift', generationDrift],
    ['non-permission task failure', nonPermissionTaskFailure],
  ])('rejects %s', (_name, mutate) => {
    const frames = daemonFrames()
    mutate(frames)
    const report = summarize(frames)
    expect(report.verifiedPlatformDaemonProcesses).toEqual([])
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.closureOwnership.status).toBe('unavailable')
  })

  it('requires every closure frame after a closure1 appearance', () => {
    const frames = postAnchorFrames('closure1')
    for (const index of [2, 3]) {
      const row = frames[index]!.rows.find(row => row.pid === 22)!
      row.pathBefore = row.pathAfter = { count: fixtureForeign.length, errno: 0, executable: fixtureForeign }
      row.task = { count: 0, errno: 1, identity: null, rssBytes: null }
      row.absolute!.birthBefore = { result: -1, errno: 1, startedAtTicks: '3301', endedAtTicks: '3302', birthTicks: null, exitTicks: null }
      row.absolute!.birthAfter = { result: -1, errno: 1, startedAtTicks: '3380', endedAtTicks: '3381', birthTicks: null, exitTicks: null }
      row.confirmation = null
      row.gaps = ['enumeration-identity-changed', 'rss-unavailable']
    }
    const report = summarize(frames)
    expect(report.verifiedPlatformDaemonProcesses).toEqual([])
    expect(report.closureOwnership.status).toBe('unavailable')
  })
})
