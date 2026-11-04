import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { entry, fixtureForeign, fixtureInstallation } from './fixture'
import { foreignCredentialFrames, foreignCredentialRows } from './foreignCredentialFixture'
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

describe('strict foreign credential proof through the original sampling pipeline', () => {
  it('keeps one helper, four original phases and private-field redaction while exposing the strict certificate', async () => {
    const frames = foreignCredentialFrames()
    const sentinel = 'private-future-credential-value'
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
      verifiedForeignCredentialProcessCount: 1,
      samplingBudgetMs: 10_000,
      rssAnchor: 'single-native-anchor-frame; preparation-and-closure-rss-never-contribute',
      identityChangedProcessCount: 1,
      identityChangedProcesses: [{ pid: 22, reasons: ['credentials-changed'] }],
      verifiedForeignCredentialProcesses: [{
        crossFrameGenerationStable: true,
        crossFrameBirthStable: true,
        crossFrameMainCredentialsStable: true,
        semantics: 'foreign-main-brackets-only; enumeration-image-unobserved; original-rss-anchor-and-history-preserved',
      }],
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

  it.each(['raw-path-failure', 'repeated-enumeration-uid', 'unrelated-unknown', 'budget-exhausted'] as const)('retains the independent %s gate without another native sample', async (kind) => {
    const frames = foreignCredentialFrames()
    if (kind === 'raw-path-failure') {
      const first = foreignCredentialRows(frames)[0]!
      first.pathBefore = first.pathAfter = { count: 0, errno: 1, executable: null }
      first.gaps.push('image-before-unavailable', 'image-after-unavailable')
    }
    else if (kind === 'repeated-enumeration-uid') {
      const later = foreignCredentialRows(frames)[2]!
      later.enumeratedIdentity.uid = 501
      later.gaps = ['enumeration-identity-changed']
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
      verifiedForeignCredentialProcessCount: kind === 'raw-path-failure' || kind === 'repeated-enumeration-uid' ? 0 : 1,
      identityChangedProcesses: [{ pid: 22, reasons: ['credentials-changed'] }],
      inventoryBudgetExhausted: kind === 'budget-exhausted',
    } })
    expect(mocks.read.mock.calls.map(([phase]) => phase)).toEqual(postAnchorPhases)
    expect(mocks.inspect).toHaveBeenCalledTimes(1)
  })
})
