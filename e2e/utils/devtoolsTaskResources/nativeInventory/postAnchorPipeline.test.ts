import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fixtureForeign, fixtureInstallation } from './fixture'
import { sampleNativeInstallationProcesses } from './index'
import { postAnchorFrames, postAnchorPhases } from './postAnchorFixture'

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

describe('post-anchor native proof through the unchanged sampling pipeline', () => {
  it('preserves one helper, four phases, ten seconds and whitelisted raw evidence', async () => {
    const frames = postAnchorFrames()
    const privateValue = 'private-future-native-value'
    const row = frames[3]!.rows.find(row => row.pid === 22)!
    for (const target of [frames[3]!.absolute!, frames[3]!.absolute!.startCalibration, row.absolute!, row.absolute!.birthBefore, row.confirmation!, row.confirmation!.before, row.confirmation!.before.identity!]) {
      Object.assign(target, { futureField: privateValue, argv: [privateValue] })
    }
    const original = structuredClone(frames)
    mocks.read.mockImplementation(async (phase: typeof postAnchorPhases[number]) => structuredClone(frames[postAnchorPhases.indexOf(phase)]!))
    const result = await sampleNativeInstallationProcesses({} as Parameters<typeof sampleNativeInstallationProcesses>[0])
    expect(result).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'observed', value: 1000 },
      closureOwnership: { status: 'observed', value: 'verified' },
      verifiedPostAnchorForeignProcessCount: 1,
      samplingBudgetMs: 10_000,
      rssAnchor: 'single-native-anchor-frame; preparation-and-closure-rss-never-contribute',
    } })
    expect(mocks.prepare).toHaveBeenCalledTimes(1)
    expect(mocks.inspect).toHaveBeenCalledExactlyOnceWith(10_000, expect.any(Function), { executable: 'owned-test-helper' })
    expect(mocks.read.mock.calls.map(([phase]) => phase)).toEqual(postAnchorPhases)
    expect(mocks.images).not.toHaveBeenCalled()
    expect(frames).toEqual(original)
    const serialized = JSON.stringify(result)
    for (const forbidden of [privateValue, fixtureForeign, '"uid"', '"argv"', 'futureField']) {
      expect(serialized).not.toContain(forbidden)
    }
  })

  it('keeps a birth-proven process with unknown closure paths blocked', async () => {
    const frames = postAnchorFrames()
    const row = frames[3]!.rows.find(row => row.pid === 22)!
    row.pathBefore = row.pathAfter = { count: 0, errno: 1, executable: null }
    row.gaps.push('image-before-unavailable', 'image-after-unavailable')
    mocks.read.mockImplementation(async (phase: typeof postAnchorPhases[number]) => structuredClone(frames[postAnchorPhases.indexOf(phase)]!))
    const result = await sampleNativeInstallationProcesses({} as Parameters<typeof sampleNativeInstallationProcesses>[0])
    expect(result).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'unavailable' },
      closureOwnership: { status: 'unavailable' },
      verifiedPostAnchorForeignProcesses: [],
    } })
  })
})
