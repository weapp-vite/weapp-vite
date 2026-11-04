import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { foreignCredentialFrames, foreignCredentialRows, summarizeForeignCredentialFrames } from './foreignCredentialFixture'
import { normalizeNativeFrame } from './model'
import { processAbsolute } from './postAnchorFixture'

beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(0))
afterEach(() => vi.restoreAllMocks())

describe('foreign main brackets after an enumeration-only credential change', () => {
  it('proves four complete foreign main brackets without replacing the RSS anchor or erasing history', () => {
    const frames = foreignCredentialFrames()
    const original = structuredClone(frames)
    expect(normalizeNativeFrame(frames[0]!).rows.get(22)).toMatchObject({
      images: null,
      rssBytes: null,
      identityChanged: true,
    })

    const report = summarizeForeignCredentialFrames(frames)
    expect(report).toMatchObject({
      installationRssBytes: { status: 'observed', value: 1000 },
      closureOwnership: { status: 'observed', value: 'verified' },
      verifiedMemberRssBytes: 1000,
      unclassifiedProcessCount: 0,
      missingIdentityCount: 0,
      identityChangedProcessCount: 1,
      verifiedForeignCredentialProcessCount: 1,
      verifiedForeignCredentialProcesses: [{
        process: { pid: 22, causes: expect.arrayContaining([
          { reason: 'enumeration-identity-changed', firstObserved: { round: 1, phase: 'prepare' } },
          { reason: 'image-changed', firstObserved: { round: 1, phase: 'anchor' } },
        ]) },
        proof: 'complete-foreign-main-brackets-after-enumeration-credentials-change',
        clockDomain: 'mach-absolute-ticks',
        birthTicks: '500',
        previousFrameEndedAtTicks: null,
        phases: ['prepare', 'anchor', 'closure1', 'closure2'],
        crossFrameGenerationStable: true,
        crossFrameBirthStable: true,
        crossFrameMainCredentialsStable: true,
        ancestry: [],
        semantics: 'foreign-main-brackets-only; enumeration-image-unobserved; original-rss-anchor-and-history-preserved',
      }],
      identityChangedProcesses: [{
        pid: 22,
        reasons: ['credentials-changed'],
        boundary: {
          from: { phase: 'prepare', position: 'enumeration' },
          to: { phase: 'prepare', position: 'before' },
        },
      }],
    })
    expect(report.processes.map(process => [process.pid, process.rssBytes])).toEqual([[11, 1000]])
    expect(report.verifiedForeignCredentialProcesses![0]!.brackets.map(bracket => [bracket.phase, bracket.startedAtTicks, bracket.endedAtTicks, bracket.image.scope])).toEqual([
      ['prepare', '1100', '1190', 'outside-installation'],
      ['anchor', '2100', '2190', 'outside-installation'],
      ['closure1', '3100', '3190', 'outside-installation'],
      ['closure2', '4100', '4190', 'outside-installation'],
    ])
    expect(report.nativeFrames!.map(frame => frame.rows.find(row => row.pid === 22)!.credentials)).toEqual([
      { mainStable: true, enumerationMatchesMain: false },
      { mainStable: true, enumerationMatchesMain: true },
      { mainStable: true, enumerationMatchesMain: true },
      { mainStable: true, enumerationMatchesMain: true },
    ])
    expect(report.rssAnchor).toBe('single-native-anchor-frame; preparation-and-closure-rss-never-contribute')
    expect(report.atomicity).toBe('non-atomic-sysctl-identity-and-image-brackets; observed-continuity-does-not-prove-no-unobserved-exec')
    expect(JSON.stringify(report)).not.toContain('"uid"')
    expect(frames).toEqual(original)
  })

  it('checks an optional confirmation without replacing the original main bracket', () => {
    const frames = foreignCredentialFrames()
    const first = foreignCredentialRows(frames)[0]!
    first.confirmation = {
      ...processAbsolute(1300, '500'),
      before: structuredClone(first.before),
      after: structuredClone(first.after),
      pathBefore: { ...first.pathBefore },
      pathAfter: { ...first.pathAfter },
    }
    const report = summarizeForeignCredentialFrames(frames)
    expect(report).toMatchObject({ installationRssBytes: { status: 'observed', value: 1000 }, verifiedForeignCredentialProcessCount: 1 })
    expect(report.verifiedForeignCredentialProcesses![0]!.brackets[0]).toMatchObject({ startedAtTicks: '1100', endedAtTicks: '1190' })
  })
})
