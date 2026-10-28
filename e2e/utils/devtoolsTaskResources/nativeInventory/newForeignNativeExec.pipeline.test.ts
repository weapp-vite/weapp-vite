import type { DarwinProcessEntry } from '../processInventory/darwinInspector/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { entry, fixtureInstallation, frame } from './fixture'
import { sampleNativeInstallationProcesses } from './index'

const mocks = vi.hoisted(() => ({ prepare: vi.fn(), inspect: vi.fn(), read: vi.fn(), images: vi.fn(), realpath: vi.fn() }))
vi.mock('../processInventory/darwinInspector', () => ({ prepareDarwinInspector: mocks.prepare, withDarwinInspector: mocks.inspect }))
vi.mock('node:fs/promises', () => ({ default: { realpath: mocks.realpath } }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsTarget/host', () => ({ resolveWechatDevtoolsInstallationRoot: () => fixtureInstallation }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/darwin', () => ({ readDarwinTextImages: mocks.images }))

const target = {} as Parameters<typeof sampleNativeInstallationProcesses>[0]
const phases = ['prepare', 'anchor', 'closure1', 'closure2'] as const

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(Date, 'now').mockReturnValue(0)
  mocks.realpath.mockResolvedValue(fixtureInstallation)
  mocks.prepare.mockResolvedValue({ executable: 'owned-test-helper' })
  mocks.inspect.mockImplementation(async (_deadline, consume) => consume({ readFrame: mocks.read }))
})
afterEach(() => vi.restoreAllMocks())

describe('native foreign exec through the complete sampling pipeline', () => {
  it.each([1, 33])('keeps one inspector and anchor with continuous foreign parent %s', async (parentPid) => {
    const values: DarwinProcessEntry[][] = phases.map((phase, index) => [
      entry(11, { rssBytes: phase === 'anchor' ? '1000' : '987654' }),
      ...(parentPid === 33 ? [entry(33)] : []),
      ...(index >= 2 ? [entry(22, { parentPid, rssBytes: index === 2 ? '7000' : '9000' })] : []),
    ])
    const first = values[2]!.find(row => row.pid === 22)!
    const bootstrap = '/usr/libexec/xpcproxy'
    first.pathBefore = { count: bootstrap.length, errno: 0, executable: bootstrap }
    first.gaps = ['image-changed']
    const original = structuredClone(values)
    mocks.read.mockImplementation(async (phase: typeof phases[number]) => frame(phase, structuredClone(values[phases.indexOf(phase)]!)))
    const result = await sampleNativeInstallationProcesses(target)
    expect(result.status, JSON.stringify(result)).toBe('observed')
    if (result.status !== 'observed') {
      throw new Error(result.reason)
    }
    expect(result.value).toMatchObject({
      installationRssBytes: { status: 'observed', value: 1000 },
      processes: [{ pid: 11, rssBytes: 1000 }],
      verifiedMemberRssBytes: 1000,
      verifiedNewForeignProcessCount: 1,
      verifiedForeignImageTransitionCount: 0,
      verifiedForeignNativeExecCount: 1,
      verifiedForeignNativeExecs: [{
        process: { pid: 22, causes: [{ reason: 'image-changed', firstObserved: { round: 2, phase: 'closure1' } }] },
        confirmationPhase: 'closure2',
        proof: 'complete-native-foreign-exec-brackets-since-first-observation',
      }],
      textImageProofs: [],
      textImageObservations: [],
      samplingBudgetMs: 10_000,
      inventoryBudgetExhausted: false,
      rssAnchor: 'single-native-anchor-frame; preparation-and-closure-rss-never-contribute',
    })
    expect(mocks.prepare).toHaveBeenCalledTimes(1)
    expect(mocks.inspect).toHaveBeenCalledExactlyOnceWith(10_000, expect.any(Function), { executable: 'owned-test-helper' })
    expect(mocks.read.mock.calls.map(([phase]) => phase)).toEqual(phases)
    expect(mocks.images).not.toHaveBeenCalled()
    expect(values).toEqual(original)
    expect(JSON.stringify(result.value)).not.toContain('"uid"')
  })
})
