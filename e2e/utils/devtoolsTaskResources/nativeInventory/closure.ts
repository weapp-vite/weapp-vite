import type { ProcessIdentityChangeObservation, ProcessIdentityGapCause, ProcessIdentityGapObservation } from '../types'
import type { NativeFrame, NativePhase, NativeRow } from './model'
import { insideInstallation, metadata, nativeLocation, sameNativeIdentity, validNativeImage } from './model'

export type NativeRelation = 'installation-image' | 'descendant' | 'foreign' | 'unknown'

export interface TrackedNativeProcess {
  row: NativeRow
  firstPhase: NativePhase
  absent: boolean
  changed: boolean
  classification: NativeRelation
  classifiedAt?: NativePhase
  imageSource: NativeRow['imageSource']
  causes: ProcessIdentityGapCause[]
}

/** 映像证明只供本帧归属使用，祖先也必须在相同观察帧内有自己的完整证明。 */
export function nativeRelation(frame: NativeFrame, row: NativeRow, installationRoot: string, visiting = new Set<number>()): NativeRelation {
  if (visiting.has(row.pid) || row.identityChanged || row.imageChanged || !row.identity || row.identity.zombie) {
    return 'unknown'
  }
  if (row.images?.some(image => insideInstallation(installationRoot, image))) {
    return 'installation-image'
  }
  visiting.add(row.pid)
  const parent = frame.rows.get(row.identity.parentPid)
  const relation = parent ? nativeRelation(frame, parent, installationRoot, visiting) : 'unknown'
  if (relation === 'installation-image' || relation === 'descendant') {
    return 'descendant'
  }
  if (!row.images) {
    return 'unknown'
  }
  return row.identity.parentPid <= 1 || relation === 'foreign' ? 'foreign' : 'unknown'
}

