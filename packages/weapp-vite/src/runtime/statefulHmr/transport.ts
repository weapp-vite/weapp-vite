/* eslint-disable ts/no-use-before-define */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ViteDevServer } from 'vite'
import { Buffer } from 'node:buffer'
import { randomBytes } from 'node:crypto'
import { bundleHmrCode, readMappedHmrCode } from './patchPreparation'
import { createStatefulHmrServerState, transitionStatefulHmrServer } from './serverState'

const endpointPath = '/__weapp_vite_stateful_hmr__'
const pollTimeout = 25_000

interface ClientReport {
  action: 'ack' | 'poll' | 'rebuild' | 'register'
  buildId: string
  sessionId: string
  token: string
  version: number
  payloads?: string[]
  initialReady?: boolean
  failure?: unknown
}

interface PendingPoll {
  response: ServerResponse
  timeout: ReturnType<typeof setTimeout>
}

export class StatefulHmrTransport {
  private state = createStatefulHmrServerState(createId())
  private readonly token = createId()
  private readonly pendingPolls = new Map<string, PendingPoll>()
  private closed = false
  private suspended = false
  private confirmationChain: Promise<void> = Promise.resolve()
  private publishedVersion = 0
  private executedVersion = 0
  private clientExecutedVersion = 0
  private initialPayloads = new Map<string, () => Promise<void>>()
  private readonly initializedSessions = new Set<string>()
  private readonly executions = new Map<number, {
    resolve: () => void
    reject: (error: Error) => void
    delivered: () => Promise<void>
  }>()

  constructor(
    private readonly server: ViteDevServer,
    private readonly publishUpdate: (buildId: string, source: string) => Promise<void>,
    private readonly requestFullBuild: () => void,
  ) {}

  get retainedDeltaBytes(): number {
    return this.state.retainedDeltaBytes
  }

  get retainedDeltaCount(): number {
    return this.state.hostVersion
  }

  install(): void {
    this.server.middlewares.use(endpointPath, this.handleRequest)
  }

  close(): void {
    this.closed = true
    this.cancelPendingDeliveries()
    this.respondToAll({ type: 'rebuilding' })
  }

  addDelta(code: string, changedIds: string[], delivered?: () => Promise<void>): Promise<void> {
    this.apply({ type: 'delta-added', bytes: Buffer.byteLength(code), changedIds, code })
    const execution = Promise.withResolvers<void>()
    void execution.promise.catch(() => {})
    this.executions.set(this.state.hostVersion, { ...execution, delivered: delivered ?? (async () => {}) })
    this.respondToAll({ type: 'changed' })
    return execution.promise
  }

  cancelPendingDeliveries(): void {
    this.suspended = true
    for (const execution of this.executions.values()) {
      execution.reject(new Error('Stateful HMR delivery cancelled by full synchronization'))
    }
    this.executions.clear()
    this.publishedVersion = 0
    this.executedVersion = 0
    this.clientExecutedVersion = 0
  }

  private async acknowledge(body: ClientReport): Promise<void> {
    if (body.buildId !== this.state.buildId || body.sessionId !== this.state.activeSessionId
      || !Number.isInteger(body.version) || body.version < 0 || body.version > this.publishedVersion) {
      return
    }
    // 执行账本属于构建宿主；IDE 重建客户端会清除传输 inFlight，但不能丢弃待确认执行。
    const buildId = this.state.buildId
    for (const [version, execution] of [...this.executions]) {
      if (version > body.version) {
        break
      }
      await execution.delivered()
      if (this.state.buildId !== buildId || this.executions.get(version) !== execution) {
        return
      }
      this.executions.delete(version)
      this.executedVersion = Math.max(this.executedVersion, version)
      execution.resolve()
    }
    if (body.sessionId === this.state.activeSessionId) {
      this.clientExecutedVersion = Math.max(this.clientExecutedVersion, body.version)
    }
  }

  registerInitialPayloads(files: string[], delivered: (file: string) => Promise<void>): void {
    this.initializedSessions.clear()
    this.initialPayloads = new Map(files.map(file => [file, () => delivered(file)]))
  }

  private async acknowledgeInitial(body: ClientReport): Promise<void> {
    if (body.buildId !== this.state.buildId || body.sessionId !== this.state.activeSessionId || !Array.isArray(body.payloads)) {
      return
    }
    for (const file of body.payloads) {
      const delivered = this.initialPayloads.get(file)
      if (delivered) {
        await delivered()
        this.initialPayloads.delete(file)
      }
    }
    if (body.payloads.includes('app.js')) {
      this.initializedSessions.add(body.sessionId)
    }
  }

