import type { InstallationProcessSample, NativeTextImageObservationEvidence, NewProcessObservation } from '../types'
import type { NativeInventory } from './closure'
import type { NativeTextImageRead, resolveAnchoredTextImages } from './fallback'
import { nativeRelation } from './closure'
import { nativeFrameEvidence, textReadEvidence } from './evidence'
import { verifiedForeignImageTransitions } from './foreignImageTransitions'
import { verifiedForeignNativeExecs } from './foreignNativeExecs'
import { insideInstallation, metadata, sameNativeIdentity } from './model'

interface SummaryOptions {
  inventory: NativeInventory
  installationRoot: string
  samplingStartedAt: string
  deadline: number
  textProofs: Array<ReturnType<typeof resolveAnchoredTextImages>[number] & { kind: 'rss-anchor-bracket' | 'closure-identity-bracket' }>
  textObservations: Array<{ read: NativeTextImageRead, phase: NativeTextImageObservationEvidence['phase'], position: NativeTextImageObservationEvidence['position'] }>
}

/** 唯一锚点决定 RSS；后续帧只补闭合证据，不补内存值或抹去历史缺口。 */
export function summarizeNativeInventory(options: SummaryOptions): InstallationProcessSample {
  const { inventory, installationRoot } = options
  const anchor = inventory.anchor
  const final = inventory.frames.at(-1)
  if (!anchor || !final || final.phase !== 'closure2') {
    throw new Error('Resource sampling did not complete its fixed native anchor and closure boundaries.')
  }
  const foreignTransitions = verifiedForeignImageTransitions(inventory, installationRoot)
  const foreignNativeExecs = verifiedForeignNativeExecs(inventory, installationRoot)
  const verifiedForeignProcesses = new Set([...foreignTransitions, ...foreignNativeExecs].map(proof => proof.process.pid))
  const preAnchorExited = new Set<number>()
  for (const entry of inventory.tracked.values()) {
    if (entry.firstPhase === 'prepare' && !anchor.rows.has(entry.row.pid) && !entry.changed && !inventory.selectedSeen.has(entry.row.pid)) {
      preAnchorExited.add(entry.row.pid)
      inventory.cause(entry, 'pre-anchor-exited', 'anchor')
    }
  }
  const unclassifiedProcesses = [...anchor.rows.values()].filter((row) => {
    const tracked = inventory.tracked.get(row.pid)!
    return !row.identity?.zombie && (!row.images || (tracked.changed && !verifiedForeignProcesses.has(row.pid)) || tracked.closureIdentityUnverifiable || nativeRelation(anchor, row, installationRoot) === 'unknown')
  }).map(row => inventory.gap(inventory.tracked.get(row.pid)!, !row.images ? 'kernel-path-unverifiable' : undefined))

  const processes: InstallationProcessSample['processes'] = []
  for (const row of anchor.rows.values()) {
    const relation = nativeRelation(anchor, row, installationRoot)
    const current = final.rows.get(row.pid)
    if ((relation !== 'installation-image' && relation !== 'descendant') || !row.images || row.rssBytes === null
      || inventory.tracked.get(row.pid)!.changed || !current || !sameNativeIdentity(row.identity, current.identity)
      || !sameNativeIdentity(current.identity, current.finalIdentity) || row.identity?.zombie) {
      continue
    }
    processes.push({
      pid: row.pid,
      parentPid: row.identity!.parentPid,
      started: metadata(row).started,
      startedSeconds: row.identity!.startedSeconds,
      startedMicroseconds: row.identity!.startedMicroseconds,
      executable: row.imageSource === 'kernel-path' && insideInstallation(installationRoot, row.images[0]!) ? row.images[0]! : null,
      installationImages: row.images.filter(image => insideInstallation(installationRoot, image)),
      rssBytes: row.rssBytes,
      membership: relation,
    })
  }
  const counted = new Set(processes.map(row => row.pid))
  const missingIdentities = [...inventory.selectedSeen].filter(([pid]) => !counted.has(pid)).map(([pid]) => {
    const row = anchor.rows.get(pid)
    return inventory.gap(inventory.tracked.get(pid)!, row?.rssBytes === null ? 'rss-unavailable' : row && !row.images ? 'kernel-path-unverifiable' : undefined)
  })
  const newProcesses: NewProcessObservation[] = [...inventory.tracked.values()].filter(entry => entry.firstPhase !== 'prepare').map(entry => ({
    ...inventory.gap(entry),
    firstSeenRound: entry.firstPhase === 'closure2' ? 3 : entry.firstPhase === 'closure1' ? 2 : 1,
    classification: verifiedForeignProcesses.has(entry.row.pid) ? 'verified-foreign' : entry.changed ? 'identity-changed' : entry.classification === 'foreign' ? 'verified-foreign' : entry.classification === 'unknown' ? 'unclassified' : entry.classification,
    imageSource: entry.imageSource,
  }))
  const uninspectedNewProcessCount = newProcesses.filter(row => row.classification === 'unclassified').length
  const newSelectedProcessCount = newProcesses.filter(row => row.classification === 'installation-image' || row.classification === 'descendant').length
  const changedCount = [...inventory.tracked.values()].filter(entry => entry.changed && !verifiedForeignProcesses.has(entry.row.pid)).length
  const inventoryBudgetExhausted = Date.now() >= options.deadline
  const verifiedMemberRssBytes = processes.reduce((sum, row) => sum + row.rssBytes, 0)
  if (!Number.isSafeInteger(verifiedMemberRssBytes)) {
    throw new TypeError('Resource sampling cannot represent the complete selected RSS total safely.')
  }
  const incomplete = unclassifiedProcesses.length || missingIdentities.length || uninspectedNewProcessCount
    || newSelectedProcessCount || changedCount || inventoryBudgetExhausted
  return {
    samplingStartedAt: options.samplingStartedAt,
    samplingCompletedAt: new Date().toISOString(),
    installationRoot,
    processes,
    verifiedMemberRssBytes,
    installationRssBytes: incomplete
      ? { status: 'unavailable', reason: 'The non-atomic installation inventory contains unclassified, changed, or newly appeared process identities.' }
      : { status: 'observed', value: verifiedMemberRssBytes },
    unclassifiedProcessCount: unclassifiedProcesses.length,
    missingIdentityCount: missingIdentities.length,
    unclassifiedProcesses,
    missingIdentities,
    identityChangedProcesses: [...inventory.changes.values()],
    preAnchorExitedProcesses: [...preAnchorExited].map(pid => inventory.gap(inventory.tracked.get(pid)!)),
    semantics: 'point-in-time-rss-not-peak',
    uninspectedNewProcessCount,
    verifiedNewForeignProcessCount: newProcesses.filter(row => row.classification === 'verified-foreign').length,
    newSelectedProcessCount,
    identityChangedProcessCount: inventory.changes.size,
    verifiedForeignImageTransitionCount: foreignTransitions.length,
    verifiedForeignImageTransitions: foreignTransitions,
    verifiedForeignNativeExecCount: foreignNativeExecs.length,
    verifiedForeignNativeExecs: foreignNativeExecs,
    newProcesses,
    inventoryRoundCount: 3,
    inventoryBudgetExhausted,
    samplingBudgetMs: 10_000,
    rssAnchor: 'single-native-anchor-frame; preparation-and-closure-rss-never-contribute',
    fallbackBudgetExhausted: [...inventory.tracked.values()].some(entry => entry.causes.some(cause => cause.reason === 'fallback-budget-exhausted')),
    coverage: 'selected-installation-inventory-and-descendants',
    atomicity: 'non-atomic-sysctl-identity-and-image-brackets; observed-continuity-does-not-prove-no-unobserved-exec',
    nativeFrames: inventory.frames.map(frame => nativeFrameEvidence(frame, installationRoot)),
    textImageProofs: options.textProofs.map(proof => ({
      pid: proof.pid,
      kind: proof.kind,
      identity: metadata(proof.before.row),
      before: textReadEvidence(proof.before, installationRoot),
      after: textReadEvidence(proof.after, installationRoot),
      accepted: proof.accepted,
      imageChanged: proof.imageChanged,
    })),
    textImageObservations: options.textObservations.map(({ read, phase, position }) => ({
      pid: read.row.pid,
      identity: metadata(read.row),
      phase,
      position,
      ...textReadEvidence(read, installationRoot),
    })),
  }
}
