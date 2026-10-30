import type { DarwinProcessIdentity } from '../processInventory/darwinInspector/types'
import type { NativeRow } from './model'
import { sameNativeIdentity } from './model'

/** 终止只接受同帧双身份为 zombie，映像与任务查询均明确 ESRCH 的内核证据。 */
export function terminalRow(row: NativeRow) {
  const { before, after, pathBefore, pathAfter, task } = row.entry
  return [before, after].every(read => read.result === 0 && read.length > 0 && read.errno === 0
    && read.identity?.pid === row.pid && read.identity.zombie && read.identity.status === 5)
  && sameNativeIdentity(before.identity, after.identity) && before.identity?.uid === after.identity?.uid
  && !row.identityChanged && !row.imageChanged
  && [pathBefore, pathAfter].every(read => read.count === 0 && read.errno === 3 && read.executable === null)
  && task.count === 0 && task.errno === 3 && task.identity === null && task.rssBytes === null
  && row.entry.gaps.every(gap => ['image-before-unavailable', 'image-after-unavailable', 'rss-unavailable', 'zombie'].includes(gap))
}

/** zombie 状态转移不等于 PID 复用；其余精确身份与凭据仍须逐项一致。 */
export function sameInstance(first: DarwinProcessIdentity | null, next: DarwinProcessIdentity | null) {
  return first !== null && next !== null && sameNativeIdentity({ ...first, zombie: next.zombie }, next)
    && first.uid === next.uid
}
