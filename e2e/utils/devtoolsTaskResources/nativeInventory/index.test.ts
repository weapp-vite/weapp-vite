import type { DarwinProcessEntry, DarwinProcessFrame } from '../processInventory/darwinInspector/types'
import type { InstallationProcessSample } from '../types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { entry, fixtureForeign, fixtureInstallation, fixtureSelected, frame } from './fixture'
import { sampleNativeInstallationProcesses } from './index'

const mocks = vi.hoisted(() => ({ prepare: vi.fn(), inspect: vi.fn(), read: vi.fn(), images: vi.fn(), realpath: vi.fn(), execute: vi.fn() }))
vi.mock('../processInventory/darwinInspector', () => ({ prepareDarwinInspector: mocks.prepare, withDarwinInspector: mocks.inspect }))
vi.mock('node:fs/promises', () => ({ default: { realpath: mocks.realpath } }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsTarget/host', () => ({ resolveWechatDevtoolsInstallationRoot: () => fixtureInstallation }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/darwin', () => ({ readDarwinTextImages: mocks.images }))
vi.mock('execa', () => ({ execa: mocks.execute }))

const target = {} as Parameters<typeof sampleNativeInstallationProcesses>[0]
const phases = ['prepare', 'anchor', 'closure1', 'closure2'] as const

function frames(...rows: DarwinProcessEntry[][]) {
  mocks.read.mockImplementation(async (phase: typeof phases[number]) => frame(phase, structuredClone(rows[phases.indexOf(phase)]!)))
}

async function sample(): Promise<InstallationProcessSample> {
  const result = await sampleNativeInstallationProcesses(target)
  expect(result.status, JSON.stringify(result)).toBe('observed')
  if (result.status !== 'observed') {
    throw new Error(result.reason)
  }
  expect(mocks.execute).not.toHaveBeenCalled()
  expect(mocks.read.mock.calls.map(([phase]) => phase)).toEqual(phases)
  return result.value
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(Date, 'now').mockReturnValue(0)
  mocks.realpath.mockResolvedValue(fixtureInstallation)
  mocks.prepare.mockResolvedValue({ executable: 'owned-test-helper' })
  mocks.inspect.mockImplementation(async (_deadline, consume) => consume({ readFrame: mocks.read }))
  mocks.images.mockRejectedValue(new Error('Fixture image lookup failed'))
  frames(...phases.map(() => [entry(11), entry(22)]))
})
afterEach(() => vi.restoreAllMocks())

