export const NATIVE_HEAP_TIMEOUT_MS = 2_500

export interface BenchHeapSampleContext {
  preset: string
  scenario: string
  sampleIndex: number
  route: string
  phase: 'before' | 'after'
}

export interface NativeInspectorHeapIdentity {
  sessionId: string
  targetUrl: string
  toolVersion: string
  sdkVersion: string
}

export interface NativeInspectorHandshake {
  sessionId: string
  targetId: 'main'
  targetUrl: string
  targetCount: 1
  isolateRequestId: number
  isolate: { id: string }
  error: null
}

export interface NativeInspectorHeapResponse {
  targetId: 'main'
  targetUrl: string
  targetCount: 1
  afterTargetId: 'main'
  afterTargetUrl: string
  afterTargetCount: 1
  isolateRequestId: number
  isolate: { id: string }
  isolateError: null
  requestId: number
  afterIsolateRequestId: number
  afterIsolate: { id: string }
  afterIsolateError: null
  startedAt: string
  sentAt: string
  receivedAt: string
  verifiedAt: string
  durationMs: number
  response: { usedSize: number, totalSize: number, embedderHeapUsedSize?: number, backingStorageSize?: number }
  error: null
}

export interface NativeInspectorHeapEvidence {
  transport: 'native-inspector-sdk'
  sessionId: string
  sequence: number
  context: BenchHeapSampleContext
  requestedAt: string
  receivedAtNode: string
  elapsedMs: number
  raw: NativeInspectorHeapResponse
}

