import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { anchorForeignFrames, anchorForeignRows } from './anchorForeignFixture'
import { entry, fixtureForeign, fixtureInstallation } from './fixture'
import { sampleNativeInstallationProcesses } from './index'
import { postAnchorBootstrap, postAnchorPhases } from './postAnchorFixture'

const mocks = vi.hoisted(() => ({ prepare: vi.fn(), inspect: vi.fn(), read: vi.fn(), images: vi.fn(), realpath: vi.fn() }))
vi.mock('../processInventory/darwinInspector', () => ({ prepareDarwinInspector: mocks.prepare, withDarwinInspector: mocks.inspect }))
vi.mock('node:fs/promises', () => ({ default: { realpath: mocks.realpath } }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsTarget/host', () => ({ resolveWechatDevtoolsInstallationRoot: () => fixtureInstallation }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/darwin', () => ({ readDarwinTextImages: mocks.images }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(Date, 'now').mockReturnValue(0)
  mocks.realpath.mockResolvedValue(fixtureInstallation)
  mocks.prepare.mockResolvedValue({ executable: 'owned-test-helper' })
  mocks.inspect.mockImplementation(async (_deadline, consume) => consume({ readFrame: mocks.read }))
})
afterEach(() => vi.restoreAllMocks())

describe('anchor foreign proof through the original sampling pipeline', () => {
  it('uses one helper and the fixed four phases without resampling or disclosing raw private fields', async () => {
    const frames = anchorForeignFrames(33)
    const sentinel = 'private-future-anchor-value'
    for (const frame of frames) {
      for (const target of [frame, frame.absolute!, frame.absolute!.startCalibration, ...frame.rows.flatMap(row => [row, row.enumeratedIdentity, row.before, row.before.identity!, ...(row.absolute ? [row.absolute, row.absolute.birthBefore, row.absolute.birthAfter] : [])])]) {
        Object.assign(target, { futureField: sentinel, argv: [sentinel], privatePath: sentinel })
      }
    }
    const original = structuredClone(frames)
    mocks.read.mockImplementation(async (phase: typeof postAnchorPhases[number]) => structuredClone(frames[postAnchorPhases.indexOf(phase)]!))
    const result = await sampleNativeInstallationProcesses({} as Parameters<typeof sampleNativeInstallationProcesses>[0])
    expect(result).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'observed', value: 1000 },
      closureOwnership: { status: 'observed', value: 'verified' },
      verifiedAnchorForeignProcessCount: 1,
      samplingBudgetMs: 10_000,
      rssAnchor: 'single-native-anchor-frame; preparation-and-closure-rss-never-contribute',
      identityChangedProcesses: [{ pid: 22, reasons: ['credentials-changed'] }],
      verifiedAnchorForeignProcesses: [{ crossFrameGenerationStable: true, crossFrameBirthStable: true, crossFrameMainCredentialsStable: true }],
    } })
    expect(mocks.prepare).toHaveBeenCalledTimes(1)
    expect(mocks.inspect).toHaveBeenCalledExactlyOnceWith(10_000, expect.any(Function), { executable: 'owned-test-helper' })
    expect(mocks.read.mock.calls.map(([phase]) => phase)).toEqual(postAnchorPhases)
    expect(mocks.images).not.toHaveBeenCalled()
    expect(frames).toEqual(original)
    const serialized = JSON.stringify(result)
    for (const forbidden of [sentinel, fixtureForeign, postAnchorBootstrap, '"uid"', '"argv"', 'futureField', 'privatePath']) {
      expect(serialized).not.toContain(forbidden)
    }
  })

  it.each(['raw-path-failure', 'unrelated-unknown', 'budget-exhausted'] as const)('retains the independent %s gate', async (kind) => {
    const frames = anchorForeignFrames()
    if (kind === 'raw-path-failure') {
      const anchor = anchorForeignRows(frames)[0]!
      anchor.pathBefore = anchor.pathAfter = { count: 0, errno: 1, executable: null }
      anchor.gaps.push('image-before-unavailable', 'image-after-unavailable')
    }
    else if (kind === 'unrelated-unknown') {
      frames[3]!.rows.push(entry(44, { executable: null, parentPid: 77 }))
    }
    mocks.read.mockImplementation(async (phase: typeof postAnchorPhases[number]) => {
      if (kind === 'budget-exhausted' && phase === 'closure2') {
        vi.mocked(Date.now).mockReturnValue(10_000)
      }
      return structuredClone(frames[postAnchorPhases.indexOf(phase)]!)
    })
    const result = await sampleNativeInstallationProcesses({} as Parameters<typeof sampleNativeInstallationProcesses>[0])
    expect(result).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'unavailable' },
      closureOwnership: { status: 'unavailable' },
      verifiedAnchorForeignProcessCount: kind === 'raw-path-failure' ? 0 : 1,
      inventoryBudgetExhausted: kind === 'budget-exhausted',
    } })
    expect(mocks.read.mock.calls.map(([phase]) => phase)).toEqual(postAnchorPhases)
  })
})