  createBuildId(): string {
    return createId()
  }

  commitFullBuild(buildId: string): void {
    this.cancelPendingDeliveries()
    this.apply({ type: 'full-build-committed', buildId })
    this.suspended = false
    this.respondToAll({ type: 'rebuilding' })
  }

  isCurrentBuild(buildId: string): boolean {
    return !this.suspended && this.state.buildId === buildId
  }

  createControl() {
    const address = this.server.httpServer?.address()
    const port = address && typeof address !== 'string' ? address.port : this.server.config.server.port
    return {
      buildId: this.state.buildId,
      token: this.token,
      url: `http://localhost:${port}${endpointPath}`,
    }
  }

  private readonly handleRequest = async (request: IncomingMessage, response: ServerResponse) => {
    if (this.closed || request.method !== 'POST') {
      respond(response, 404, { type: 'not-found' })
      return
    }
    let body: unknown
    try {
      body = JSON.parse(await readBody(request))
    }
    catch {
      respond(response, 400, { type: 'invalid-request' })
      return
    }
    if (!isClientReport(body) || body.token !== this.token) {
      respond(response, 403, { type: 'forbidden' })
      return
    }
    if (this.suspended) {
      respond(response, 202, { type: 'rebuilding' })
      return
    }
    if (body.action === 'rebuild') {
      const failure = body.failure
      if (failure && typeof failure === 'object' && 'reason' in failure) {
        const reason = failure.reason
        if (reason === 'bridge-not-ready' || reason === 'patch-failed') {
          const message = 'message' in failure && typeof failure.message === 'string' ? failure.message : ''
          const stack = 'stack' in failure && typeof failure.stack === 'string' ? failure.stack : ''
          this.server.config.logger.error(`[weapp-vite] stateful HMR client ${reason}: ${message}\n${stack}`)
        }
      }
      this.requestFullBuild()
      respond(response, 202, { type: 'rebuilding' })
      return
    }
    if (body.action === 'register') {
      const previousSession = this.state.activeSessionId
      const commands = this.apply({
        type: 'client-registered',
        buildId: body.buildId,
        sessionId: body.sessionId,
        version: body.version,
      })
      if (this.state.activeSessionId !== previousSession) {
        this.clientExecutedVersion = 0
      }
      if (commands.some(command => command.type === 'request-full-build')) {
        this.requestFullBuild()
      }
      try {
        const confirmation = this.confirmationChain.then(() => this.acknowledgeInitial(body))
        this.confirmationChain = confirmation.catch(() => {})
        await confirmation
      }
      catch {
        respond(response, 500, { type: 'confirmation-failed' })
        return
      }
      respond(response, 200, {
        type: 'registered',
        acknowledgement: 'explicit-v1',
        ...(body.initialReady !== undefined ? { ready: this.initializedSessions.has(body.sessionId) } : {}),
      })
      return
    }
    // 宿主可在 writeBundle 返回前执行已写出的补丁。发布尚未完成时，
    // 保留 inFlight，避免 client-reported 提前清除执行确认所需的状态。
    if (body.buildId === this.state.buildId && body.sessionId === this.state.activeSessionId
      && body.version > this.publishedVersion && body.version === this.state.inFlight?.targetVersion) {
      respond(response, 202, { type: 'publishing' })
      return
    }
    if (body.action === 'ack' && (body.buildId !== this.state.buildId || body.sessionId !== this.state.activeSessionId
      || !Number.isInteger(body.version) || body.version < 0 || body.version > this.publishedVersion)) {
      respond(response, 409, { type: 'confirmation-failed' })
      return
    }
    try {
      const confirmation = this.confirmationChain.then(async () => {
        await this.acknowledgeInitial(body)
        await this.acknowledge(body)
      })
      this.confirmationChain = confirmation.catch(() => {})
      await confirmation
    }
    catch {
      respond(response, 500, { type: 'confirmation-failed' })
      return
    }
    if (body.action === 'ack') {
      if (body.buildId !== this.state.buildId || body.sessionId !== this.state.activeSessionId || body.version > this.executedVersion) {
        respond(response, 409, { type: 'confirmation-failed' })
        return
      }
      respond(response, 200, { type: 'acknowledged', version: body.version })
      return
    }
    if (body.initialReady === false && body.buildId === this.state.buildId && body.sessionId === this.state.activeSessionId && this.initializedSessions.has(body.sessionId)) {
      respond(response, 200, { type: 'ready' })
      return
    }
    if (body.buildId === this.state.buildId && body.sessionId === this.state.activeSessionId
      && Number.isInteger(body.version) && body.version >= 0 && body.version < this.clientExecutedVersion) {
      respond(response, 200, { type: 'changed' })
      return
    }
    const commands = this.apply({
      type: 'client-reported',
      buildId: body.buildId,
      sessionId: body.sessionId,
      version: body.version,
    })
    const publish = commands.find(command => command.type === 'publish-batch')
    if (publish?.type === 'publish-batch') {
      try {
        await this.publishUpdate(publish.batch.buildId, renderBatch(publish.batch, createId()))
        if (!this.isCurrentBuild(publish.batch.buildId)) {
          respond(response, 202, { type: 'rebuilding' })
          return
        }
        this.publishedVersion = Math.max(this.publishedVersion, publish.batch.targetVersion)
        respond(response, 200, { type: 'batch-published', targetVersion: publish.batch.targetVersion })
      }
      catch {
        this.apply({
          type: 'batch-publish-failed',
          sessionId: publish.batch.sessionId,
          targetVersion: publish.batch.targetVersion,
        })
        respond(response, 500, { type: 'publish-failed' })
      }
      return
    }
    if (commands.some(command => command.type === 'request-full-build')) {
      this.requestFullBuild()
      respond(response, 202, { type: 'rebuilding' })
      return
    }
    if (commands.some(command => command.type === 'ignore-client')) {
      respond(response, 409, { type: 'rebuilding' })
      return
    }
    this.holdPoll(body.sessionId, response)
  }

