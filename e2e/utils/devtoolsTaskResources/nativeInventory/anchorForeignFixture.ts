import type { DarwinProcessEntry, DarwinProcessFrame } from '../processInventory/darwinInspector/types'
import { createNativeInventory } from './closure'
import { entry, fixtureForeign, fixtureInstallation, frame } from './fixture'
import { normalizeNativeFrame } from './model'
import { postAnchorBootstrap, postAnchorPhases, processAbsolute } from './postAnchorFixture'
import { summarizeNativeInventory } from './summary'

export function anchorForeignRows(frames: DarwinProcessFrame[]) {
  return frames.slice(1).map(frame => frame.rows.find(row => row.pid === 22)!)
}

export function anchorForeignConfirmation(row: DarwinProcessEntry, start = 4200) {
  row.confirmation = {
    ...processAbsolute(start, '1950'),
    before: structuredClone(row.before),
    after: structuredClone(row.after),
    pathBefore: { ...row.pathBefore },
    pathAfter: { ...row.pathAfter },
  }
}

export function anchorForeignFrames(parentPid = 1): DarwinProcessFrame[] {
  return postAnchorPhases.map((phase, index) => {
    const start = (index + 1) * 1000
    const rows = [entry(11, { rssBytes: phase === 'anchor' ? '1000' : '88888' }), ...(parentPid === 33 ? [entry(33)] : [])]
    const parent = rows.find(row => row.pid === 33)
    if (parent) {
      parent.absolute = processAbsolute(start + 100, '500')
    }
    if (phase !== 'prepare') {
      const row = entry(22, { parentPid, rssBytes: '99999', identity: { uid: 502 } })
      row.absolute = processAbsolute(start + 100, '1950')
      row.confirmation = null
      if (phase === 'anchor') {
        row.enumeratedIdentity.uid = 501
        row.pathBefore = { count: postAnchorBootstrap.length, errno: 0, executable: postAnchorBootstrap }
        row.pathAfter = { ...row.pathBefore }
        row.gaps = ['enumeration-identity-changed']
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

export function summarizeAnchorForeignFrames(frames: DarwinProcessFrame[], textConflict = false) {
  const inventory = createNativeInventory(fixtureInstallation)
  for (const frame of frames) {
    inventory.observe(normalizeNativeFrame(frame))
  }
  if (textConflict) {
    inventory.observeTextImages(22, [`${fixtureForeign}/Conflicting`], 'closure1')
  }
  return summarizeNativeInventory({ inventory, installationRoot: fixtureInstallation, samplingStartedAt: 'fixture', deadline: 10_000, textProofs: [], textObservations: [] })
}
