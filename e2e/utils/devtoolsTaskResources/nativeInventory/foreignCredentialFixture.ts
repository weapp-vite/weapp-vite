import type { DarwinProcessFrame } from '../processInventory/darwinInspector/types'
import { createNativeInventory } from './closure'
import { entry, fixtureForeign, fixtureInstallation, frame } from './fixture'
import { normalizeNativeFrame } from './model'
import { postAnchorBootstrap, postAnchorPhases, processAbsolute } from './postAnchorFixture'
import { summarizeNativeInventory } from './summary'

export function foreignCredentialFrames(): DarwinProcessFrame[] {
  return postAnchorPhases.map((phase, index) => {
    const start = (index + 1) * 1000
    const foreign = entry(22, {
      executable: phase === 'prepare' ? postAnchorBootstrap : fixtureForeign,
      rssBytes: String((index + 1) * 99999),
      identity: { uid: 502 },
    })
    foreign.absolute = processAbsolute(start + 100, '500')
    foreign.confirmation = null
    if (phase === 'prepare') {
      foreign.enumeratedIdentity.uid = 501
      foreign.gaps = ['enumeration-identity-changed']
    }
    const wire = frame(phase, [entry(11, { rssBytes: phase === 'anchor' ? '1000' : '88888' }), foreign])
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

export function foreignCredentialRows(frames: DarwinProcessFrame[]) {
  return frames.map(frame => frame.rows.find(row => row.pid === 22)!)
}

export function summarizeForeignCredentialFrames(frames: DarwinProcessFrame[], options: { textConflict?: boolean, deadline?: number } = {}) {
  const inventory = createNativeInventory(fixtureInstallation)
  for (const frame of frames) {
    inventory.observe(normalizeNativeFrame(frame))
  }
  if (options.textConflict) {
    inventory.observeTextImages(22, [`${fixtureForeign}/Conflicting`], 'closure1')
  }
  return summarizeNativeInventory({ inventory, installationRoot: fixtureInstallation, samplingStartedAt: 'fixture', deadline: options.deadline ?? 10_000, textProofs: [], textObservations: [] })
}
