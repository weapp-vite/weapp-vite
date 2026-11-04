import type { DarwinAbsoluteInterval, DarwinProcessAbsoluteEvidence, DarwinProcessIdentity } from '../processInventory/darwinInspector/types'
import type { NativeRow } from './model'
import { sameNativeIdentity } from './model'

/** 只比较同一原生时钟域中的精确整数，不把 wall/monotonic 时间换算成出生证明。 */
export function absoluteTicks(value: string | null | undefined): bigint | null {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)$/.test(value)) {
    return null
  }
  const ticks = BigInt(value)
  return ticks <= 18446744073709551615n ? ticks : null
}

/** 原 UID 必须是完整的无符号整数，缺失值不能通过相互等值成为凭据证明。 */
export function validNativeUid(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xFFFFFFFF
}

export function sameCredentials(first: DarwinProcessIdentity | null, next: DarwinProcessIdentity | null) {
  return sameNativeIdentity(first, next) && validNativeUid(first?.uid) && validNativeUid(next?.uid)
    && first!.uid === next!.uid
}

export function absoluteWithin(inner: DarwinAbsoluteInterval | undefined, outer: DarwinAbsoluteInterval | undefined) {
  const values = [inner?.startedAtTicks, inner?.endedAtTicks, outer?.startedAtTicks, outer?.endedAtTicks].map(absoluteTicks)
  const [start, end, outerStart, outerEnd] = values
  return inner?.clockDomain === 'mach-absolute-ticks' && outer?.clockDomain === inner.clockDomain
    && start !== null && end !== null && outerStart !== null && outerEnd !== null
    && start !== undefined && end !== undefined && outerStart !== undefined && outerEnd !== undefined
    && start >= outerStart && end >= start && end <= outerEnd
}

/** 身份双读包围出生读取，出生双读包围映像/RSS 查询；退出或失败不能证明活体归属。 */
export function postAnchorBirth(absolute: DarwinProcessAbsoluteEvidence | undefined, anchorEnd: bigint, expected?: bigint): bigint | null {
  if (!absolute || absolute.clockDomain !== 'mach-absolute-ticks') {
    return null
  }
  const start = absoluteTicks(absolute.startedAtTicks)
  const end = absoluteTicks(absolute.endedAtTicks)
  const reads = [absolute.birthBefore, absolute.birthAfter]
  let previousEnd = start
  let birth = expected
  for (const read of reads) {
    const value = absoluteTicks(read.birthTicks)
    const readStart = absoluteTicks(read.startedAtTicks)
    const readEnd = absoluteTicks(read.endedAtTicks)
    if (start === null || end === null || previousEnd === null || readStart === null || readEnd === null || value === null
      || read.result !== 0 || read.errno !== 0 || read.exitTicks !== '0' || value === 0n || value <= anchorEnd || value > readStart
      || readStart < previousEnd || readEnd < readStart || readEnd > end || (birth !== undefined && value !== birth)) {
      return null
    }
    birth = value
    previousEnd = readEnd
  }
  return birth ?? null
}

/** 枚举仅允许凭据不同；所有逐行身份必须是同一活体，RSS 原始读取不得缺失。 */
export function completePostAnchorRow(row: NativeRow) {
  const { before, task, after, enumeratedIdentity, gaps } = row.entry
  return [before, after].every(read => read.result === 0 && read.errno === 0 && read.length > 0 && read.identity !== null)
    && before.identity?.pid === row.pid && !before.identity.zombie
    && sameNativeIdentity(enumeratedIdentity, before.identity)
    && sameCredentials(before.identity, after.identity) && sameCredentials(before.identity, task.identity)
    && task.count > 0 && task.errno === 0 && absoluteTicks(task.rssBytes) !== null
    && gaps.every(gap => gap === 'enumeration-identity-changed' || gap === 'image-changed')
}
