/* eslint-disable ts/no-use-before-define */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ViteDevServer } from 'vite'
import { Buffer } from 'node:buffer'
import { randomBytes } from 'node:crypto'
import { createStatefulHmrServerState, transitionStatefulHmrServer } from './serverState'

const endpointPath = '/__weapp_vite_stateful_hmr__'
const pollTimeout = 25_000

interface ClientReport {
  action: 'poll' | 'rebuild' | 'register'
  buildId: string
  sessionId: string
  token: string
  version: number
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
    this.respondToAll({ type: 'rebuilding' })
  }

  addDelta(code: string): void {
    this.apply({ type: 'delta-added', bytes: Buffer.byteLength(code), code })
    this.respondToAll({ type: 'changed' })
  }

  createBuildId(): string {
    return createId()
  }

  commitFullBuild(buildId: string): void {
    this.apply({ type: 'full-build-committed', buildId })
    this.respondToAll({ type: 'rebuilding' })
  }

  isCurrentBuild(buildId: string): boolean {
    return this.state.buildId === buildId
  }

  createControl() {
    const address = this.server.httpServer?.address()
    const port = address && typeof address !== 'string' ? address.port : this.server.config.server.port
    return {
      buildId: this.state.buildId,
      token: this.token,
      url: `http://127.0.0.1:${port}${endpointPath}`,
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
    if (body.action === 'rebuild') {
      this.requestFullBuild()
      respond(response, 202, { type: 'rebuilding' })
      return
    }
    if (body.action === 'register') {
      const commands = this.apply({
        type: 'client-registered',
        buildId: body.buildId,
        sessionId: body.sessionId,
        version: body.version,
      })
      if (commands.some(command => command.type === 'request-full-build')) {
        this.requestFullBuild()
      }
      respond(response, 200, { type: 'registered' })
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
  batch: { buildId: string, deltas: Array<{ code: string }>, fromVersion: number, targetVersion: number },
  nonce: string,
): string {
  const metadata = {
    buildId: batch.buildId,
    compatible: true,
    fromVersion: batch.fromVersion,
    targetVersion: batch.targetVersion,
  }
  const code = batch.deltas.map(delta => delta.code).join('\n')
  return `// ${nonce}\nglobalThis.__WEAPP_VITE_STATEFUL_HMR_CLIENT__.receiveBatch(${JSON.stringify(metadata)}, () => {\n${indent(code, 2)}\n});\n`
}

function indent(value: string, spaces: number): string {
  const prefix = ' '.repeat(spaces)
  return value.split('\n').map(line => `${prefix}${line}`).join('\n')
}

function isClientReport(value: unknown): value is ClientReport {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Partial<ClientReport>
  return (candidate.action === 'poll' || candidate.action === 'rebuild' || candidate.action === 'register')
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