/** 准备身份、唯一锚点与两轮闭合共享永久缺口；后来的成功不能消除已观察到的漂移。 */
export function createNativeInventory(installationRoot: string) {
  const tracked = new Map<number, TrackedNativeProcess>()
  const selectedSeen = new Map<number, NativeRow>()
  const changes = new Map<number, ProcessIdentityChangeObservation>()
  const frames: NativeFrame[] = []
  const textObservations = new Map<number, string[]>()
  let anchor: NativeFrame | undefined

  function cause(entry: TrackedNativeProcess, reason: ProcessIdentityGapCause['reason'], phase: NativePhase) {
    if (!entry.causes.some(previous => previous.reason === reason)) {
      entry.causes.push({ reason, firstObserved: nativeLocation(phase) })
    }
  }

  function markChanged(entry: TrackedNativeProcess, row: NativeRow, phase: NativePhase, returned: boolean) {
    entry.changed = true
    cause(entry, 'identity-changed', phase)
    if (changes.has(row.pid)) {
      return
    }
    const first = metadata(entry.row)
    const next = metadata(row)
    const reasons: ProcessIdentityChangeObservation['reasons'] = []
    if (returned) {
      reasons.push('returned-after-absence')
    }
    if (first.startedSeconds !== next.startedSeconds || first.startedMicroseconds !== next.startedMicroseconds) {
      reasons.push('started-changed')
    }
    if (first.parentPid !== next.parentPid) {
      reasons.push('parent-changed')
    }
    if (first.zombie !== next.zombie) {
      reasons.push('zombie-changed')
    }
    changes.set(row.pid, { ...first, changedTo: next, reasons, firstObserved: nativeLocation(phase) })
  }

  function classify(frame: NativeFrame) {
    for (const row of frame.rows.values()) {
      const entry = tracked.get(row.pid)!
      if (entry.changed || !sameNativeIdentity(entry.row.identity, row.identity)) {
        continue
      }
      const relation = nativeRelation(frame, row, installationRoot)
      if (relation !== 'unknown') {
        entry.classification = relation
        entry.classifiedAt = frame.phase
        entry.imageSource = row.imageSource
      }
    }
  }

  function rememberSelected(frame: NativeFrame) {
    for (const row of frame.rows.values()) {
      const observedPaths = [row.entry.pathBefore.executable, row.entry.pathAfter.executable, ...(row.images ?? [])]
      if (observedPaths.some(image => image && insideInstallation(installationRoot, image))) {
        selectedSeen.set(row.pid, row)
      }
    }
    let added = true
    while (added) {
      added = false
      for (const row of frame.rows.values()) {
        if (!selectedSeen.has(row.pid) && row.identity && selectedSeen.has(row.identity.parentPid)) {
          selectedSeen.set(row.pid, row)
          added = true
        }
      }
    }
  }

  function reconcileEvidence() {
    const directPaths = new Map<number, string>()
    const textImages = new Map<number, string[]>()
    for (const frame of frames) {
      rememberSelected(frame)
      for (const row of frame.rows.values()) {
        const entry = tracked.get(row.pid)!
        const paths = [row.entry.pathBefore.executable, row.entry.pathAfter.executable].filter(validNativeImage)
        for (const image of paths) {
          const previous = directPaths.get(row.pid)
          const text = textImages.get(row.pid)
          const observedText = textObservations.get(row.pid)
          if ((previous && previous !== image) || (text && !text.includes(image)) || (observedText && !observedText.includes(image))) {
            entry.changed = true
            cause(entry, 'image-changed', frame.phase)
          }
          directPaths.set(row.pid, image)
        }
        if (row.imageSource === 'text-images' && row.images) {
          const previous = textImages.get(row.pid)
          const direct = directPaths.get(row.pid)
          if ((previous && JSON.stringify(previous) !== JSON.stringify(row.images)) || (direct && !row.images.includes(direct))) {
            entry.changed = true
            cause(entry, 'image-changed', frame.phase)
          }
          textImages.set(row.pid, row.images)
        }
      }
    }
  }

  function observeTextImages(pid: number, images: string[], phase: NativePhase) {
    const entry = tracked.get(pid)!
    const previous = textObservations.get(pid)
    const directPaths = frames.flatMap((frame) => {
      const row = frame.rows.get(pid)
      return row ? [row.entry.pathBefore.executable, row.entry.pathAfter.executable].filter(validNativeImage) : []
    })
    if ((previous && JSON.stringify(previous) !== JSON.stringify(images)) || directPaths.some(image => !images.includes(image))) {
      entry.changed = true
      cause(entry, 'image-changed', phase)
    }
    textObservations.set(pid, images)
    if (images.some(image => insideInstallation(installationRoot, image))) {
      selectedSeen.set(pid, entry.row)
    }
    reconcileEvidence()
  }

  function observe(frame: NativeFrame) {
    if ((frame.phase === 'prepare' && frames.length) || (frame.phase === 'anchor' && anchor)) {
      throw new Error('Resource sampling cannot replace its preparation or fixed RSS anchor.')
    }
    for (const [pid, entry] of tracked) {
      const row = frame.rows.get(pid)
      if (!row) {
        entry.absent = true
        cause(entry, 'process-absent', frame.phase)
      }
      else if (entry.absent || !sameNativeIdentity(entry.row.identity, row.identity) || row.identityChanged) {
        markChanged(entry, row.changedIdentity ? { ...row, identity: row.changedIdentity } : row, frame.phase, entry.absent)
      }
    }
    for (const row of frame.rows.values()) {
      let entry = tracked.get(row.pid)
      if (!entry) {
        entry = { row, firstPhase: frame.phase, absent: false, changed: false, classification: 'unknown', imageSource: 'not-verified', causes: [] }
        tracked.set(row.pid, entry)
      }
      if (!row.identity || !row.finalIdentity) {
        cause(entry, 'kernel-identity-unverifiable', frame.phase)
      }
      if (row.identityChanged) {
        markChanged(entry, { ...row, identity: row.changedIdentity }, frame.phase, false)
      }
      if (row.imageChanged) {
        entry.changed = true
        cause(entry, 'image-changed', frame.phase)
      }
      if (row.identity?.zombie) {
        cause(entry, 'zombie', frame.phase)
      }
    }
    frames.push(frame)
    reconcileEvidence()
    if (frame.phase === 'anchor') {
      anchor = frame
    }
    classify(frame)
  }

  function gap(entry: TrackedNativeProcess, extra?: ProcessIdentityGapCause['reason']): ProcessIdentityGapObservation {
    const current = frames.at(-1)?.rows.get(entry.row.pid)
    return {
      ...metadata(entry.row),
      final: current ? metadata(current) : null,
      causes: [...entry.causes, ...(extra && !entry.causes.some(item => item.reason === extra) ? [{ reason: extra, firstObserved: nativeLocation(anchor?.phase ?? 'prepare') }] : [])],
    }
  }

  return { tracked, selectedSeen, changes, frames, observe, observeTextImages, classify, reconcileEvidence, gap, cause, get anchor() {
    return anchor
  } }
}

export type NativeInventory = ReturnType<typeof createNativeInventory>
