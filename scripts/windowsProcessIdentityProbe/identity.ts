import { createHash } from 'node:crypto'

export interface ProbeIdentity {
  ProcessId: number
  ExecutablePath: string
  Started: string
  LegacyStarted?: string
  StartedAfter?: string
  TicksBefore?: string
  TicksAfter?: string
  GenerationStable?: boolean
  HasExited?: boolean
}

export const ENTRY_MARKER = 'WEAPP_IDENTITY_PROBE:entry'
export const TIMING_MARKER = 'WEAPP_IDENTITY_PROBE:timing:'

export interface ProbeTimings {
  queryMs: number
  serializationMs: number
}

export function readTimingMarker(line: string): ProbeTimings | undefined {
  if (!line.startsWith(TIMING_MARKER)) {
    return undefined
  }
  try {
    const value: unknown = JSON.parse(line.slice(TIMING_MARKER.length))
    if (!value || typeof value !== 'object'
      || !('queryMs' in value) || typeof value.queryMs !== 'number' || !Number.isFinite(value.queryMs) || value.queryMs < 0
      || !('serializationMs' in value) || typeof value.serializationMs !== 'number' || !Number.isFinite(value.serializationMs) || value.serializationMs < 0) {
      return undefined
    }
    return { queryMs: value.queryMs, serializationMs: value.serializationMs }
  }
  catch {
    return undefined
  }
}

/** 仅用于对照：保留 UTC 七位小数格式，截断 100ns 尾位，不经 JavaScript Date 丢失微秒。 */
export function legacyStartedText(started: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}Z$/.test(started)
    ? started.replace(/\dZ$/, '0Z')
    : undefined
}

export function hash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function redact(value: string) {
  return value
    .replace(/[A-Z]:[\\/][^\r\n"'<>|]*/gi, '<absolute-path>')
    .replace(/\\\\[^\r\n"'<>|]*/g, '<unc-path>')
}

export function readIdentity(value: unknown, pid: number): ProbeIdentity | undefined {
  if (!value || typeof value !== 'object' || !('ProcessId' in value) || value.ProcessId !== pid
    || !('ExecutablePath' in value) || typeof value.ExecutablePath !== 'string' || !value.ExecutablePath
    || !('Started' in value) || typeof value.Started !== 'string' || !value.Started) {
    return undefined
  }
  return value as ProbeIdentity
}

export function summarizeIdentity(identity: ProbeIdentity, expectedExecutable: string) {
  return {
    executableSha256: hash(identity.ExecutablePath),
    executableMatchesNodeExactly: identity.ExecutablePath === expectedExecutable,
    executableMatchesNodeIgnoringCase: identity.ExecutablePath.toLowerCase() === expectedExecutable.toLowerCase(),
    started: identity.Started,
    legacyStarted: identity.LegacyStarted,
    legacyStartedMatchesRaw: identity.LegacyStarted !== undefined && identity.LegacyStarted === legacyStartedText(identity.Started),
    startedAfter: identity.StartedAfter,
    ticksBefore: identity.TicksBefore,
    ticksAfter: identity.TicksAfter,
    ticksModulo10: identity.TicksBefore && /^\d+$/.test(identity.TicksBefore) ? String(BigInt(identity.TicksBefore) % 10n) : undefined,
    generationStable: identity.GenerationStable,
    hasExited: identity.HasExited,
  }
}

export function compareIdentities(cim: ProbeIdentity, candidate: ProbeIdentity) {
  const microsecondText = (value: string) => value.replace(/\.(\d{6})\d(?=Z|[+-]\d{2}:\d{2}$)/, '.$1')
  return {
    pidExactEqual: cim.ProcessId === candidate.ProcessId,
    executableExactEqual: cim.ExecutablePath === candidate.ExecutablePath,
    executableCaseInsensitiveEqual: cim.ExecutablePath.toLowerCase() === candidate.ExecutablePath.toLowerCase(),
    startedExactEqual: cim.Started === candidate.Started,
    legacyStartedExactEqual: candidate.LegacyStarted !== undefined && cim.Started === candidate.LegacyStarted,
    legacyStartedMatchesRaw: candidate.LegacyStarted !== undefined && candidate.LegacyStarted === legacyStartedText(candidate.Started),
    candidateContractAgrees: cim.ProcessId === candidate.ProcessId && cim.ExecutablePath === candidate.ExecutablePath
      && cim.Started === candidate.LegacyStarted && candidate.LegacyStarted === legacyStartedText(candidate.Started)
      && candidate.GenerationStable === true && candidate.HasExited === false && candidate.Started === candidate.StartedAfter
      && typeof candidate.TicksBefore === 'string' && /^\d+$/.test(candidate.TicksBefore) && candidate.TicksBefore === candidate.TicksAfter,
    startedMicrosecondTextEqual: microsecondText(cim.Started) === microsecondText(candidate.Started),
    candidateGenerationStable: candidate.GenerationStable,
    candidateStartBeforeAfterEqual: candidate.Started === candidate.StartedAfter,
    candidateHasExited: candidate.HasExited,
  }
}
