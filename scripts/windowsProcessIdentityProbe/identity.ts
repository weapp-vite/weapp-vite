import { createHash } from 'node:crypto'

export interface ProbeIdentity {
  ProcessId: number
  ExecutablePath: string
  Started: string
  StartedAfter?: string
  TicksBefore?: string
  TicksAfter?: string
  GenerationStable?: boolean
  HasExited?: boolean
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
    startedMicrosecondTextEqual: microsecondText(cim.Started) === microsecondText(candidate.Started),
    candidateGenerationStable: candidate.GenerationStable,
    candidateStartBeforeAfterEqual: candidate.Started === candidate.StartedAfter,
    candidateHasExited: candidate.HasExited,
  }
}
