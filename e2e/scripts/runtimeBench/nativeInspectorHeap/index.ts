import type { ServerResponse } from 'node:http'
import type { BenchHeapSampleContext, NativeInspectorHandshake, NativeInspectorHeapEvidence, NativeInspectorHeapIdentity } from './protocol'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { performance } from 'node:perf_hooks'
import { clearTimeout, setTimeout } from 'node:timers'
import { createNativeInspectorHeapExpression } from './expression'
import { isRecord, NATIVE_HEAP_TIMEOUT_MS, validateHeapSampleContext, validateNativeInspectorHandshake, validateNativeInspectorHeapResponse, validateNativeInspectorIdentity } from './protocol'
import { readNativeInspectorJson, respondNativeInspector } from './transport'

interface PendingRead {
  sequence: number
  nonce: string
  context: BenchHeapSampleContext
  requestedAt: string
  startedMono: number
  delivered: boolean
  timer: ReturnType<typeof setTimeout>
  resolve: (evidence: NativeInspectorHeapEvidence) => void
  reject: (error: Error) => void
}

/** 测试专用回环通道；Console 安装必须由 Computer Use 完成，默认 automator 路径不受影响。 */
export async function createNativeInspectorHeapCollector(options: NativeInspectorHeapIdentity) {
  const identity = Object.freeze({ ...options })
  validateNativeInspectorIdentity(identity)
  const token = randomBytes(32).toString('hex')
  const origin = 'devtools://devtools'
  const records: NativeInspectorHeapEvidence[] = []
  const rawResponses: Array<{ receivedAtNode: string, body: unknown }> = []
  let handshake: NativeInspectorHandshake | undefined
  let lastRequestId = 0
  let sequence = 0
  let pending: PendingRead | undefined
  let poll: ServerResponse | undefined
  let failure: Error | undefined
  let closed = false
  let closePromise: Promise<void> | undefined
  let resolveReady!: () => void
  let rejectReady!: (error: Error) => void
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  // 安装或关闭失败也保留拒绝结果；执行者可能尚未开始等待 Console 握手。
  void ready.catch(() => {})
  const fail = (error: unknown) => {
    failure ??= error instanceof Error ? error : new Error(String(error))
    rejectReady(failure)
    if (pending) {
      clearTimeout(pending.timer)
      pending.reject(failure)
      pending = undefined
    }
    if (poll) {
      respondNativeInspector(poll, 409, { error: failure.message })
      poll = undefined
    }
    return failure
  }
  const dispatch = () => {
    if (poll && pending && !pending.delivered) {
      pending.delivered = true
      respondNativeInspector(poll, 200, { sequence: pending.sequence, nonce: pending.nonce })
      poll = undefined
    }
  }
  const server = createServer((request, response) => {
    void (async () => {
      if (request.headers.origin !== origin) {
        respondNativeInspector(response, 403, { error: 'Expected official native Inspector origin' })
        return
      }
      response.setHeader('Access-Control-Allow-Origin', origin)
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Runtime-Bench-Token')
      if (request.method === 'OPTIONS') {
        respondNativeInspector(response, 204)
        return
      }
      if (request.headers['x-runtime-bench-token'] !== token) {
        respondNativeInspector(response, 403, { error: 'Invalid test collector token' })
        return
      }
      if (closed) {
        respondNativeInspector(response, 204)
        return
      }
      if (failure && !(request.method === 'POST' && request.url === '/result')) {
        respondNativeInspector(response, 409, { error: failure.message })
        return
      }
      if (request.method === 'GET' && request.url === '/next') {
        if (!handshake || poll) {
          throw new Error('Native Inspector collector is not ready or has concurrent polls')
        }
        poll = response
        response.once('close', () => {
          if (poll === response) {
            poll = undefined
            if (!closed && !response.writableFinished) {
              fail(new Error('Native Inspector collector disconnected while waiting for a checkpoint'))
            }
          }
        })
        dispatch()
        return
      }
      if (request.method !== 'POST' || !['/ready', '/result', '/failed'].includes(request.url ?? '')) {
        respondNativeInspector(response, 404)
        return
      }
      const body = await readNativeInspectorJson(request)
      if (closed) {
        respondNativeInspector(response, 204)
        return
      }
      if (request.url === '/failed') {
        if (!isRecord(body) || body.sessionId !== identity.sessionId) {
          throw new Error('Native Inspector frontend failure record belongs to another session')
        }
        throw new Error(`Native Inspector frontend failed: ${isRecord(body) ? String(body.message) : 'invalid failure record'}`)
      }
      if (request.url === '/ready') {
        if (handshake) {
          throw new Error('Duplicate native Inspector collector handshake')
        }
        handshake = validateNativeInspectorHandshake(body, identity)
        lastRequestId = handshake.isolateRequestId
        respondNativeInspector(response, 200)
        resolveReady()
        return
      }
      const receivedAtNode = new Date().toISOString()
      rawResponses.push({ receivedAtNode, body })
      if (!pending || !pending.delivered || !isRecord(body)
        || body.sequence !== pending.sequence || body.nonce !== pending.nonce || body.sessionId !== identity.sessionId) {
        throw new Error('Late, duplicate, or uncorrelated native Inspector heap response')
      }
      const elapsedMs = performance.now() - pending.startedMono
      if (elapsedMs > NATIVE_HEAP_TIMEOUT_MS) {
        throw new Error('Native Inspector heap response arrived after the original 2500ms deadline')
      }
      const raw = validateNativeInspectorHeapResponse(body.raw, handshake!, lastRequestId, pending.requestedAt, receivedAtNode)
      lastRequestId = raw.afterIsolateRequestId
      const evidence: NativeInspectorHeapEvidence = {
        transport: 'native-inspector-sdk',
        sessionId: identity.sessionId,
        sequence: pending.sequence,
        context: pending.context,
        requestedAt: pending.requestedAt,
        receivedAtNode,
        elapsedMs,
        raw,
      }
      clearTimeout(pending.timer)
      records.push(evidence)
      const resolve = pending.resolve
      pending = undefined
      respondNativeInspector(response, 200)
      resolve(evidence)
    })().catch((error: unknown) => {
      const cause = fail(error)
      respondNativeInspector(response, 409, { error: cause.message })
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })
  server.on('error', fail)
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Native Inspector test collector has no loopback listener')
  }
  const endpoint = `http://127.0.0.1:${address.port}`
  return {
    identity,
    endpoint,
    token,
    consoleExpression: createNativeInspectorHeapExpression(endpoint, token, identity),
    ready,
    records,
    rawResponses,
    get state() {
      return { ready: Boolean(handshake), polling: Boolean(poll), pending: Boolean(pending), closed, failure: failure?.message ?? null }
    },
    read(context: BenchHeapSampleContext): Promise<NativeInspectorHeapEvidence> {
      if (closed || failure || !handshake) {
        return Promise.reject(failure ?? new Error(`Native Inspector collector is ${closed ? 'closed' : 'not ready'}`))
      }
      if (pending) {
        return Promise.reject(fail(new Error('Concurrent native Inspector heap reads are forbidden')))
      }
      validateHeapSampleContext(context)
      return new Promise((resolve, reject) => {
        pending = {
          sequence: ++sequence,
          nonce: randomBytes(16).toString('hex'),
          context: { ...context },
          requestedAt: new Date().toISOString(),
          startedMono: performance.now(),
          delivered: false,
          timer: setTimeout(() => fail(new Error('Native Inspector heap request exceeded the original 2500ms timeout')), NATIVE_HEAP_TIMEOUT_MS),
          resolve,
          reject,
        }
        dispatch()
      })
    },
    close() {
      return closePromise ??= (async () => {
        closed = true
        const error = new Error('Native Inspector collector closed')
        rejectReady(error)
        if (pending) {
          clearTimeout(pending.timer)
          pending.reject(error)
          pending = undefined
        }
        if (poll) {
          respondNativeInspector(poll, 204)
          poll = undefined
        }
        await new Promise<void>((resolve, reject) => {
          server.close(cause => cause ? reject(cause) : resolve())
          server.closeAllConnections()
        })
        if (failure) {
          throw failure
        }
      })()
    },
  }
}
