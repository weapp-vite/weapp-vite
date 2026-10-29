import type { DarwinProcessEntry } from '../processInventory/darwinInspector/types'
import type { InstallationProcessSample } from '../types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { entry, fixtureForeign, fixtureHelper, fixtureInstallation, frame } from './fixture'
import { sampleNativeInstallationProcesses } from './index'

const mocks = vi.hoisted(() => ({ prepare: vi.fn(), inspect: vi.fn(), read: vi.fn(), images: vi.fn(), realpath: vi.fn() }))
vi.mock('../processInventory/darwinInspector', () => ({ prepareDarwinInspector: mocks.prepare, withDarwinInspector: mocks.inspect }))
vi.mock('node:fs/promises', () => ({ default: { realpath: mocks.realpath } }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsTarget/host', () => ({ resolveWechatDevtoolsInstallationRoot: () => fixtureInstallation }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/darwin', () => ({ readDarwinTextImages: mocks.images }))

const phases = ['prepare', 'anchor', 'closure1', 'closure2'] as const
const target = {} as Parameters<typeof sampleNativeInstallationProcesses>[0]

function frames(...rows: DarwinProcessEntry[][]) {
  mocks.read.mockImplementation(async (phase: typeof phases[number]) => frame(phase, structuredClone(rows[phases.indexOf(phase)]!)))
}

async function sample(): Promise<InstallationProcessSample> {
  const result = await sampleNativeInstallationProcesses(target)
  expect(result.status, JSON.stringify(result)).toBe('observed')
  if (result.status !== 'observed') {
    throw new Error(result.reason)
  }
  const report = result.value
  expect(report.unclassifiedProcessCount).toBe(report.unclassifiedProcesses.length)
  expect(report.missingIdentityCount).toBe(report.missingIdentities.length)
  expect(report.identityChangedProcessCount).toBe(report.identityChangedProcesses.length)
  expect(report.verifiedNewForeignProcessCount).toBe(report.newProcesses.filter(row => row.classification === 'verified-foreign').length)
  expect(report.uninspectedNewProcessCount).toBe(report.newProcesses.filter(row => row.classification === 'unclassified').length)
  expect(report.newSelectedProcessCount).toBe(report.newProcesses.filter(row => row.classification === 'installation-image' || row.classification === 'descendant').length)
  return report
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(Date, 'now').mockReturnValue(0)
  mocks.realpath.mockResolvedValue(fixtureInstallation)
  mocks.prepare.mockResolvedValue({ executable: 'owned-test-helper' })
  mocks.inspect.mockImplementation(async (_deadline, consume) => consume({ readFrame: mocks.read }))
  mocks.images.mockRejectedValue(new Error('Fixture private query error'))
  frames(...phases.map(() => [entry(11), entry(22)]))
})
afterEach(() => vi.restoreAllMocks())

