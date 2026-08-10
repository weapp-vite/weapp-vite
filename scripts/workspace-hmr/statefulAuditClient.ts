export interface StatefulHmrAuditControl {
  buildId: string
  token: string
  url: string
}

interface StatefulHmrAuditResponse {
  targetVersion?: number
  type?: string
}

type StatefulHmrAuditRequest = typeof fetch

export class StatefulHmrAuditClient {
  private control?: StatefulHmrAuditControl
  private registered = false
  private readonly sessionId: string
  private version = 0

  constructor(
    private readonly request: StatefulHmrAuditRequest = fetch,
    createSessionId: () => string = () => `workspace-hmr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
  ) {
    this.sessionId = createSessionId()
  }

  async ensureRegistered(control: StatefulHmrAuditControl, timeoutMs: number) {
    this.syncControl(control)
    if (this.registered) {
      return
    }
    await this.report('register', timeoutMs)
    this.registered = true
  }

  async poll(timeoutMs: number) {
    const response = await this.report('poll', timeoutMs)
    if (response.type === 'batch-published') {
      const { targetVersion } = response
      if (typeof targetVersion !== 'number' || !Number.isInteger(targetVersion) || targetVersion < this.version) {
        throw new Error('Stateful HMR audit server returned an invalid target version.')
      }
      this.version = targetVersion
    }
    else if (response.type === 'rebuilding') {
      this.registered = false
    }
    return response
  }

  private async report(action: 'poll' | 'register', timeoutMs: number) {
    if (!this.control) {
      throw new Error('Stateful HMR audit client has no active control.')
    }
    const response = await this.request(this.control.url, {
      body: JSON.stringify({
        action,
        buildId: this.control.buildId,
        sessionId: this.sessionId,
        token: this.control.token,
        version: this.version,
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      signal: AbortSignal.timeout(Math.max(1, timeoutMs)),
    })
    if (!response.ok) {
      throw new Error(`Stateful HMR audit client ${action} failed with HTTP ${response.status}.`)
    }
    return await response.json() as StatefulHmrAuditResponse
  }

  private syncControl(control: StatefulHmrAuditControl) {
    if (
      this.control?.buildId === control.buildId
      && this.control.token === control.token
      && this.control.url === control.url
    ) {
      return
    }
    this.control = control
    this.registered = false
    this.version = 0
  }
}
