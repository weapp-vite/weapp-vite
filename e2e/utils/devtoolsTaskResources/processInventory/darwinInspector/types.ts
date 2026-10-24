export const DARWIN_INSPECTOR_PROTOCOL = 1
export const DARWIN_INSPECTOR_PHASES = ['prepare', 'anchor', 'closure1', 'closure2'] as const
export type DarwinInspectorPhase = typeof DARWIN_INSPECTOR_PHASES[number]

export interface DarwinProcessIdentity {
  pid: number
  parentPid: number
  uid: number
  status: number
  startedSeconds: string
  startedMicroseconds: string
  zombie: boolean
}

export interface DarwinIdentityObservation {
  result: number
  length: number
  errno: number
  identity: DarwinProcessIdentity | null
}

export interface DarwinPathObservation {
  count: number
  errno: number
  executable: string | null
}

export interface DarwinTaskObservation {
  count: number
  errno: number
  identity: DarwinProcessIdentity | null
  rssBytes: string | null
}

export type DarwinProcessGap = 'identity-before-unavailable' | 'identity-after-unavailable'
  | 'image-before-unavailable' | 'image-after-unavailable' | 'identity-changed'
  | 'image-changed' | 'rss-unavailable' | 'rss-identity-mismatch' | 'zombie'

export interface DarwinProcessEntry {
  pid: number
  startedAtNanoseconds: string
  endedAtNanoseconds: string
  before: DarwinIdentityObservation
  pathBefore: DarwinPathObservation
  task: DarwinTaskObservation
  pathAfter: DarwinPathObservation
  after: DarwinIdentityObservation
  gaps: DarwinProcessGap[]
}

export interface DarwinInspectorAbi {
  recordSize: number
  taskSize: number
  pathMax: number
  zombieStatus: number
}

export interface DarwinInspectorReady {
  protocol: 1
  phase: 'ready'
  pid: number
  identity: DarwinProcessIdentity
  executable: string
  abi: DarwinInspectorAbi
}

export interface DarwinProcessFrame {
  protocol: 1
  requestId: number
  phase: DarwinInspectorPhase
  startedAtNanoseconds: string
  endedAtNanoseconds: string
  enumeration: {
    complete: true
    bytes: number
    recordSize: number
    pidCount: number
    pids: number[]
    zeroPidCount: number
  }
  rows: DarwinProcessEntry[]
  ownedHelper: {
    pid: number
    identity: DarwinProcessIdentity
    executable: string
    row: DarwinProcessEntry
  }
}

export interface DarwinInspectorReader {
  readFrame: (phase: DarwinInspectorPhase) => Promise<DarwinProcessFrame>
}

export interface DarwinInspectorBuildIdentity {
  sourceHash: string
  arch: string
  sdkPath: string
  sdkBuild: string
  compilerPath: string
  compilerHash: string
  compilerVersion: string
}

export interface PreparedDarwinInspector {
  executable: string
  cacheDirectory: string
  identityKey: string
  binaryHash: string
  metadataHash: string
  identity: DarwinInspectorBuildIdentity
}
