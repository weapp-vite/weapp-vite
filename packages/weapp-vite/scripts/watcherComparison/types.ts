import type { FileWatchChange, FileWatchEngine, FileWatcher, FileWatchOptions, FileWatchTargets } from '../../src/runtime/watch/fileWatcher'

export interface WatcherSample {
  rssBytes: number
  handles: number
  resourceTypes: Record<string, number>
}

export interface WatcherStep {
  name: string
  latencyMs: number | null
  verificationMs: number | null
  missing: number
  duplicate: number
  notifications: number
  stateVerified: boolean
  states: WatcherVerifiedState[]
}

export interface WatcherExpectedChange extends Pick<FileWatchChange, 'file' | 'kind'> {
  event?: FileWatchChange['event']
  contents?: string
}

export interface WatcherVerifiedState {
  file: string
  expectedKind: 'missing' | 'file' | 'directory'
  observedKind: 'missing' | 'file' | 'directory' | 'other'
  expectedVersion?: string
  observedVersion?: string
  verified: boolean
}

export interface WatcherScenarioReport {
  scenario: string
  engine: FileWatchEngine
  status: 'passed' | 'failed'
  durationMs: number
  startupMs: number[]
  closeMs: number[]
  cpuMs: { user: number, system: number }
  resources: { before: WatcherSample, peak: WatcherSample, afterClose: WatcherSample }
  steps: WatcherStep[]
  notifications: Array<FileWatchChange & { receivedAtMs: number }>
  failures: string[]
  cleanupConfirmed: boolean
  retainedFixture?: string
}

export interface WatcherObservation {
  watcher: FileWatcher
  changes: Array<FileWatchChange & { receivedAtMs: number }>
  close: () => Promise<void>
}

export interface WatcherScenarioContext {
  root: string
  observe: (targets: FileWatchTargets, options?: FileWatchOptions) => WatcherObservation
  expectChanges: (
    name: string,
    observation: WatcherObservation,
    action: () => Promise<unknown>,
    expected: WatcherExpectedChange[],
  ) => Promise<void>
  expectQuiet: (name: string, observation: WatcherObservation, action: () => Promise<unknown>) => Promise<void>
  assert: (condition: unknown, message: string) => void
}

export interface WatcherScenario {
  id: string
  run: (context: WatcherScenarioContext) => Promise<void>
}
