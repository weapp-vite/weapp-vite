import type { DarwinInspectorPhase, DarwinProcessEntry, DarwinProcessFrame, DarwinProcessIdentity } from '../processInventory/darwinInspector/types'

export const fixtureInstallation = '/Applications/Selected.app'
export const fixtureSelected = `${fixtureInstallation}/Contents/MacOS/Selected`
export const fixtureForeign = '/System/Library/Foreign'
export const fixtureHelper = '/private/tmp/resource-inspector-fixture/inspector'

export function identity(pid: number, parentPid = 1, overrides: Partial<DarwinProcessIdentity> = {}): DarwinProcessIdentity {
  return { pid, parentPid, uid: 501, status: 2, startedSeconds: '1792800000', startedMicroseconds: '123456', zombie: false, ...overrides }
}

export function entry(pid: number, options: { parentPid?: number, executable?: string | null, rssBytes?: string | null, identity?: Partial<DarwinProcessIdentity> } = {}): DarwinProcessEntry {
  const value = identity(pid, options.parentPid, options.identity)
  const executable = options.executable === undefined ? pid === 11 ? fixtureSelected : fixtureForeign : options.executable
  const rssBytes = options.rssBytes === undefined ? '1000' : options.rssBytes
  return {
    pid,
    startedAtNanoseconds: '100',
    endedAtNanoseconds: '200',
    before: { result: 0, length: 648, errno: 0, identity: { ...value } },
    pathBefore: { count: executable ? executable.length : 0, errno: executable ? 0 : 2, executable },
    task: { count: rssBytes === null ? 0 : 232, errno: rssBytes === null ? 1 : 0, identity: rssBytes === null ? null : { ...value }, rssBytes },
    pathAfter: { count: executable ? executable.length : 0, errno: executable ? 0 : 2, executable },
    after: { result: 0, length: 648, errno: 0, identity: { ...value } },
    gaps: [],
  }
}

export function frame(phase: DarwinInspectorPhase, rows = [entry(11), entry(22)]): DarwinProcessFrame {
  const helper = entry(99, { executable: fixtureHelper })
  const values = [...rows, helper]
  return {
    protocol: 1,
    requestId: ['prepare', 'anchor', 'closure1', 'closure2'].indexOf(phase) + 1,
    phase,
    startedAtNanoseconds: '50',
    endedAtNanoseconds: '250',
    enumeration: { complete: true, bytes: values.length * 648, recordSize: 648, pidCount: values.length, pids: values.map(row => row.pid), zeroPidCount: 1 },
    rows: values,
    ownedHelper: { pid: 99, identity: helper.before.identity!, executable: fixtureHelper, row: helper },
  }
}