  private apply(event: Parameters<typeof transitionStatefulHmrServer>[1]) {
    const transition = transitionStatefulHmrServer(this.state, event)
    this.state = transition.state
    return transition.commands
  }

  private holdPoll(sessionId: string, response: ServerResponse): void {
    const previous = this.pendingPolls.get(sessionId)
    if (previous) {
      this.finishPoll(sessionId, previous, { type: 'changed' })
    }
    const pending: PendingPoll = {
      response,
      timeout: setTimeout(() => this.finishPoll(sessionId, pending, { type: 'idle' }), pollTimeout),
    }
    this.pendingPolls.set(sessionId, pending)
    response.on('close', () => this.finishPoll(sessionId, pending))
  }

  private finishPoll(sessionId: string, pending: PendingPoll, value?: { type: string }): void {
    if (this.pendingPolls.get(sessionId) !== pending) {
      return
    }
    clearTimeout(pending.timeout)
    this.pendingPolls.delete(sessionId)
    if (value) {
      respond(pending.response, 200, value)
    }
  }

  private respondToAll(value: { type: string }): void {
    for (const [sessionId, pending] of this.pendingPolls) {
      this.finishPoll(sessionId, pending, value)
    }
  }
}

export function renderBatch(
  batch: { buildId: string, deltas: Array<{ changedIds: string[], code: string }>, fromVersion: number, targetVersion: number },
  nonce: string,
): string {
  const changedIds = [...new Set(batch.deltas.flatMap(delta => delta.changedIds))]
  const metadata = {
    buildId: batch.buildId,
    changedIds,
    compatible: true,
    fromVersion: batch.fromVersion,
    targetVersion: batch.targetVersion,
  }
  return bundleHmrCode(
    batch.deltas.map((delta, index) => readMappedHmrCode(delta.code, `delta-${batch.fromVersion + index + 1}.js`)),
    `// ${nonce}\nglobalThis.__WEAPP_VITE_STATEFUL_HMR_CLIENT__.receiveBatch(${JSON.stringify(metadata)}, () => {\n`,
    '\n});\n',
  )
}

function isClientReport(value: unknown): value is ClientReport {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Partial<ClientReport>
  return (candidate.action === 'ack' || candidate.action === 'poll' || candidate.action === 'rebuild' || candidate.action === 'register')
    && typeof candidate.buildId === 'string'
    && typeof candidate.sessionId === 'string'
    && typeof candidate.token === 'string'
    && typeof candidate.version === 'number'
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 64 * 1024) {
      throw new Error('stateful HMR request body is too large')
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function respond(response: ServerResponse, status: number, body: unknown): void {
  if (response.writableEnded) {
    return
  }
  response.statusCode = status
  response.setHeader('content-type', 'application/json')
  response.end(JSON.stringify(body))
}

function createId(): string {
  return randomBytes(16).toString('hex')
}