export interface NativeInspectorHeapReader {
  identity: NativeInspectorHeapIdentity
  read: (context: BenchHeapSampleContext) => Promise<NativeInspectorHeapEvidence>
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invalid native Inspector heap evidence: ${message}`)
  }
}

function requestId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function bytes(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function timestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
}

/** 绑定本轮受管 session 的明确 AppService 地址，不猜测其他调试目标。 */
export function validateNativeInspectorIdentity(identity: NativeInspectorHeapIdentity) {
  const url = new URL(identity.targetUrl)
  requireValue(identity.sessionId.trim() && identity.toolVersion.trim() && identity.sdkVersion.trim(), 'missing session or host version')
  requireValue(url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port
    && /^\/appservice\/s\d+\/_sessionId\/[^/]+\/mainframe$/.test(url.pathname)
    && !url.search && !url.hash && !url.username && !url.password, 'expected the owned loopback AppService target URL')
}

/** 握手只接受唯一 main AppService 目标及原生 getIsolateId 成功响应。 */
export function validateNativeInspectorHandshake(value: unknown, identity: NativeInspectorHeapIdentity): NativeInspectorHandshake {
  requireValue(isRecord(value), 'missing handshake')
  requireValue(value.sessionId === identity.sessionId && value.targetId === 'main'
    && value.targetUrl === identity.targetUrl && value.targetCount === 1, 'handshake target/session drift')
  requireValue(value.error === null && isRecord(value.isolate) && typeof value.isolate.id === 'string' && value.isolate.id.trim()
    && !value.isolate.error && !value.isolate.exceptionDetails, 'native isolate request failed')
  requireValue(requestId(value.isolateRequestId), 'missing native isolate request id')
  return value as unknown as NativeInspectorHandshake
}

/** 原始字节与前后 isolate 核验均完整时才接受，保留宿主返回的全部 JSON 字段。 */
export function validateNativeInspectorHeapResponse(
  value: unknown,
  handshake: NativeInspectorHandshake,
  previousRequestId: number,
  requestedAt: string,
  receivedAtNode: string,
): NativeInspectorHeapResponse {
  requireValue(isRecord(value), 'missing native response')
  requireValue(value.targetId === 'main' && value.targetUrl === handshake.targetUrl && value.targetCount === 1
    && value.afterTargetId === 'main' && value.afterTargetUrl === handshake.targetUrl && value.afterTargetCount === 1, 'AppService target drift')
  requireValue(value.isolateError === null && isRecord(value.isolate) && value.isolate.id === handshake.isolate.id
    && !value.isolate.error && !value.isolate.exceptionDetails
    && value.afterIsolateError === null && isRecord(value.afterIsolate) && value.afterIsolate.id === handshake.isolate.id
    && !value.afterIsolate.error && !value.afterIsolate.exceptionDetails, 'AppService isolate drift or failure')
  requireValue(requestId(value.isolateRequestId) && requestId(value.requestId) && requestId(value.afterIsolateRequestId)
    && value.isolateRequestId > previousRequestId && value.requestId > value.isolateRequestId
    && value.afterIsolateRequestId > value.requestId, 'missing, repeated, or reordered native request ids')
  requireValue(value.error === null, `native Runtime.getHeapUsage failed: ${JSON.stringify(value.error)}`)
  requireValue(isRecord(value.response) && bytes(value.response.usedSize) && bytes(value.response.totalSize)
    && value.response.totalSize >= value.response.usedSize && !value.response.error && !value.response.exceptionDetails, 'expected raw finite byte counts with usedSize <= totalSize')
  for (const field of ['embedderHeapUsedSize', 'backingStorageSize']) {
    requireValue(value.response[field] === undefined || bytes(value.response[field]), `invalid ${field} byte count`)
  }
  requireValue(timestamp(value.startedAt) && timestamp(value.sentAt) && timestamp(value.receivedAt) && timestamp(value.verifiedAt)
    && Date.parse(requestedAt) <= Date.parse(value.startedAt) && Date.parse(value.startedAt) <= Date.parse(value.sentAt)
    && Date.parse(value.sentAt) <= Date.parse(value.receivedAt) && Date.parse(value.receivedAt) <= Date.parse(value.verifiedAt)
    && Date.parse(value.verifiedAt) <= Date.parse(receivedAtNode), 'missing, stale, or reordered UTC timestamps')
  requireValue(typeof value.durationMs === 'number' && Number.isFinite(value.durationMs)
    && value.durationMs >= 0 && value.durationMs <= NATIVE_HEAP_TIMEOUT_MS, 'native request exceeded the original timeout')
  return value as unknown as NativeInspectorHeapResponse
}

export function validateHeapSampleContext(context: unknown): asserts context is BenchHeapSampleContext {
  requireValue(isRecord(context) && typeof context.preset === 'string' && context.preset.trim()
    && typeof context.scenario === 'string' && context.scenario.trim() && typeof context.route === 'string' && context.route.startsWith('/')
    && typeof context.sampleIndex === 'number'
    && Number.isSafeInteger(context.sampleIndex) && context.sampleIndex >= -1
    && (context.phase === 'before' || context.phase === 'after'), 'invalid benchmark checkpoint')
}

/** 读回报告时再验原始协议证据，不能仅凭 available 标记发布通过。 */
export function validateNativeInspectorHeapEvidence(value: unknown): asserts value is NativeInspectorHeapEvidence {
  requireValue(isRecord(value) && value.transport === 'native-inspector-sdk' && typeof value.sessionId === 'string' && value.sessionId.trim()
    && requestId(value.sequence) && timestamp(value.requestedAt) && timestamp(value.receivedAtNode)
    && Date.parse(value.requestedAt) <= Date.parse(value.receivedAtNode)
    && typeof value.elapsedMs === 'number' && Number.isFinite(value.elapsedMs) && value.elapsedMs >= 0
    && value.elapsedMs <= NATIVE_HEAP_TIMEOUT_MS && isRecord(value.raw), 'missing or invalid native collector checkpoint')
  validateHeapSampleContext(value.context)
  const handshake = validateNativeInspectorHandshake({
    sessionId: value.sessionId,
    targetId: value.raw.targetId,
    targetUrl: value.raw.targetUrl,
    targetCount: value.raw.targetCount,
    isolateRequestId: value.raw.isolateRequestId,
    isolate: value.raw.isolate,
    error: value.raw.isolateError,
  }, { sessionId: value.sessionId, targetUrl: String(value.raw.targetUrl), toolVersion: 'recorded', sdkVersion: 'recorded' })
  validateNativeInspectorIdentity({ sessionId: value.sessionId, targetUrl: handshake.targetUrl, toolVersion: 'recorded', sdkVersion: 'recorded' })
  validateNativeInspectorHeapResponse(value.raw, handshake, 0, value.requestedAt, value.receivedAtNode)
}
