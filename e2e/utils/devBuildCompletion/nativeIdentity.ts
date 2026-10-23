import type { NativePublicationProfileIdentity } from '../nativePublication/files'
import path from 'pathe'

export function normalizedSource(file: string) {
  return path.normalize(file.replaceAll('\\', '/')).replace(/^[A-Z]:/, drive => drive.toLowerCase())
}

/** 原生写出冻结的身份决定因果顺序，不比较不同进程的时钟原点。 */
export function nativeIdentitySources(value: unknown, identity: NativePublicationProfileIdentity, files: ReadonlySet<string>) {
  const sources = new Set<string>()
  if (!value || typeof value !== 'object') {
    return sources
  }
  const sample = value as Record<string, unknown>
  if (sample.schemaVersion !== 1 || sample.correlation !== 'known'
    || typeof sample.sessionId !== 'string' || !sample.sessionId
    || sample.buildId !== identity.buildId || sample.batchId !== identity.batchId
    || !Array.isArray(sample.sourceEvents)) {
    return sources
  }
  for (const value of sample.sourceEvents) {
    if (!value || typeof value !== 'object') {
      continue
    }
    const event = value as Record<string, unknown>
    if (typeof event.file !== 'string' || typeof event.eventId !== 'string' || !event.eventId
      || typeof event.receivedAtMs !== 'number' || !Number.isFinite(event.receivedAtMs) || event.receivedAtMs < 0) {
      continue
    }
    const file = normalizedSource(event.file)
    if (files.has(file) && identity.sourceEvents.some(source => source.eventId === event.eventId && normalizedSource(source.file) === file)) {
      sources.add(file)
    }
  }
  return sources
}
