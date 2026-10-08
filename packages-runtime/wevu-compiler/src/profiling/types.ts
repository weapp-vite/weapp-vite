export interface CompilerProfileSpan {
  id: number
  parentId?: number
  name: string
  startMs: number
  endMs: number
  wallMs: number
  selfWallMs: number
  status: 'complete' | 'failed'
}

export interface CompilerObservation {
  wallMs: number
  cpu: { userMs: number, systemMs: number, scope: 'process' }
  spans: CompilerProfileSpan[]
  counters: Partial<Record<'babelParseCalls' | 'babelGenerateCalls' | 'babelTraverseCalls', number>>
  unattributedWallMs: number
  coverage: {
    durations: 'inclusive wall time; nested spans must not be added'
    cpu: 'process-wide CPU during the root call; not phase CPU or exclusive thread CPU'
    counters: 'compiler Babel wrapper calls only; Vue, Oxc and native internal parses are not counted'
  }
}

export interface ObservedCompilerResult<T> {
  value: T
  observation: CompilerObservation
}
