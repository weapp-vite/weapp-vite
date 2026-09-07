export interface RequestClientsRealWebSocketFrame {
  body?: Record<string, unknown>
  client: string
  event?: string
  message?: string
  path: string
  requestCount: number
  sentAt?: string
  stage: string
  transport?: string
}

export interface RequestClientsRealWebSocketTranscript {
  echoPayload: RequestClientsRealWebSocketFrame
  tickPayload: RequestClientsRealWebSocketFrame
}

/** 独立校验本次发送的回显与服务端推送，推送不能替代回显。 */
export function createRequestClientsRealWebSocketTranscript(run: number) {
  let connected = false
  let echoPayload: RequestClientsRealWebSocketFrame | undefined
  let tickPayload: RequestClientsRealWebSocketFrame | undefined
  return {
    accept(value: unknown): RequestClientsRealWebSocketTranscript | undefined {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Invalid WebSocket frame')
      }
      const frame = value as RequestClientsRealWebSocketFrame
      if (frame.client !== 'native-websocket' || frame.path !== '/ws') {
        throw new Error('Unexpected WebSocket frame origin')
      }
      if (frame.stage === 'connected') {
        connected = true
        return
      }
      if (!connected) {
        throw new Error('WebSocket welcome frame missing')
      }
      if (frame.transport !== 'websocket') {
        throw new Error('Unexpected WebSocket transport')
      }
      if (frame.stage === 'echo') {
        if (frame.body?.client !== 'native-websocket' || frame.body.run !== run) {
          throw new Error('WebSocket echo does not match the current request')
        }
        echoPayload = frame
      }
      else if (frame.stage === 'tick') {
        if (frame.event !== 'server-random' || typeof frame.message !== 'string' || !frame.message) {
          throw new Error('Invalid WebSocket server push')
        }
        tickPayload = frame
      }
      else {
        throw new Error(`Unexpected WebSocket frame stage: ${String(frame.stage)}`)
      }
      if (echoPayload && tickPayload) {
        return { echoPayload, tickPayload }
      }
    },
  }
}

/** 等待真实 socket 的回显和推送；关闭、超时或解析失败都结束并释放连接。 */
export async function waitForRequestClientsRealWebSocketProbe(socket: WebSocket, run: number) {
  return await new Promise<RequestClientsRealWebSocketTranscript & {
    connectedReadyState: number
    finalReadyState: number
  }>((resolve, reject) => {
    const transcript = createRequestClientsRealWebSocketTranscript(run)
    let connectedReadyState = -1
    let settled = false
    let closeRequested = false
    let completed: RequestClientsRealWebSocketTranscript | undefined
    let timeout: ReturnType<typeof setTimeout>
    const cleanup = () => {
      clearTimeout(timeout)
      socket.onopen = null
      socket.onmessage = null
      socket.onerror = null
      socket.onclose = null
    }
    const close = () => {
      if (!closeRequested && socket.readyState !== 3) {
        closeRequested = true
        socket.close()
      }
    }
    function fail(error: unknown) {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      try {
        close()
      }
      catch {
        // 清理失败不能覆盖导致本次验收失败的原始错误。
      }
      reject(error)
    }
    timeout = setTimeout(() => {
      fail(new Error('Timed out waiting for WebSocket echo, server push and close'))
    }, 15_000)
    socket.onopen = () => {
      connectedReadyState = socket.readyState
      try {
        socket.send(JSON.stringify({ client: 'native-websocket', run }))
      }
      catch (error) {
        fail(error)
      }
    }
    socket.onmessage = (event) => {
      if (settled || completed) {
        return
      }
      try {
        const result = transcript.accept(JSON.parse(typeof event.data === 'string' ? event.data : ''))
        if (!result) {
          return
        }
        completed = result
        close()
      }
      catch (error) {
        fail(error)
      }
    }
    socket.onerror = fail
    socket.onclose = () => {
      if (!completed || socket.readyState !== 3) {
        fail(new Error('WebSocket closed before echo and server push completed'))
        return
      }
      settled = true
      cleanup()
      resolve({ ...completed, connectedReadyState, finalReadyState: socket.readyState })
    }
  })
}
