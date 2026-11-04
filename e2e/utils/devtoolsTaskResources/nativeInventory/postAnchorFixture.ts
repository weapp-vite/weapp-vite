import type { DarwinProcessAbsoluteEvidence, DarwinProcessEntry, DarwinProcessFrame, DarwinProcessIdentity } from '../processInventory/darwinInspector/types'
import { entry, fixtureForeign, frame } from './fixture'

export const postAnchorPhases = ['prepare', 'anchor', 'closure1', 'closure2'] as const
export const postAnchorBootstrap = '/usr/libexec/xpcproxy'

export function setRowIdentity(row: DarwinProcessEntry, updates: Partial<DarwinProcessIdentity>) {
  Object.assign(row.enumeratedIdentity, updates)
  for (const read of [row.before, row.task, row.after]) {
    Object.assign(read.identity!, updates)
  }
}

export function processAbsolute(start: number, birthTicks = '3001'): DarwinProcessAbsoluteEvidence {
  return {
    clockDomain: 'mach-absolute-ticks',
    startedAtTicks: String(start),
    endedAtTicks: String(start + 90),
    birthBefore: { result: 0, errno: 0, startedAtTicks: String(start + 1), endedAtTicks: String(start + 2), birthTicks, exitTicks: '0' },
    birthAfter: { result: 0, errno: 0, startedAtTicks: String(start + 80), endedAtTicks: String(start + 81), birthTicks, exitTicks: '0' },
  }
}

export function postAnchorFrames(firstPhase: 'closure1' | 'closure2' = 'closure2', parentPid = 1): DarwinProcessFrame[] {
  return postAnchorPhases.map((phase, index) => {
    const start = (index + 1) * 1000
    const rows = [entry(11), ...(parentPid === 33 ? [entry(33)] : [])]
    if (index >= (firstPhase === 'closure1' ? 2 : 3)) {
      const row = entry(22, { parentPid, rssBytes: '99999', identity: { uid: 502 } })
      row.absolute = processAbsolute(start + 100)
      if (phase === 'closure2') {
        row.enumeratedIdentity.uid = 501
        row.pathBefore = { count: postAnchorBootstrap.length, errno: 0, executable: postAnchorBootstrap }
        row.gaps = ['enumeration-identity-changed', 'image-changed']
        row.confirmation = {
          ...processAbsolute(start + 200),
          before: structuredClone(row.before),
          after: structuredClone(row.after),
          pathBefore: { count: fixtureForeign.length, errno: 0, executable: fixtureForeign },
          pathAfter: { count: fixtureForeign.length, errno: 0, executable: fixtureForeign },
        }
      }
      else {
        row.pathBefore = row.pathAfter = { count: postAnchorBootstrap.length, errno: 0, executable: postAnchorBootstrap }
      }
      rows.push(row)
    }
    const wire = frame(phase, rows)
    wire.absolute = {
      clockDomain: 'mach-absolute-ticks',
      startedAtTicks: String(start),
      endedAtTicks: String(start + 900),
      startCalibration: { monotonicBeforeNanoseconds: '50', absoluteTicks: String(start), monotonicAfterNanoseconds: '51' },
      endCalibration: { monotonicBeforeNanoseconds: '249', absoluteTicks: String(start + 900), monotonicAfterNanoseconds: '250' },
    }
    return wire
  })
}
