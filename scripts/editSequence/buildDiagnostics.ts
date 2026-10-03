interface DiagnosticEvent {
  id: number
  phase: string
  status: 'started' | 'completed' | 'failed' | 'observed'
  atMs: number
  details?: unknown
}

const EVENT_LIMIT = 32

/** 只在内存中保留有限的等待边界；失败时由最外层观察者提取，不写日志或源码内容。 */
export class SequenceBuildDiagnostics {
  private readonly origin = performance.now()
  private readonly events: DiagnosticEvent[] = []
  private readonly pending = new Map<number, DiagnosticEvent>()
  private sequence = 0
  private droppedEvents = 0
  private droppedPending = 0

  constructor(private readonly inspect: () => unknown) {}

  private append(event: DiagnosticEvent) {
    this.events.push(event)
    if (this.events.length > EVENT_LIMIT) {
      this.events.shift()
      this.droppedEvents++
    }
  }

  record(phase: string, details?: unknown) {
    this.append({ id: ++this.sequence, phase, status: 'observed', atMs: performance.now() - this.origin, details })
  }

  begin(phase: string) {
    const event: DiagnosticEvent = { id: ++this.sequence, phase, status: 'started', atMs: performance.now() - this.origin }
    this.pending.set(event.id, event)
    if (this.pending.size > EVENT_LIMIT) {
      this.pending.delete(this.pending.keys().next().value!)
      this.droppedPending++
    }
    this.append(event)
    return event
  }

  end(event: DiagnosticEvent, status: 'completed' | 'failed') {
    this.append({ ...event, status, atMs: performance.now() - this.origin })
    this.pending.delete(event.id)
  }

  snapshot() {
    return {
      clock: 'performance.now',
      elapsedMs: performance.now() - this.origin,
      state: this.inspect(),
      pending: [...this.pending.values()],
      events: [...this.events],
      droppedEvents: this.droppedEvents,
      droppedPending: this.droppedPending,
    }
  }
}
