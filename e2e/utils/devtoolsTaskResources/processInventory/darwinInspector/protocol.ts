import type { DarwinIdentityObservation, DarwinInspectorAbi, DarwinInspectorPhase, DarwinInspectorReady, DarwinPathObservation, DarwinProcessEntry, DarwinProcessFrame, DarwinProcessGap, DarwinProcessIdentity, DarwinTaskObservation } from './types'
import { DARWIN_INSPECTOR_PHASES } from './types'

const MAX_UINT64 = (1n << 64n) - 1n
function invalid(message: string): never {
  throw new Error(`Darwin inspector protocol: ${message}.`)
}
function record(value: unknown, keys: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !(key in value))) {
    return invalid('unexpected object shape')
  }
  return value as Record<string, unknown>
}
function integer(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    return invalid('invalid integer')
  }
  return value
}
function decimal(value: unknown, maximum = MAX_UINT64) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)$/.test(value) || value.length > 20 || BigInt(value) > maximum) {
    return invalid('invalid precise integer')
  }
  return value
}
function image(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.includes('\0')) {
    return invalid('invalid executable image')
  }
  return value
}
function identity(value: unknown, abi: DarwinInspectorAbi): DarwinProcessIdentity {
  const raw = record(value, ['pid', 'parentPid', 'uid', 'status', 'startedSeconds', 'startedMicroseconds', 'zombie'])
  const status = integer(raw.status, 0, 255)
  if (raw.zombie !== (status === abi.zombieStatus)) {
    return invalid('inconsistent zombie status')
  }
  return { pid: integer(raw.pid, 1, 0x7FFFFFFF), parentPid: integer(raw.parentPid, 0, 0x7FFFFFFF), uid: integer(raw.uid, 0, 0xFFFFFFFF), status, startedSeconds: decimal(raw.startedSeconds), startedMicroseconds: decimal(raw.startedMicroseconds, 999_999n), zombie: raw.zombie as boolean }
}
export function sameDarwinIdentity(left: DarwinProcessIdentity, right: DarwinProcessIdentity) {
  return left.pid === right.pid && left.parentPid === right.parentPid && left.uid === right.uid && left.startedSeconds === right.startedSeconds && left.startedMicroseconds === right.startedMicroseconds && left.zombie === right.zombie
}
function identityObservation(value: unknown, abi: DarwinInspectorAbi): DarwinIdentityObservation {
  const raw = record(value, ['result', 'length', 'errno', 'identity'])
  const result = integer(raw.result, -1, 0)
  const length = integer(raw.length)
  const errno = integer(raw.errno, 0, 0x7FFFFFFF)
  const complete = result === 0 && length === abi.recordSize && errno === 0
  if (!complete && raw.identity !== null) {
    return invalid('identity without a complete kernel record')
  }
  return { result, length, errno, identity: complete ? identity(raw.identity, abi) : null }
}
function pathObservation(value: unknown, abi: DarwinInspectorAbi): DarwinPathObservation {
  const raw = record(value, ['count', 'errno', 'executable'])
  const count = integer(raw.count, -1, abi.pathMax)
  const errno = integer(raw.errno, 0, 0x7FFFFFFF)
  if ((count <= 0 || errno !== 0) && raw.executable !== null) {
    return invalid('image without a successful path read')
  }
  return { count, errno, executable: count > 0 && errno === 0 ? image(raw.executable) : null }
}
function taskObservation(value: unknown, abi: DarwinInspectorAbi): DarwinTaskObservation {
  const raw = record(value, ['count', 'errno', 'identity', 'rssBytes'])
  const count = integer(raw.count, -1, 0x7FFFFFFF)
  const errno = integer(raw.errno, 0, 0x7FFFFFFF)
  const complete = count === abi.taskSize && errno === 0
  if (!complete && (raw.identity !== null || raw.rssBytes !== null)) {
    return invalid('RSS or identity without a complete task record')
  }
  return { count, errno, identity: complete ? identity(raw.identity, abi) : null, rssBytes: complete ? decimal(raw.rssBytes) : null }
}
function entry(value: unknown, abi: DarwinInspectorAbi): DarwinProcessEntry {
  const raw = record(value, ['pid', 'startedAtNanoseconds', 'endedAtNanoseconds', 'before', 'pathBefore', 'task', 'pathAfter', 'after'])
  const pid = integer(raw.pid, 1, 0x7FFFFFFF)
  const startedAtNanoseconds = decimal(raw.startedAtNanoseconds)
  const endedAtNanoseconds = decimal(raw.endedAtNanoseconds)
  if (BigInt(startedAtNanoseconds) > BigInt(endedAtNanoseconds)) {
    return invalid('reversed process interval')
  }
  const before = identityObservation(raw.before, abi)
  const after = identityObservation(raw.after, abi)
  const pathBefore = pathObservation(raw.pathBefore, abi)
  const pathAfter = pathObservation(raw.pathAfter, abi)
  const task = taskObservation(raw.task, abi)
  if ([before.identity, after.identity, task.identity].some(item => item && item.pid !== pid)) {
    return invalid('identity belongs to another PID')
  }
  const gaps: DarwinProcessGap[] = []
  if (!before.identity) {
    gaps.push('identity-before-unavailable')
  }
  if (!after.identity) {
    gaps.push('identity-after-unavailable')
  }
  if (!pathBefore.executable) {
    gaps.push('image-before-unavailable')
  }
  if (!pathAfter.executable) {
    gaps.push('image-after-unavailable')
  }
  if (before.identity && after.identity && !sameDarwinIdentity(before.identity, after.identity)) {
    gaps.push('identity-changed')
  }
  if (pathBefore.executable && pathAfter.executable && pathBefore.executable !== pathAfter.executable) {
    gaps.push('image-changed')
  }
  if (task.rssBytes === null) {
    gaps.push('rss-unavailable')
  }
  if (task.identity && (!before.identity || !after.identity || !sameDarwinIdentity(task.identity, before.identity) || !sameDarwinIdentity(task.identity, after.identity))) {
    gaps.push('rss-identity-mismatch')
  }
  if ([before.identity, after.identity, task.identity].some(item => item?.zombie)) {
    gaps.push('zombie')
  }
  return { pid, startedAtNanoseconds, endedAtNanoseconds, before, pathBefore, task, pathAfter, after, gaps }
}
/** ready 的身份和映像必须绑定本次 child，不能仅按 helper 名称排除。 */
export function parseDarwinInspectorReady(line: string, childPid: number, executable: string): DarwinInspectorReady {
  const raw = record(JSON.parse(line) as unknown, ['protocol', 'phase', 'pid', 'identity', 'executable', 'abi'])
  const abiRaw = record(raw.abi, ['recordSize', 'taskSize', 'pathMax', 'zombieStatus'])
  const abi = { recordSize: integer(abiRaw.recordSize, 1, 65_536), taskSize: integer(abiRaw.taskSize, 1, 65_536), pathMax: integer(abiRaw.pathMax, 1, 65_536), zombieStatus: integer(abiRaw.zombieStatus, 1, 255) }
  const ownIdentity = identity(raw.identity, abi)
  if (raw.protocol !== 1 || raw.phase !== 'ready' || raw.pid !== childPid || ownIdentity.pid !== childPid || ownIdentity.zombie || image(raw.executable) !== executable) {
    return invalid('unverified helper readiness')
  }
  return { protocol: 1, phase: 'ready', pid: childPid, identity: ownIdentity, executable, abi }
}
/** 清单完整性与每行证据独立校验；缺 RSS 保留为缺口，不在传输层判断归属。 */
export function parseDarwinProcessFrame(line: string, requestId: number, phase: DarwinInspectorPhase, ready: DarwinInspectorReady): DarwinProcessFrame {
  if (!Number.isSafeInteger(requestId) || requestId < 1 || requestId > 4 || DARWIN_INSPECTOR_PHASES[requestId - 1] !== phase) {
    return invalid('invalid phase/request id pair')
  }
  const raw = record(JSON.parse(line) as unknown, ['protocol', 'requestId', 'phase', 'startedAtNanoseconds', 'endedAtNanoseconds', 'enumeration', 'rows'])
  if (raw.protocol !== 1 || raw.requestId !== requestId || raw.phase !== phase) {
    return invalid('response does not match request')
  }
  const startedAtNanoseconds = decimal(raw.startedAtNanoseconds)
  const endedAtNanoseconds = decimal(raw.endedAtNanoseconds)
  if (BigInt(startedAtNanoseconds) > BigInt(endedAtNanoseconds)) {
    return invalid('reversed frame interval')
  }
  const enumeration = record(raw.enumeration, ['complete', 'bytes', 'recordSize', 'pidCount', 'pids', 'zeroPidCount'])
  const count = integer(enumeration.pidCount, 1, 100_000)
  const zeroPidCount = integer(enumeration.zeroPidCount, 0, 1)
  const bytes = integer(enumeration.bytes, 1)
  if (enumeration.complete !== true || enumeration.recordSize !== ready.abi.recordSize || bytes !== (count + zeroPidCount) * ready.abi.recordSize || !Array.isArray(enumeration.pids) || enumeration.pids.length !== count || !Array.isArray(raw.rows) || raw.rows.length !== count) {
    return invalid('incomplete process enumeration')
  }
  const pids = enumeration.pids.map(pid => integer(pid, 1, 0x7FFFFFFF))
  if (new Set(pids).size !== count) {
    return invalid('duplicate enumerated PID')
  }
  const rows = raw.rows.map(row => entry(row, ready.abi))
  const pidSet = new Set(pids)
  if (new Set(rows.map(row => row.pid)).size !== count || rows.some(row => !pidSet.has(row.pid))) {
    return invalid('missing or extra process rows')
  }
  if (rows.some(row => BigInt(row.startedAtNanoseconds) < BigInt(startedAtNanoseconds) || BigInt(row.endedAtNanoseconds) > BigInt(endedAtNanoseconds))) {
    return invalid('process interval outside frame')
  }
  const own = rows.find(row => row.pid === ready.pid)
  if (!own || own.gaps.length || !own.before.identity || !own.after.identity || !own.task.identity || !sameDarwinIdentity(own.before.identity, ready.identity) || !sameDarwinIdentity(own.after.identity, ready.identity) || !sameDarwinIdentity(own.task.identity, ready.identity) || own.pathBefore.executable !== ready.executable || own.pathAfter.executable !== ready.executable) {
    return invalid('helper ownership changed')
  }
  return { protocol: 1, requestId, phase, startedAtNanoseconds, endedAtNanoseconds, enumeration: { complete: true, bytes, recordSize: ready.abi.recordSize, pidCount: count, pids, zeroPidCount }, rows, ownedHelper: { pid: ready.pid, identity: ready.identity, executable: ready.executable, row: own } }
}