describe('native resource inventory boundaries', () => {
  it('uses only anchor RSS bytes and preserves precise identity while discarding all other RSS', async () => {
    frames(...phases.map(phase => [entry(11, { rssBytes: phase === 'anchor' ? '1234' : '987654' }), entry(22, { rssBytes: null })]))
    expect(await sample()).toMatchObject({
      installationRssBytes: { status: 'observed', value: 1234 },
      processes: [{ rssBytes: 1234, startedSeconds: '1792800000', startedMicroseconds: '123456' }],
      inventoryRoundCount: 3,
      rssAnchor: 'single-native-anchor-frame; preparation-and-closure-rss-never-contribute',
      atomicity: expect.stringContaining('non-atomic'),
    })
    expect(mocks.images).not.toHaveBeenCalled()
  })

  it('keeps selected RSS permission failures unavailable rather than reporting zero', async () => {
    frames(...phases.map(() => [entry(11, { rssBytes: null }), entry(22)]))
    expect(await sample()).toMatchObject({ installationRssBytes: { status: 'unavailable' }, missingIdentities: [{ pid: 11, causes: [{ reason: 'rss-unavailable' }] }], processes: [] })
  })

  it.each([null, '0'])('blocks an unknown anchored image regardless of RSS (%s)', async (rssBytes) => {
    frames(...phases.map(() => [entry(11), entry(22, { executable: null, rssBytes })]))
    expect(await sample()).toMatchObject({ installationRssBytes: { status: 'unavailable' }, unclassifiedProcessCount: 1 })
  })

  it.each([false, true])('never inherits foreign classification from a verified parent (%s)', async (absentAfterAnchor) => {
    const baseline = [entry(11), entry(22)]
    const unknown = entry(33, { parentPid: 22, executable: null })
    frames(baseline, [...baseline, unknown], absentAfterAnchor ? baseline : [...baseline, unknown], absentAfterAnchor ? baseline : [...baseline, unknown])
    expect(await sample()).toMatchObject({
      installationRssBytes: { status: 'unavailable' },
      unclassifiedProcessCount: 1,
      newProcesses: [{ pid: 33, classification: 'unclassified', imageSource: 'not-verified' }],
    })
  })

  it('retains a complete anchor-bound foreign proof when that child exits before closure', async () => {
    const baseline = [entry(11), entry(22)]
    frames(baseline, [...baseline, entry(33, { parentPid: 22, rssBytes: null })], baseline, baseline)
    expect(await sample()).toMatchObject({ installationRssBytes: { status: 'observed', value: 1000 }, verifiedNewForeignProcessCount: 1, newProcesses: [{ pid: 33, classification: 'verified-foreign', final: null, imageSource: 'kernel-path' }] })
  })

  it.each(['installation-image', 'descendant'])('blocks a new selected %s after the anchor', async (relation) => {
    const baseline = [entry(11), entry(22)]
    const added = entry(33, { parentPid: relation === 'descendant' ? 11 : 1, executable: relation === 'descendant' ? fixtureForeign : fixtureSelected })
    frames(baseline, baseline, [...baseline, added], [...baseline, added])
    expect(await sample()).toMatchObject({ installationRssBytes: { status: 'unavailable' }, newSelectedProcessCount: 1, newProcesses: [{ pid: 33, classification: relation }] })
  })

  it('records a preparation-only unknown exit while retaining an observed selected preparation exit', async () => {
    frames([entry(11), entry(22, { executable: null })], [], [], [])
    expect(await sample()).toMatchObject({ installationRssBytes: { status: 'unavailable' }, missingIdentities: [{ pid: 11 }], preAnchorExitedProcesses: [{ pid: 22 }] })
  })

  it('allows a preparation-only unknown exit without classifying it as foreign', async () => {
    const baseline = [entry(11), entry(22)]
    frames([...baseline, entry(33, { executable: null })], baseline, baseline, baseline)
    expect(await sample()).toMatchObject({ installationRssBytes: { status: 'observed', value: 1000 }, verifiedNewForeignProcessCount: 0, preAnchorExitedProcesses: [{ pid: 33 }] })
  })

  it('rejects PID reuse within the same second using exact microseconds', async () => {
    const old = [entry(11), entry(22)]
    const changed = [entry(11), entry(22, { identity: { startedMicroseconds: '123457' } })]
    frames(old, changed, old, old)
    expect(await sample()).toMatchObject({ installationRssBytes: { status: 'unavailable' }, identityChangedProcessCount: 1, identityChangedProcesses: [{ pid: 22, reasons: ['started-changed'], changedTo: { startedMicroseconds: '123457' } }] })
  })

  it('retains an observed absence even if the exact token later returns', async () => {
    const baseline = [entry(11), entry(22)]
    frames(baseline, baseline, [entry(11)], baseline)
    expect(await sample()).toMatchObject({ installationRssBytes: { status: 'unavailable' }, identityChangedProcesses: [{ pid: 22, reasons: ['returned-after-absence'] }] })
  })

  it('allows ordinary running/sleeping changes while retaining their evidence', async () => {
    frames(...phases.map((_, index) => [entry(11, { identity: { status: index % 2 ? 3 : 2 } }), entry(22)]))
    const report = await sample()
    expect(report).toMatchObject({ installationRssBytes: { status: 'observed', value: 1000 }, identityChangedProcessCount: 0 })
    expect(report.nativeFrames?.map(frame => frame.rows.find(row => row.pid === 11)?.before?.status)).toEqual([2, 3, 2, 3])
  })

  it('keeps an observed image change blocked even if the original image returns', async () => {
    const baseline = [entry(11), entry(22)]
    frames(baseline, [entry(11), entry(22, { executable: '/System/Library/OtherForeign' })], baseline, baseline)
    expect(await sample()).toMatchObject({ installationRssBytes: { status: 'unavailable' }, unclassifiedProcesses: [{ pid: 22, causes: [{ reason: 'image-changed' }] }] })
  })

  it('requires selected members at the final closure boundary', async () => {
    const baseline = [entry(11), entry(22)]
    frames(baseline, baseline, baseline, [entry(22)])
    expect(await sample()).toMatchObject({ installationRssBytes: { status: 'unavailable' }, missingIdentities: [{ pid: 11, final: null }] })
  })

  it('does not expose UID or arbitrary identity fields in the report', async () => {
    const report = await sample()
    expect(JSON.stringify(report)).not.toContain('"uid"')
    expect(report.nativeFrames).toHaveLength(4)
  })

  it('builds the inspector before starting the shared deadline and rejects the exact deadline', async () => {
    let now = 0
    vi.mocked(Date.now).mockImplementation(() => now)
    mocks.prepare.mockImplementation(async () => {
      now = 5000
      return {}
    })
    mocks.read.mockImplementation(async (phase: DarwinProcessFrame['phase']) => {
      if (phase === 'closure2') {
        now = 15_000
      }
      return frame(phase)
    })
    expect(await sample()).toMatchObject({ installationRssBytes: { status: 'unavailable' }, inventoryBudgetExhausted: true })
    expect(mocks.inspect.mock.calls[0]![0]).toBe(15_000)
  })

  it('preserves a compiler preparation failure without starting inspection', async () => {
    mocks.prepare.mockRejectedValue(new Error('SDK unavailable'))
    expect(await sampleNativeInstallationProcesses(target)).toEqual({ status: 'unavailable', reason: 'SDK unavailable' })
    expect(mocks.inspect).not.toHaveBeenCalled()
  })
})
