import type { VerifiedTerminalProcess } from '../types'
import type { NativeInventory } from './closure'
import { DARWIN_INSPECTOR_PHASES } from '../processInventory/darwinInspector/types'
import { preparedForeignAncestry } from './anchorExits'
import { nativeRelation } from './closure'
import { completeNativeLiveRow, hasNativeExitEvidence, metadata, sameNativeIdentity } from './model'
import { sameInstance, terminalRow } from './terminalEvidence'

/** 明确终止的任务不再持有映像或 RSS；此证明不授予窗口、安装或进程所有权。 */
export function verifiedTerminalProcesses(inventory: NativeInventory, installationRoot: string): VerifiedTerminalProcess[] {
  const { frames, tracked, selectedSeen } = inventory
  if (frames.length !== DARWIN_INSPECTOR_PHASES.length || frames.some((frame, index) => frame.phase !== DARWIN_INSPECTOR_PHASES[index])) {
    return []
  }
  const proofs: VerifiedTerminalProcess[] = []
  const closure = frames[2]!
  const final = frames[3]!
  for (const [pid, entry] of tracked) {
    if (selectedSeen.has(pid) || entry.imageEvidenceConflict || entry.textImageEvidenceConflict
      || entry.causes.some(cause => !['identity-changed', 'zombie', 'kernel-identity-unverifiable', 'process-absent'].includes(cause.reason))) {
      continue
    }
    const row = entry.row
    const enumerated = row.entry.enumeratedIdentity
    const parent = closure.rows.get(enumerated.parentPid)
    const parentIdentity = parent?.identity
    const finalParent = final.rows.get(enumerated.parentPid)
    if (entry.firstPhase === 'closure2' && !entry.changed
      && row.identity === null && row.finalIdentity === null && row.images === null
      && !row.entry.confirmation && hasNativeExitEvidence(row) && finalParent && finalParent.identity) {
      const parentSeconds = BigInt(finalParent.identity.startedSeconds)
      const childSeconds = BigInt(enumerated.startedSeconds)
      if (parentSeconds <= childSeconds && (parentSeconds !== childSeconds
        || BigInt(finalParent.identity.startedMicroseconds) <= BigInt(enumerated.startedMicroseconds))) {
        const ancestry = preparedForeignAncestry(inventory, final, finalParent.pid, installationRoot)
        if (ancestry) {
          // 最后一帧同一观察中的完整 ESRCH 证明已确认该外部短命进程退出。
          proofs.push({
            process: inventory.gap(entry),
            terminalIdentity: metadata({ ...row, identity: enumerated }),
            firstTerminalPhase: 'closure2',
            proof: 'post-anchor-enumeration-then-kernel-exit',
            phases: ['closure2'],
            ancestry: [metadata(finalParent), ...ancestry],
            semantics: 'terminated-task-without-executable-or-rss; no-ownership-inference',
          })
          continue
        }
      }
    }
    if (entry.firstPhase === 'closure1' && !entry.changed && !final.rows.has(pid)
      && row.identity === null && row.finalIdentity === null && row.images === null
      && !row.entry.confirmation && hasNativeExitEvidence(row) && parent && parentIdentity) {
      const parentSeconds = BigInt(parentIdentity.startedSeconds)
      const childSeconds = BigInt(enumerated.startedSeconds)
      if (parentSeconds > childSeconds || (parentSeconds === childSeconds
        && BigInt(parentIdentity.startedMicroseconds) > BigInt(enumerated.startedMicroseconds))) {
        continue
      }
      const ancestry = preparedForeignAncestry(inventory, closure, parent.pid, installationRoot)
      if (!ancestry || [metadata(parent), ...ancestry].some(identity => tracked.get(identity.pid)?.changed)) {
        continue
      }
      // 仅闭合帧枚举到的进程已由内核证实退出。父进程证据用于排除所选安装的后代。
      proofs.push({
        process: inventory.gap(entry),
        terminalIdentity: metadata({ ...row, identity: enumerated }),
        firstTerminalPhase: 'closure1',
        proof: 'post-anchor-enumeration-then-kernel-exit',
        phases: ['closure1', 'closure2'],
        ancestry: [metadata(parent), ...ancestry],
        semantics: 'terminated-task-without-executable-or-rss; no-ownership-inference',
      })
      continue
    }
    const firstIndex = frames.findIndex(frame => frame.rows.has(pid))
    const terminalIndex = frames.findIndex(frame => frame.rows.get(pid) && terminalRow(frame.rows.get(pid)!))
    if (firstIndex < 0 || terminalIndex < 0 || terminalIndex >= frames.length - 1) {
      continue
    }
    const first = frames[firstIndex]!.rows.get(pid)!
    const terminal = frames[terminalIndex]!.rows.get(pid)!
    const ancestry = new Map<number, ReturnType<typeof metadata>>()
    const liveBeforeTerminal = firstIndex !== terminalIndex
    let valid = true
    if (liveBeforeTerminal) {
      // 活体必须在唯一 RSS 锚点前后均完整证明为外部进程，未知活体消失仍是缺口。
      valid = firstIndex === 0 && terminalIndex >= 2 && first.imageSource === 'kernel-path' && first.images?.length === 1
      for (const frame of frames.slice(0, terminalIndex)) {
        let row = frame.rows.get(pid)
        if (!row) {
          valid = false
          break
        }
        const visited = new Set<number>()
        while (valid && row) {
          const initial = frames[0]!.rows.get(row.pid)
          if (!initial || visited.has(row.pid) || selectedSeen.has(row.pid) || row.identityChanged || row.imageChanged
            || !sameNativeIdentity(initial.identity, row.identity) || !sameNativeIdentity(row.identity, row.finalIdentity)
            || initial.identity?.uid !== row.identity?.uid || !completeNativeLiveRow(row) || row.images?.[0] !== initial.images?.[0]
            || nativeRelation(frame, row, installationRoot) !== 'foreign') {
            valid = false
            break
          }
          visited.add(row.pid)
          if (row.pid !== pid) {
            ancestry.set(row.pid, metadata(row))
          }
          row = row.identity!.parentPid <= 1 ? undefined : frame.rows.get(row.identity!.parentPid)
        }
      }
    }
    let absent = false
    for (const frame of frames.slice(terminalIndex)) {
      const row = frame.rows.get(pid)
      if (!row || hasNativeExitEvidence(row)) {
        absent = true
      }
      else if (absent || !terminalRow(row) || !sameInstance(first.identity, row.identity)) {
        valid = false
      }
    }
    if (valid) {
      proofs.push({
        process: inventory.gap(entry),
        terminalIdentity: metadata(terminal),
        firstTerminalPhase: frames[terminalIndex]!.phase,
        proof: liveBeforeTerminal ? 'anchor-proven-foreign-then-kernel-terminal' : 'only-kernel-terminal-identities-observed',
        phases: frames.slice(firstIndex).map(frame => frame.phase),
        ancestry: [...ancestry.values()],
        semantics: 'terminated-task-without-executable-or-rss; no-ownership-inference',
      })
    }
  }
  return proofs
}
