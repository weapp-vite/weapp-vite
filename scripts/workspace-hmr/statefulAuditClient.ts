export interface StatefulHmrAuditControl {
  buildId: string
  token: string
  url: string
}

interface StatefulHmrAuditResponse {
  targetVersion?: number
  version?: number
  acknowledgement?: string
  type?: string
}

type StatefulHmrAuditRequest = typeof fetch

export class StatefulHmrAuditClient {
  private control?: StatefulHmrAuditControl
  private registered = false
  private readonly sessionId: string
  private version = 0
  private explicitAcknowledgement = false

  constructor(
    private readonly request: StatefulHmrAuditRequest = fetch,
    createSessionId: () => string = () => `workspace-hmr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
  ) {
    this.sessionId = createSessionId()
  }

  /** 返回已确认的批次版本，供修改前绑定验收边界。 */
  get acknowledgedVersion() {
    return this.version
  }

  /** 是否支持产物消费后显式确认；旧基线不进入新批次协议。 */
  get supportsExplicitAcknowledgement() {
    return this.explicitAcknowledgement
  }

  async ensureRegistered(control: StatefulHmrAuditControl, timeoutMs: number, signal?: AbortSignal) {
    signal?.throwIfAborted()
    this.syncControl(control)
    if (this.registered) {
      return
    }
    const response = await this.report('register', timeoutMs, signal)
    this.explicitAcknowledgement = response.acknowledgement === 'explicit-v1'
    this.registered = true
  }

  async poll(timeoutMs: number, signal?: AbortSignal) {
    const response = await this.report('poll', timeoutMs, signal)
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

  /** 产物验收完成后确认消费；不作为真实宿主执行证明，也不改变轮询节奏。 */
  async acknowledgePublished(timeoutMs: number, signal?: AbortSignal) {
    signal?.throwIfAborted()
    if (!this.explicitAcknowledgement || this.version === 0) {
      return
    }
    const version = this.version
    const response = await this.report('ack', timeoutMs, signal)
    if (response.type !== 'acknowledged' || response.version !== version) {
      throw new Error('Stateful HMR audit acknowledgement did not confirm the consumed version.')
    }
  }

  private async report(action: 'ack' | 'poll' | 'register', timeoutMs: number, signal?: AbortSignal) {
    if (!this.control) {
      throw new Error('Stateful HMR audit client has no active control.')
    }
    signal?.throwIfAborted()
    const timeout = AbortSignal.timeout(Math.max(1, Math.ceil(timeoutMs)))
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
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
    signal?.throwIfAborted()
    if (!response.ok) {
      throw new Error(`Stateful HMR audit client ${action} failed with HTTP ${response.status}.`)
    }
    const body = await response.json() as StatefulHmrAuditResponse
    signal?.throwIfAborted()
    return body
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
    this.explicitAcknowledgement = false
  }
}
