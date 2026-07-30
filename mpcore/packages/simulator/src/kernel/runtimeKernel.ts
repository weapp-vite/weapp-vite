import { RuntimeDiagnostics } from './diagnostics'
import { RuntimeScheduler } from './scheduler'

export class RuntimeKernel {
  readonly diagnostics = new RuntimeDiagnostics()
  readonly scheduler = new RuntimeScheduler((error) => {
    this.diagnostics.record('exception', [error])
  })

  private closed = false

  assertActive() {
    if (this.closed) {
      throw new Error('The headless runtime session has already closed.')
    }
  }

  close() {
    if (this.closed) {
      return
    }
    this.closed = true
    this.scheduler.close()
  }

  get isClosed() {
    return this.closed
  }
}
