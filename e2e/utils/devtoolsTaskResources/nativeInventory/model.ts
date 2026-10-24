import type { DarwinProcessEntry, DarwinProcessFrame, DarwinProcessIdentity } from '../processInventory/darwinInspector/types'
import type { ProcessIdentityMetadata, ProcessInventoryLocation } from '../types'
import path from 'node:path'

export type NativePhase = DarwinProcessFrame['phase']

export function insideInstallation(root: string, executable: string) {
  const relative = path.relative(root, executable)
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))
}

export interface NativeRow {
  pid: number
  identity: DarwinProcessIdentity | null
  finalIdentity: DarwinProcessIdentity | null
  rssBytes: number | null
  images: string[] | null
  imageSource: 'kernel-path' | 'text-images' | 'not-verified'
  entry: DarwinProcessEntry
  identityChanged: boolean
  changedIdentity: DarwinProcessIdentity | null
  imageChanged: boolean
}

export interface NativeFrame {
  phase: NativePhase
  rows: Map<number, NativeRow>
  wire: DarwinProcessFrame
}

/** 普通调度状态可变化；精确启动身份、父进程和终止状态不能变化。 */
export function sameNativeIdentity(first: DarwinProcessIdentity | null, second: DarwinProcessIdentity | null) {
  return first !== null && second !== null && first.pid === second.pid && first.parentPid === second.parentPid
    && first.startedSeconds === second.startedSeconds && first.startedMicroseconds === second.startedMicroseconds
    && first.zombie === second.zombie
}

/** PID 枚举后已退出必须由全部相邻查询共同证明，权限失败或部分成功不能冒充退出。 */
export function hasNativeExitEvidence(row: NativeRow) {
  const { before, after, pathBefore, pathAfter, task } = row.entry
  const absentIdentity = (read: typeof before) => read.identity === null
    && ((read.result === 0 && read.length === 0 && read.errno === 0) || (read.result === -1 && read.errno === 3))
  return absentIdentity(before) && absentIdentity(after)
    && [pathBefore, pathAfter].every(read => read.count === 0 && read.errno === 3 && read.executable === null)
    && task.count === 0 && task.errno === 3 && task.identity === null && task.rssBytes === null
}

export function validNativeImage(image: string | null): image is string {
  return typeof image === 'string' && path.isAbsolute(image) && !/[\r\n\0]/.test(image)
}

export function metadata(row: NativeRow): ProcessIdentityMetadata {
  const identity = row.identity
  return {
    pid: row.pid,
    parentPid: identity?.parentPid ?? 0,
    started: identity ? `${identity.startedSeconds}.${identity.startedMicroseconds.padStart(6, '0')}` : 'unverified',
    zombie: identity?.zombie ?? false,
    startedSeconds: identity?.startedSeconds ?? null,
    startedMicroseconds: identity?.startedMicroseconds ?? null,
    status: identity?.status ?? null,
  }
}

export function nativeLocation(phase: NativePhase): ProcessInventoryLocation {
  return { round: phase === 'closure2' ? 3 : phase === 'closure1' ? 2 : 1, phase }
}

/** 映像证明只取同一行相邻内核调用；RSS 还必须绑定相同的精确身份。 */
export function normalizeNativeFrame(wire: DarwinProcessFrame): NativeFrame {
  const rows = new Map<number, NativeRow>()
  for (const entry of wire.rows) {
    const before = entry.before.identity
    const after = entry.after.identity
    const canonical = before ?? after
    const stable = sameNativeIdentity(before, after) && before?.zombie === false
    const firstPath = entry.pathBefore.executable
    const secondPath = entry.pathAfter.executable
    const imageChanged = validNativeImage(firstPath) && validNativeImage(secondPath) && firstPath !== secondPath
    const taskStable = sameNativeIdentity(before, entry.task.identity)
    const changedIdentity = canonical === null ? null : [entry.task.identity, before, after].find(identity => identity !== null && !sameNativeIdentity(canonical, identity)) ?? null
    const rss = entry.task.rssBytes === null ? null : Number(entry.task.rssBytes)
    rows.set(entry.pid, {
      pid: entry.pid,
      identity: canonical,
      finalIdentity: after,
      rssBytes: stable && taskStable && rss !== null && Number.isSafeInteger(rss) && rss >= 0 ? rss : null,
      images: stable && validNativeImage(firstPath) && firstPath === secondPath ? [firstPath] : null,
      imageSource: stable && validNativeImage(firstPath) && firstPath === secondPath ? 'kernel-path' : 'not-verified',
      entry,
      identityChanged: changedIdentity !== null,
      changedIdentity,
      imageChanged,
    })
  }
  const owned = rows.get(wire.ownedHelper.pid)
  if (!owned || owned.identityChanged || owned.imageChanged || !sameNativeIdentity(owned.identity, wire.ownedHelper.identity)
    || !sameNativeIdentity(owned.finalIdentity, wire.ownedHelper.identity) || !sameNativeIdentity(owned.entry.task.identity, wire.ownedHelper.identity)
    || owned.entry.pathBefore.executable !== wire.ownedHelper.executable || owned.entry.pathAfter.executable !== wire.ownedHelper.executable) {
    throw new Error('Resource sampling cannot verify its exact owned native inspector.')
  }
  rows.delete(wire.ownedHelper.pid)
  return { phase: wire.phase, rows, wire }
}
