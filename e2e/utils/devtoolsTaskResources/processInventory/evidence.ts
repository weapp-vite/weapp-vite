import type { ProcessIdentityGapCause, ProcessIdentityGapObservation, ProcessIdentityMetadata } from '../types'
import type { ProcessRow } from './index'

/** 只保留明确列出的身份字段，避免进程采样实现增加字段时泄露其他元数据。 */
export function processIdentityMetadata(row: ProcessRow): ProcessIdentityMetadata {
  return { pid: row.pid, parentPid: row.parentPid, started: row.started, zombie: row.zombie }
}

/** 每种原因保留首次事实；末次身份只提供上下文，不覆盖缺口发生的位置。 */
export function processGapObservation(
  row: ProcessRow,
  final: ProcessRow | undefined,
  imageGap: ProcessIdentityGapCause | undefined,
  identityGaps: ProcessIdentityGapCause[] | undefined,
): ProcessIdentityGapObservation {
  const causes = imageGap ? [imageGap] : []
  for (const cause of identityGaps ?? []) {
    if (!causes.some(previous => previous.reason === cause.reason)) {
      causes.push(cause)
    }
  }
  return { ...processIdentityMetadata(row), final: final ? processIdentityMetadata(final) : null, causes }
}
