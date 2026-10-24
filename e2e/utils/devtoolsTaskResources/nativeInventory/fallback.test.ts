import type { DarwinProcessEntry } from '../processInventory/darwinInspector/types'
import type { InstallationProcessSample } from '../types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { entry, fixtureForeign, fixtureInstallation, fixtureSelected, frame } from './fixture'
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
  return result.value
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(Date, 'now').mockReturnValue(0)
  mocks.realpath.mockResolvedValue(fixtureInstallation)
  mocks.prepare.mockResolvedValue({ executable: 'owned-test-helper' })
  mocks.inspect.mockImplementation(async (_deadline, consume) => consume({ readFrame: mocks.read }))
  mocks.images.mockResolvedValue([fixtureForeign])
})
afterEach(() => vi.restoreAllMocks())

describe('native text-image fallback proofs', () => {
  it('requires two equal sets bracketing the anchor and final precise identity', async () => {
    const events: string[] = []
    mocks.read.mockImplementation(async (phase: typeof phases[number]) => {
      events.push(phase)
      return frame(phase, [entry(11), entry(22, { executable: null })])
    })
    mocks.images.mockImplementation(async () => {
      events.push('text-images')
      return [fixtureForeign, '/System/Library/Library', fixtureForeign]
    })
    const report = await sample()
    expect(events).toEqual(['prepare', 'text-images', 'anchor', 'text-images', 'closure1', 'text-images', 'text-images', 'closure2'])
    expect(report.installationRssBytes).toEqual({ status: 'observed', value: 1000 })
    expect(report.textImageProofs).toHaveLength(2)
    expect(report.textImageProofs?.map(proof => ({ kind: proof.kind, accepted: proof.accepted }))).toEqual([
      { kind: 'rss-anchor-bracket', accepted: true },
      { kind: 'closure-identity-bracket', accepted: true },
    ])
    const images = report.textImageProofs![0]!.before.images!
    expect(images).toHaveLength(2)
    expect(images).toEqual(report.textImageProofs![0]!.after.images)
    expect(images).toEqual(report.textImageProofs![1]!.before.images)
    expect(images.every(image => image.scope === 'outside-installation' && /^[\da-f]{64}$/.test(image.sha256))).toBe(true)
    expect(new Set(images.map(image => image.sha256)).size).toBe(2)
    expect(JSON.stringify(report)).not.toContain(fixtureForeign)
  })

  it('counts a verified selected fallback parent and its external-image descendant using only anchor RSS', async () => {
    frames(...phases.map(phase => [entry(11, { executable: null, rssBytes: phase === 'anchor' ? '1234' : '9999' }), entry(22, { parentPid: 11, rssBytes: phase === 'anchor' ? '4321' : '8888' })]))
    mocks.images.mockResolvedValue([fixtureSelected])
    expect(await sample()).toMatchObject({
      installationRssBytes: { status: 'observed', value: 5555 },
      processes: [{ pid: 11, executable: null, membership: 'installation-image', rssBytes: 1234 }, { pid: 22, membership: 'descendant', rssBytes: 4321 }],
    })
  })

  it('uses the full compatible text proof at the anchor while retaining its direct-path evidence', async () => {
    const baseline = [entry(11), entry(22)]
    frames([entry(11), entry(22, { executable: null })], baseline, baseline, baseline)
    mocks.images.mockResolvedValue([fixtureForeign, fixtureSelected])
    const report = await sample()
    expect(report.installationRssBytes).toEqual({ status: 'observed', value: 2000 })
    expect(report.processes.find(process => process.pid === 22)).toMatchObject({ membership: 'installation-image', installationImages: [fixtureSelected] })
    expect(report.nativeFrames?.find(frame => frame.phase === 'anchor')?.rows.find(row => row.pid === 22)?.pathBefore.image).toMatchObject({ scope: 'outside-installation' })
  })

  it.each(['empty', 'invalid', 'failed', 'different', 'identity'] as const)('keeps a rejected %s proof incomplete', async (failure) => {
    frames(...phases.map(phase => [entry(11), entry(22, { executable: null, ...(failure === 'identity' && phase === 'closure1' ? { identity: { startedMicroseconds: '123457' } } : {}) })]))
    if (failure === 'empty') {
      mocks.images.mockResolvedValue([])
    }
    else if (failure === 'invalid') {
      mocks.images.mockResolvedValue(['relative/image'])
    }
    else if (failure === 'failed') {
      mocks.images.mockRejectedValue(new Error('Denied fixture text query'))
    }
    else if (failure === 'different') {
      mocks.images.mockResolvedValueOnce([fixtureForeign]).mockResolvedValue(['/System/Library/Other'])
    }
    const report = await sample()
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.textImageProofs?.find(proof => proof.kind === 'rss-anchor-bracket')?.accepted).toBe(false)
    expect(report.unclassifiedProcesses).toEqual(expect.arrayContaining([expect.objectContaining({ pid: 22 })]))
  })

  it('never creates an anchor proof for an identity first seen at the anchor', async () => {
    const baseline = [entry(11), entry(22)]
    frames(baseline, [...baseline, entry(33, { executable: null })], [...baseline, entry(33, { executable: null })], [...baseline, entry(33, { executable: null })])
    const report = await sample()
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.unclassifiedProcesses).toEqual([expect.objectContaining({ pid: 33 })])
    expect(report.textImageProofs?.map(proof => ({ pid: proof.pid, kind: proof.kind, accepted: proof.accepted }))).toEqual([{ pid: 33, kind: 'closure-identity-bracket', accepted: true }])
  })

  it('retains selected activity from one successful query even when the pair is rejected', async () => {
    const baseline = [entry(11), entry(22)]
    frames([entry(11), entry(22, { executable: null })], baseline, baseline, baseline)
    mocks.images.mockRejectedValueOnce(new Error('First query denied')).mockResolvedValue([fixtureForeign, fixtureSelected])
    const report = await sample()
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.missingIdentities).toEqual([expect.objectContaining({ pid: 22 })])
    expect(report.textImageProofs?.find(proof => proof.kind === 'rss-anchor-bracket')?.accepted).toBe(false)
  })

  it('retains fallback budget exhaustion even if the preparation candidate exits before the anchor', async () => {
    let now = 0
    vi.mocked(Date.now).mockImplementation(() => now)
    mocks.read.mockImplementation(async (phase: typeof phases[number]) => {
      now = 10_000
      return frame(phase, phase === 'prepare' ? [entry(11), entry(22, { executable: null })] : [entry(11)])
    })
    const report = await sample()
    expect(mocks.images).not.toHaveBeenCalled()
    expect(report).toMatchObject({ installationRssBytes: { status: 'unavailable' }, inventoryBudgetExhausted: true, fallbackBudgetExhausted: true, preAnchorExitedProcesses: [{ pid: 22 }] })
  })

  it('does not dispatch fallback queries after the shared deadline', async () => {
    let now = 0
    vi.mocked(Date.now).mockImplementation(() => now)
    mocks.read.mockImplementation(async (phase: typeof phases[number]) => {
      now = 10_000
      return frame(phase, [entry(11), entry(22, { executable: null })])
    })
    const report = await sample()
    expect(mocks.images).not.toHaveBeenCalled()
    expect(report).toMatchObject({ installationRssBytes: { status: 'unavailable' }, inventoryBudgetExhausted: true, fallbackBudgetExhausted: true })
  })
})