describe('native inventory durable and privacy-safe evidence', () => {
  it.each([
    { name: 'failed queries with nonzero record lengths', before: { result: -1, length: 648, errno: 13 }, after: { result: -1, length: 512, errno: 3 } },
    { name: 'empty or absent kernel records', before: { result: 0, length: 0, errno: 0 }, after: { result: -1, length: 0, errno: 3 } },
  ])('preserves query facts without an identity for $name', async ({ before, after }) => {
    const unknown = entry(22, { executable: null, rssBytes: null })
    unknown.before = { ...before, identity: null }
    unknown.after = { ...after, identity: null }
    frames(...phases.map(() => [entry(11), unknown]))
    const report = await sample()
    expect(report.installationRssBytes.status).toBe('unavailable')
    for (const frame of report.nativeFrames!) {
      expect(frame.rows.find(row => row.pid === 22)).toMatchObject({
        before: null,
        after: null,
        beforeQuery: before,
        afterQuery: after,
      })
    }
  })

  it('retains the first query failure phase alongside a later observed absence', async () => {
    const unknown = [entry(11), entry(22, { executable: null })]
    frames(unknown, unknown, [entry(11)], [entry(11)])
    const report = await sample()
    const gap = report.unclassifiedProcesses.find(row => row.pid === 22)!
    expect(gap.final).toBeNull()
    expect(gap.causes).toEqual(expect.arrayContaining([
      { reason: 'text-images-query-failed', firstObserved: { round: 1, phase: 'prepare' } },
      { reason: 'process-absent', firstObserved: { round: 2, phase: 'closure1' } },
    ]))
    expect(gap.causes.filter(cause => cause.reason === 'text-images-query-failed')).toHaveLength(1)
    expect(JSON.stringify(report)).not.toContain('Fixture private query error')
  })

  it('retains an initially selected zero-byte zombie as missing without inventing an unclassified identity', async () => {
    frames(...phases.map(() => [entry(11, { rssBytes: '0', identity: { status: 5, zombie: true } }), entry(22)]))
    const report = await sample()
    expect(report).toMatchObject({ installationRssBytes: { status: 'unavailable' }, processes: [], unclassifiedProcesses: [], identityChangedProcesses: [] })
    expect(report.missingIdentities).toEqual([expect.objectContaining({ pid: 11, zombie: true, causes: expect.arrayContaining([{ reason: 'zombie', firstObserved: { round: 1, phase: 'prepare' } }]) })])
  })

  it('preserves simultaneous return, start, parent and zombie drift after the original fields return', async () => {
    const baseline = [entry(11), entry(22)]
    const changed = entry(22, { parentPid: 11, identity: { startedMicroseconds: '123457', status: 5, zombie: true } })
    frames(baseline, [entry(11)], [entry(11), changed], baseline)
    const report = await sample()
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.identityChangedProcesses).toEqual([expect.objectContaining({
      pid: 22,
      changedTo: expect.objectContaining({ parentPid: 11, startedMicroseconds: '123457', zombie: true }),
      reasons: ['returned-after-absence', 'started-changed', 'parent-changed', 'zombie-changed'],
      firstObserved: { round: 2, phase: 'closure1' },
    })])
    expect(report.missingIdentities.find(row => row.pid === 22)).toMatchObject({
      final: { parentPid: 1, startedMicroseconds: '123456', zombie: false },
      causes: expect.arrayContaining([
        { reason: 'process-absent', firstObserved: { round: 1, phase: 'anchor' } },
        { reason: 'identity-changed', firstObserved: { round: 2, phase: 'closure1' } },
      ]),
    })
  })

  it.each([null, '9007199254740992', '18446744073709551615'])('retains nullable or unsafe RSS bytes as evidence without counting them (%s)', async (rssBytes) => {
    frames(...phases.map(() => [entry(11, { rssBytes }), entry(22)]))
    const report = await sample()
    expect(report).toMatchObject({ installationRssBytes: { status: 'unavailable' }, verifiedMemberRssBytes: 0, processes: [], missingIdentities: [{ pid: 11, causes: [{ reason: 'rss-unavailable' }] }] })
    expect(report.nativeFrames?.find(frame => frame.phase === 'anchor')?.rows.find(row => row.pid === 11)?.rss.bytes).toBe(rssBytes)
  })

  it.each(['0', '9007199254740991'])('keeps representable anchor RSS bytes exact (%s)', async (rssBytes) => {
    frames(...phases.map(() => [entry(11, { rssBytes }), entry(22)]))
    const report = await sample()
    expect(report.installationRssBytes).toEqual({ status: 'observed', value: Number(rssBytes) })
    expect(report.processes[0]!.rssBytes).toBe(Number(rssBytes))
  })

  it('rejects a selected RSS sum outside the safe integer range instead of rounding it', async () => {
    frames(...phases.map(() => [entry(11, { rssBytes: '9007199254740991' }), entry(22, { parentPid: 11, rssBytes: '1' })]))
    expect(await sampleNativeInstallationProcesses(target)).toEqual({ status: 'unavailable', reason: expect.stringContaining('safely') })
  })

  it('keeps the anchor proof when final exact identities remain stable but final paths are unavailable', async () => {
    const baseline = [entry(11), entry(22)]
    frames(baseline, baseline, baseline, [entry(11, { executable: null }), entry(22)])
    const report = await sample()
    expect(report.installationRssBytes).toEqual({ status: 'observed', value: 1000 })
    expect(report.identityChangedProcesses).toEqual([])
    expect(report.nativeFrames?.at(-1)?.rows.find(row => row.pid === 11)).toMatchObject({ pathBefore: { image: null }, pathAfter: { image: null } })
    expect(mocks.images).not.toHaveBeenCalled()
  })

  it('keeps count fields consistent for simultaneous unknown, selected and changed identities', async () => {
    const baseline = [entry(11), entry(22)]
    const unknown = entry(33, { executable: null })
    const selected = entry(44, { parentPid: 11 })
    const changed = entry(22, { identity: { startedMicroseconds: '123457' } })
    frames(baseline, [...baseline, unknown], [entry(11), changed, unknown, selected], [entry(11), changed, unknown, selected])
    const report = await sample()
    expect(report).toMatchObject({ installationRssBytes: { status: 'unavailable' }, unclassifiedProcessCount: 2, missingIdentityCount: 1, identityChangedProcessCount: 1, newSelectedProcessCount: 1, uninspectedNewProcessCount: 1 })
  })

  it('whitelists identity fields and hashes outside images without exposing arbitrary source metadata', async () => {
    const sentinel = 'private-native-fixture-metadata'
    const rows = [entry(11), entry(22)]
    for (const row of rows) {
      Object.assign(row, { argv: [sentinel], command: sentinel, environment: { value: sentinel }, futureRowField: sentinel })
      for (const query of [row.before, row.after]) {
        Object.assign(query, { uid: 909, command: sentinel, path: fixtureForeign, futureQueryField: { value: sentinel } })
      }
      for (const observation of [row.before, row.task, row.after]) {
        Object.assign(observation.identity!, { futureIdentityField: sentinel })
      }
    }
    frames(...phases.map(() => rows))
    const report = await sample()
    const encoded = JSON.stringify(report)
    for (const privateValue of [sentinel, '"uid"', '"argv"', '"command"', '"environment"', '"path"', 'futureRowField', 'futureQueryField', 'futureIdentityField', fixtureForeign, fixtureHelper]) {
      expect(encoded).not.toContain(privateValue)
    }
    const before = report.nativeFrames![0]!
    for (const row of before.rows) {
      expect(row.beforeQuery).toEqual({ result: 0, length: 648, errno: 0 })
      expect(row.afterQuery).toEqual({ result: 0, length: 648, errno: 0 })
      expect(row.before).toMatchObject({ pid: row.pid, started: '1792800000.123456' })
      expect(row.after).toMatchObject({ pid: row.pid, started: '1792800000.123456' })
    }
    expect(before.rows.find(row => row.pid === 22)?.pathBefore.image).toEqual({ scope: 'outside-installation', sha256: expect.stringMatching(/^[\da-f]{64}$/) })
    expect(before.ownedHelper.image).toEqual({ scope: 'outside-installation', sha256: expect.stringMatching(/^[\da-f]{64}$/) })
    expect(before.rows.find(row => row.pid === 11)?.pathBefore.image).toEqual({ scope: 'installation', installationRelativePath: 'Contents/MacOS/Selected', sha256: expect.stringMatching(/^[\da-f]{64}$/) })
  })

  it('does not expose a selected descendant external executable in the public process list', async () => {
    frames(...phases.map(() => [entry(11), entry(22, { parentPid: 11 })]))
    const report = await sample()
    expect(report.installationRssBytes).toEqual({ status: 'observed', value: 2000 })
    expect(report.processes.find(row => row.pid === 22)).toMatchObject({ executable: null, installationImages: [], membership: 'descendant' })
    expect(JSON.stringify(report)).not.toContain(fixtureForeign)
  })

  it('retains equality proofs for fallback images without exposing their original paths', async () => {
    const hiddenImage = '/System/Library/PrivateFallbackFixture'
    frames(...phases.map(() => [entry(11), entry(22, { executable: null })]))
    mocks.images.mockResolvedValue([hiddenImage])
    const report = await sample()
    expect(report.installationRssBytes).toEqual({ status: 'observed', value: 1000 })
    const proof = report.textImageProofs!.find(proof => proof.kind === 'rss-anchor-bracket')!
    expect(proof.accepted).toBe(true)
    expect(proof.before.images).toEqual(proof.after.images)
    expect(proof.before.images).toEqual([{ scope: 'outside-installation', sha256: expect.stringMatching(/^[\da-f]{64}$/) }])
    expect(JSON.stringify(report)).not.toContain(hiddenImage)
  })
})
